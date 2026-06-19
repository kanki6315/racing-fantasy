/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for API calls. Unset in dev → uses the Vite "/api" proxy. Set in prod to the API origin. */
  readonly VITE_API_BASE_URL?: string
  /** Public read base URL of the image bucket / CDN (e.g. https://bucket.s3.region.amazonaws.com). */
  readonly VITE_IMAGE_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
