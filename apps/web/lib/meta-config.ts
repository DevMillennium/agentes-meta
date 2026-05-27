export const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
export const META_API_VERSION = process.env.NEXT_PUBLIC_META_API_VERSION ?? "v25.0";
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Escopos alinhados ao OAuth do backend Phoenix. */
export const META_LOGIN_SCOPES = [
  "public_profile",
  "email",
  "ads_management",
  "ads_read",
  "business_management",
  "pages_show_list",
  "pages_read_engagement",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
  "instagram_basic",
  "instagram_manage_messages",
  "pages_manage_posts",
  "instagram_content_publish"
].join(",");
