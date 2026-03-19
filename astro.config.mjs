import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://elevatecnc.com',
  output: 'hybrid',
  adapter: netlify(),
});
