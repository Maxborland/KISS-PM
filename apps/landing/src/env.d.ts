/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly RESEND_API_KEY?: string;
  readonly RESEND_FROM?: string;
  readonly RESEND_NOTIFY_TO?: string;
  readonly WAITLIST_DB_PATH?: string;
  readonly WAITLIST_ALLOWED_ORIGINS?: string;
  readonly WAITLIST_IP_SALT?: string;
  readonly WAITLIST_TRUST_PROXY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
