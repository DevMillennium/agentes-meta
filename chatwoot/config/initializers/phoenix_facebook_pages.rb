# frozen_string_literal: true

# Phoenix: exibir páginas Facebook no wizard mesmo se já vinculadas;
# ao "criar" de novo, atualiza tokens (reautorização) em vez de falhar em silêncio.
Rails.application.config.to_prepare do
  Api::V1::Accounts::CallbacksController.class_eval do
    # Rótulos ★/＋ no dropdown; ao salvar, volta ao nome limpo da Página (evita renomear a caixa).
    def phoenix_clean_inbox_name(raw)
      return nil if raw.blank?

      raw.to_s
          .sub(/\A[★＋]\s*/, '')
          .sub(/\s+—\s+Caixa «[^»]+»\s+\(alternar \/ reautorizar\)\z/, '')
          .sub(/\s+—\s+Conectar como nova caixa\z/, '')
          .strip
          .presence
    end

    def mark_already_existing_facebook_pages(data)
      return [] if data.blank?

      # Admin: listar TODAS as páginas Business do OAuth (exists sempre false no JSON)
      data.map do |page_detail|
        page = page_detail.with_indifferent_access
        existing = Current.account.facebook_pages.includes(:inbox).find_by(page_id: page['id'])
        page[:exists] = false

        if existing
          inbox = existing.inbox
          page[:phoenix_already_connected] = true
          page[:phoenix_inbox_id] = inbox&.id
          page[:phoenix_inbox_name] = inbox&.name
          page[:phoenix_page_id] = page['id']
          page[:name] = "★ #{page['name']} — Caixa «#{inbox&.name}» (alternar / reautorizar)"
        else
          page[:phoenix_already_connected] = false
          page[:phoenix_page_id] = page['id']
          page[:name] = "＋ #{page['name']} — Conectar como nova caixa"
        end
        page
      end
    end

    def register_facebook_page
      user_access_token = params[:user_access_token]
      page_access_token = params[:page_access_token]
      page_id = params[:page_id]
      inbox_name = phoenix_clean_inbox_name(params[:inbox_name])

      existing_channel = Current.account.facebook_pages.find_by(page_id: page_id)
      if existing_channel
        ActiveRecord::Base.transaction do
          existing_channel.update!(
            user_access_token: user_access_token,
            page_access_token: page_access_token
          )
          set_instagram_id(page_access_token, existing_channel)
          existing_channel.reauthorized!
          @facebook_inbox = existing_channel.inbox
          @facebook_inbox.update!(name: inbox_name) if inbox_name.present?
          set_avatar(@facebook_inbox, page_id)
        end
        return
      end

      ActiveRecord::Base.transaction do
        facebook_channel = Current.account.facebook_pages.create!(
          page_id: page_id, user_access_token: user_access_token,
          page_access_token: page_access_token
        )
        clean_name = inbox_name.presence || "Facebook — #{page_id}"
        @facebook_inbox = Current.account.inboxes.create!(name: clean_name, channel: facebook_channel)
        set_instagram_id(page_access_token, facebook_channel)
        set_avatar(@facebook_inbox, page_id)
      end
    rescue StandardError => e
      ChatwootExceptionTracker.new(e).capture_exception
      Rails.logger.error "Error in register_facebook_page: #{e.message}"
      log_additional_info
    end

    def long_lived_token(omniauth_token)
      koala = Koala::Facebook::OAuth.new(
        GlobalConfigService.load('FB_APP_ID', ''),
        GlobalConfigService.load('FB_APP_SECRET', '')
      )
      info = koala.exchange_access_token_info(omniauth_token)
      token = info['access_token']
      Rails.logger.info "[Phoenix] long_lived_token OK (#{token&.length || 0} chars)"
      token
    rescue StandardError => e
      Rails.logger.error "[Phoenix] long_lived_token FAILED: #{e.message}"
      nil
    end

    def facebook_pages
      pages = []
      token = long_lived_token(params[:omniauth_token])
      if token.blank?
        @page_details = []
        @user_access_token = nil
        Rails.logger.error '[Phoenix] facebook_pages: token vazio — confira FB_APP_ID/SECRET e permissões OAuth'
        return
      end

      @user_access_token = token
      fb = Koala::Facebook::API.new(token)
      fb_pages = fb.get_connections('me', 'accounts')
      pages.concat(fb_pages)
      while fb_pages.respond_to?(:next_page) && (next_page = fb_pages.next_page)
        fb_pages = next_page
        pages.concat(fb_pages)
      end
      @page_details = mark_already_existing_facebook_pages(pages)
      Rails.logger.info "[Phoenix] facebook_pages: #{@page_details.size} página(s) listada(s)"
    end
  end
end
