// @ts-check
/**
 * OPEN-07 local verification only. Same pages, but with the local Node adapter and
 * without the Wix integration, which refuses to start without WIX_CLIENT_ID.
 * Not used by `wix build` / `wix release`.
 *   npx astro dev --config astro.config.open07-verify.mjs --host 127.0.0.1 --port 4337
 */
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';

export default defineConfig({
  integrations: [react()],
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { host: '127.0.0.1', port: 4337 },
  image: { domains: ['static.wixstatic.com'] },
});
