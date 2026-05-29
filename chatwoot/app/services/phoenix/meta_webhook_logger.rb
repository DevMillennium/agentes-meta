# frozen_string_literal: true

module Phoenix
  class MetaWebhookLogger
    def self.log_received(normalized)
      Rails.logger.info(
        {
          event: 'phoenix.meta_webhook.received',
          object: normalized[:object],
          entry_count: normalized[:entry_count],
          received_at: normalized[:received_at]
        }.to_json
      )
    end

    def self.log_dispatched(object:, job:, count:)
      Rails.logger.info(
        {
          event: 'phoenix.meta_webhook.dispatched',
          object: object,
          job: job,
          count: count
        }.to_json
      )
    end

    def self.log_skipped(payload, reason)
      Rails.logger.warn(
        {
          event: 'phoenix.meta_webhook.skipped',
          object: payload['object'],
          reason: reason
        }.to_json
      )
    end
  end
end
