// Local visual QA only. Not used by wix build/release; production config is unchanged.
// No account keys, authentication middleware, remote writes or production sessions.
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';
import node from '@astrojs/node';
export default defineConfig({
  integrations:[react()],output:'server',adapter:node({mode:'standalone'}),
  server:{host:'127.0.0.1',port:4328},
  cacheDir:'./.astro-design-preview',
  image:{domains:['static.wixstatic.com']},
  env:{schema:{BLOG_AUDIO_FUNCTIONS_BASE:envField.string({context:'server',access:'public',optional:true})}},
  vite:{cacheDir:'./.vite-design-preview'},
});
