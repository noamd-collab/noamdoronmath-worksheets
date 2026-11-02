// @ts-check
/**
 * OPEN-07 local verification only. Same pages, but with the local Node adapter and
 * without the Wix integration, which refuses to start without WIX_CLIENT_ID.
 * Not used by `wix build` / `wix release`.
 *   npx astro dev --config astro.config.open07-verify.mjs --host 127.0.0.1 --port 4337
 */
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

/**
 * DEV/QA-only routes. They live outside src/pages so @wix/astro-pages never
 * lists them in /_wix/pages.json, and Wix never adds them to its sitemap.
 * scripts/check-loops-k3.mjs still opens /dev-loops on this loopback server.
 */
const devOnlyRoutes = {
  name: 'noam-dev-only-routes',
  hooks: {
    /** @param {{ injectRoute: (route: { pattern: string; entrypoint: string | URL; prerender?: boolean }) => void }} options */
    'astro:config:setup': ({ injectRoute }) => {
      injectRoute({
        pattern: '/dev-loops',
        entrypoint: new URL('./src/dev-pages/dev-loops.astro', import.meta.url),
        prerender: false,
      });
    },
  },
};

export default defineConfig({
  integrations: [react(), devOnlyRoutes],
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: '127.0.0.1', port: 4337 },
  image: { domains: ['static.wixstatic.com'] },

  // OPEN-07: optional override for the classic site's http-functions base (narration).
  // Unset = https://amiramnoam.wixsite.com/my-site/_functions. Set with
  // `wix env set --key=BLOG_AUDIO_FUNCTIONS_BASE --value=<https://…/_functions>`.
  env: {
    schema: {
      BLOG_AUDIO_FUNCTIONS_BASE: envField.string({ context: 'server', access: 'public', optional: true }),
      QWEN_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      QWEN_BASE_URL: envField.string({ context: 'server', access: 'secret', optional: true }),
      QWEN_MODEL: envField.string({ context: 'server', access: 'secret', optional: true }),
      NOAM_RECAPTCHA_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      NOAM_RECAPTCHA_V2_SITE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      NOAM_RECAPTCHA_V2_SECRET_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      // OtterlyAI Agent Analytics webhook. Optional until the secret is saved.
      OTTERLY_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },
});
