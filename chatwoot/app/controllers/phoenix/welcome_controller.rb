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
      # ?landing=1 força ver a landing mesmo logado (preview do estilo Chatrace)
      redirect_to '/app' if session_cookie_present? && params[:landing].blank?
    end

    def start
      redirect_to signup_path if signup_enabled?
    end

    def channels
      @channels = CHANNELS
      @highlight = params[:canal].to_s.presence
    end

    # Páginas Business já ligadas + atalho para conectar outra (admin alterna contas)
    def business_pages
      @account_id = @default_account_id
      @fb_inboxes = load_facebook_inboxes
      @requires_login = !session_cookie_present?
    end

    INTEGRATIONS = [
      { key: 'openai', name: 'OpenAI', icon: '🤖',
        desc: 'Captain + sugestões de resposta. Chave em Configurações → Integrações.',
        status: 'Disponível', doc: 'https://platform.openai.com/api-keys' },
      { key: 'make', name: 'Make', icon: '⚡',
        desc: 'Automatize fluxos entre Phoenix e CRM, planilhas, notificações.',
        status: 'Via webhook', doc: 'https://www.make.com/' },
      { key: 'zapier', name: 'Zapier', icon: '🔗',
        desc: 'Conecte milhares de apps sem código.',
        status: 'Via webhook', doc: 'https://zapier.com/' },
      { key: 'dialogflow', name: 'Dialogflow', icon: '💬',
        desc: 'NLU Google — use como Robô (Agent Bot) com URL de webhook.',
        status: 'Agent Bot', doc: 'https://cloud.google.com/dialogflow' },
      { key: 'meta', name: 'Meta (Facebook / Instagram)', icon: '📱',
        desc: 'Messenger, Instagram DM e webhooks unificados.',
        status: 'Operacional', doc: '/comecar/canais' },
      { key: 'webhooks', name: 'Webhooks da conta', icon: '📡',
        desc: 'Eventos em tempo real para seu backend.',
        status: 'Nativo Chatwoot', doc: nil }
    ].freeze

    def integrations
      @integrations = INTEGRATIONS
      @webhook_docs_url = "#{@public_base_url}/swagger"
    end

    def widget_embed
      load_widget_embed!
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
      @public_base_url = ENV.fetch('FRONTEND_URL', 'http://localhost:3001').to_s.chomp('/')
      @google_oauth_enabled = ENV['GOOGLE_OAUTH_CLIENT_ID'].present? ||
                              GlobalConfigService.load('GOOGLE_OAUTH_CLIENT_ID', '').present?
    end

    def load_widget_embed!
      @widget_snippet = nil
      @widget_inbox_id = nil
      account = Account.find_by(id: @default_account_id)
      return unless account

      channel = Channel::WebWidget.joins(:inbox).find_by(inboxes: { account_id: account.id })
      return unless channel

      @widget_inbox_id = channel.inbox.id
      base = @public_base_url
      token = channel.website_token
      @widget_snippet = <<~HTML
        <!-- Phoenix Digital Omnichannel — Widget -->
        <script>
          window.chatwootSettings = { locale: 'pt_BR', position: 'right' };
          (function(d,t) {
            var BASE_URL='#{base}';
            var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
            g.src=BASE_URL+'/packs/js/sdk.js';
            g.defer=true;
            g.async=true;
            s.parentNode.insertBefore(g,s);
            g.onload=function(){
              window.chatwootSDK.run({ websiteToken: '#{token}', baseUrl: BASE_URL });
            };
          })(document,'script');
        </script>
      HTML
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

    def load_facebook_inboxes
      return [] unless session_cookie_present?

      account = Account.find_by(id: @default_account_id)
      return [] unless account

      account.inboxes
             .where(channel_type: 'Channel::FacebookPage')
             .includes(:channel)
             .order(:name)
             .map do |inbox|
        ch = inbox.channel
        {
          inbox_id: inbox.id,
          inbox_name: inbox.name,
          page_id: ch.page_id,
          instagram_id: ch.instagram_id,
          conversations_url: "/app/accounts/#{@default_account_id}/inbox/#{inbox.id}",
          settings_url: "/app/accounts/#{@default_account_id}/settings/inboxes/#{inbox.id}"
        }
      end
    end
  end
end
