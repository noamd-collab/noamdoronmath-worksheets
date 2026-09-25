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

export default defineConfig({
  integrations: [react()],
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
    },
  },
});
