/**
 * Escopos OAuth Meta — manter idêntico em apps/web/lib/meta-oauth-scopes.ts
 */
export const META_OAUTH_SCOPE_LIST = [
  "public_profile",
  "email",
  "ads_management",
  "ads_read",
  "business_management",
  "pages_manage_metadata",
  "pages_show_list",
  "pages_read_engagement",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "pages_manage_posts",
  "instagram_content_publish"
] as const;

export const META_OAUTH_SCOPES = META_OAUTH_SCOPE_LIST.join(",");
