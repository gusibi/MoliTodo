import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  output: 'static',
  site: 'https://molitodo.eztoolab.com',
  trailingSlash: 'always',
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'zh',
        locales: {
          zh: 'zh',
          en: 'en',
          ja: 'ja',
          ko: 'ko',
          fr: 'fr',
          de: 'de',
          es: 'es',
          pt: 'pt',
          ru: 'ru',
          ar: 'ar',
        },
      },
    }),
  ],
});
