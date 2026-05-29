# frozen_string_literal: true

# Gateway unificado Meta (Phoenix) — delega para jobs existentes do Chatwoot.
# Não substitui /webhooks/instagram nem /bot (Facebook Messenger gem).
class Webhooks::MetaController < ActionController::API
  include MetaTokenVerifyConcern

  before_action :verify_meta_signature!, only: :events

  def events
    payload = params.to_unsafe_hash
    normalized = Phoenix::MetaWebhookNormalizer.normalize(payload)
    Phoenix::MetaWebhookLogger.log_received(normalized)

    dispatch_normalized_events(normalized)
    render json: :ok
  rescue Phoenix::MetaWebhookNormalizer::UnsupportedObjectError => e
    Phoenix::MetaWebhookLogger.log_skipped(payload, e.message)
    head :unprocessable_entity
  end

  private

  def dispatch_normalized_events(normalized)
    case normalized[:object]
    when 'instagram'
      dispatch_instagram(normalized[:entry])
    when 'page'
      dispatch_messenger_page(normalized[:entry])
    end
  end

  def dispatch_instagram(entries)
    return if entries.blank?

    if contains_echo_event?(entries)
      ::Webhooks::InstagramEventsJob.set(wait: 2.seconds).perform_later(entries)
    else
      ::Webhooks::InstagramEventsJob.perform_later(entries)
    end

    Phoenix::MetaWebhookLogger.log_dispatched(object: 'instagram', job: 'Webhooks::InstagramEventsJob', count: entries.size)
  end

  def dispatch_messenger_page(entries)
    count = 0
    entries.each do |entry|
      messaging_events = Array(entry[:messaging].presence || entry['messaging'])
      standby_events = Array(entry[:standby].presence || entry['standby'])
      (messaging_events + standby_events).each do |messaging|
        ::Webhooks::FacebookEventsJob.perform_later({ messaging: messaging }.to_json)
        count += 1
      end
    end

    Phoenix::MetaWebhookLogger.log_dispatched(object: 'page', job: 'Webhooks::FacebookEventsJob', count: count)
  end

  def contains_echo_event?(entry_params)
    return false unless entry_params.is_a?(Array)

    entry_params.any? do |entry|
      entry = entry.with_indifferent_access
      messaging_events = entry[:messaging] || []
      messaging_events.any? { |messaging| messaging.dig(:message, :is_echo).present? }
    end
  end

  def valid_token?(token)
    verify_tokens.any? { |expected| ActiveSupport::SecurityUtils.secure_compare(token.to_s, expected.to_s) }
  end

  def verify_tokens
    [
      ENV.fetch('META_WEBHOOK_VERIFY_TOKEN', nil),
      GlobalConfigService.load('FB_VERIFY_TOKEN', ''),
      GlobalConfigService.load('IG_VERIFY_TOKEN', ''),
      GlobalConfigService.load('INSTAGRAM_VERIFY_TOKEN', '')
    ].compact_blank.uniq
  end

  def meta_app_secrets
    [
      ENV.fetch('META_APP_SECRET', nil),
      GlobalConfigService.load('FB_APP_SECRET', nil),
      GlobalConfigService.load('INSTAGRAM_APP_SECRET', nil)
    ].compact_blank.uniq
  end
end
