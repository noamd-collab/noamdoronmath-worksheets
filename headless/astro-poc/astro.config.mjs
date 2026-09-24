// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import wix from '@wix/astro';
import wixPages from '@wix/astro-pages';
import wixHosting from '@wix/astro-wix-hosting-adapter';

/**
 * Astro 5 + React POC linked to a NEW free Wix-managed Headless project.
 * Adapter: Wix hosting (replaced local @astrojs/node after headless link).
 */
export default defineConfig({
  integrations: [react(), wix(), wixPages()],
  output: 'server',
  adapter: wixHosting(),

  server: {
    host: '127.0.0.1',
    port: 4321,
  },

  image: {
    domains: ['static.wixstatic.com'],
  },
});
