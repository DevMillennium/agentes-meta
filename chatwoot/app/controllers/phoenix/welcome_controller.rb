# frozen_string_literal: true

module Phoenix
  class WelcomeController < ActionController::Base
    layout 'phoenix_public'

    CHANNELS = [
      { key: 'facebook', name: 'Messenger', icon: 'messenger', desc: 'Facebook Messenger e página vinculada' },
      { key: 'instagram', name: 'Instagram', icon: 'instagram', desc: 'Mensagens diretas do Instagram' },
      { key: 'whatsapp', name: 'WhatsApp', icon: 'whatsapp', desc: 'WhatsApp Business (Cloud API)' },
      { key: 'website', name: 'Chat no site', icon: 'website', desc: 'Widget de chat no seu website' },
      { key: 'email', name: 'E-mail', icon: 'email', desc: 'Caixa de entrada por e-mail' },
      { key: 'telegram', name: 'Telegram', icon: 'telegram', desc: 'Bot e conversas no Telegram' }
    ].freeze

    before_action :load_brand_config

    def home
      redirect_to '/app' if session_cookie_present?
    end

    def start
      redirect_to signup_path if signup_enabled?
    end

    def channels
      @channels = CHANNELS
      @highlight = params[:canal].to_s.presence
    end

    def continue
      canal = params[:canal].to_s
      unless CHANNELS.any? { |c| c[:key] == canal }
        redirect_to '/comecar/canais'
        return
      end

      session[:phoenix_post_login_channel] = canal

      if session_cookie_present?
        redirect_to channel_app_path(canal), allow_other_host: false
      else
        redirect_to '/app/login'
      end
    end

    private

    def load_brand_config
      @installation_name = GlobalConfigService.load('INSTALLATION_NAME', 'Phoenix Digital Omnichannel')
      @brand_url = GlobalConfigService.load('BRAND_URL', 'https://phoenixglobal.com.br')
      @signup_enabled = ActiveModel::Type::Boolean.new.cast(
        GlobalConfigService.load('ENABLE_ACCOUNT_SIGNUP', 'false')
      )
      @default_account_id = ENV.fetch('PHOENIX_DEFAULT_ACCOUNT_ID', '1')
    end

    def session_cookie_present?
      cookies['cw_d_session_info'].present?
    end

    def signup_path
      @signup_enabled ? '/app/auth/signup' : '/comecar/canais'
    end

    def signup_enabled?
      @signup_enabled
    end

    def channel_app_path(canal)
      "/app/accounts/#{@default_account_id}/settings/inboxes/new/#{canal}"
    end

  end
end
