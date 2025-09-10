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

