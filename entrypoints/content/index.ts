import "../../assets/tailwind.css";
import { createApp } from "vue";
import demo from "./demo.vue";

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let ui: any = null;

    const ensureUi = async () => {
      if (!ui) {
        ui = await createShadowRootUi(ctx, {
          name: 'content-script',
          position: 'overlay', // 或 inline，看你要怎么展示
          anchor: 'body',
          onMount(container) {
            const app = createApp(demo);
            app.provide('ojb', {
              word: 'example',
              pronounce: '/ɪɡˈzɑːmp(ə)l/',
              meaning: 
              "n.例子，例证；榜样，楷模；典型，范例；例句，例题；警戒，受罚（以示警告）者\nv.得到说明，可加以举例说明"
            });
            app.mount(container);
            return app;
          },
          onRemove(app) {
            app?.unmount();
          },
        });
      }
    };

    await ensureUi();
    ui.mount();
  },
});

