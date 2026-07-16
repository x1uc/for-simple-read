import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path';
// See https://wxt.dev/api/config.html
export default defineConfig({
  vite: () => ({
    plugins: [tailwindcss()]
  }),
  webExt: {
    chromiumProfile: resolve('.wxt/browser-data'),
    keepProfileChanges: true,
    chromiumArgs: ['--user-data-dir=./.wxt/browser-data']
  },
  manifest: {
    permissions: ["storage", "cookies"],
    optional_host_permissions: ["https://*/*", "http://*/*"],
    host_permissions: [
      "*://dict.youdao.com/*",
      "https://word-collection-api.ergouli848.workers.dev/*",
    ],
  }
});
