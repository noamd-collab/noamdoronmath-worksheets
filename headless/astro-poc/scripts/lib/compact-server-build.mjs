import { transform } from 'esbuild';
import { omitWixSitemapPathsPlugin } from './omit-wix-sitemap-paths.mjs';

/**
 * Wix sends server modules as base64 JSON. Compact generated JavaScript before
 * that encoding so adding topic pages does not overflow the deployment request.
 * Astro 5 forces server minification off after merging the ordinary Vite config,
 * so register a server renderChunk hook. Keep the manifest's JSON serialization
 * intact for bundle-native-svg's verified asset-registration pruning.
 * The client pipeline keeps its existing settings.
 * https://docs.astro.build/en/reference/integrations-reference/#astrobuildsetup
 * https://esbuild.github.io/api/#minify
 * @returns {import('astro').AstroIntegration}
 */
export default function compactServerBuild() {
  return {
    name: 'noam-compact-server-build',
    hooks: {
      // SEO-1 (from PR #449): keep 404, noindex and redirecting routes out of the
      // Wix page list behind /pages-sitemap.xml. Registered here so the fenced
      // astro.config.mjs stays byte-identical; a no-op without @wix/astro-pages.
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({ vite: { plugins: [omitWixSitemapPathsPlugin()] } });
      },
      'astro:build:setup': ({ target, updateConfig }) => {
        if (target !== 'server') return;
        updateConfig({
          plugins: [{
            name: 'noam-compact-server-chunks',
            enforce: 'post',
            async renderChunk(code, chunk) {
              if (/^manifest_[^/]+\.mjs$/.test(chunk.fileName)) return null;
              const result = await transform(code, {
                format: 'esm',
                target: 'esnext',
                sourcefile: chunk.fileName,
                charset: 'utf8',
                minifyWhitespace: true,
                minifyIdentifiers: false,
                minifySyntax: false,
                sourcemap: false,
              });
              return { code: result.code, map: null };
            },
          }],
        });
      },
    },
  };
}
