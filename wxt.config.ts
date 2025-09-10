import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path';
// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  vite: () => ({
    plugins: [tailwindcss()]
  }),
  webExt: {
    chromiumProfile: resolve('.wxt/browser-data'),
    keepProfileChanges: true,
    chromiumArgs: ['--user-data-dir=./.wxt/browser-data']
  }
});
