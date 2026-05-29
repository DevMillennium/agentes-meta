# frozen_string_literal: true

module Phoenix
  class MetaWebhookNormalizer
    class UnsupportedObjectError < StandardError; end

    SUPPORTED_OBJECTS = %w[instagram page].freeze

    def self.normalize(payload)
      new(payload).normalize
    end

    def initialize(payload)
      @payload = payload.with_indifferent_access
    end

    def normalize
      object = @payload[:object].to_s.downcase
      raise UnsupportedObjectError, "Unsupported object: #{object}" unless SUPPORTED_OBJECTS.include?(object)

      {
        object: object,
        entry: Array(@payload[:entry]),
        entry_count: Array(@payload[:entry]).size,
        received_at: Time.current.iso8601
      }
    end
  end
end
