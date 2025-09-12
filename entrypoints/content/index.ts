import "../../assets/tailwind.css";
import { createApp } from "vue";
import popup_thumb from "./popup_thumb.vue";
import word_card from "./demo.vue"; // 引入 word_card 组件
import ai_trans_card from "./ai_trans_card.vue";
import { select_word_storage } from "@/libs/select_word";

// 1. 定义一个简单的事件管理器
class EventManager {
  private listeners: { [key: string]: Function[] } = {};

  on(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, ...args: any[]) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(...args));
    }
  }
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let popup_thumb_ui: any = null;
    let word_card_ui: any = null;

    // 2. 实例化事件管理器
    const eventManager = new EventManager();

    const getSelectionPosition = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      return {
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 5, // 在选择文本下方5px处显示
        width: rect.width,
        height: rect.height,
        centerX: rect.left + window.scrollX + rect.width / 2,
        centerY: rect.top + window.scrollY + rect.height / 2,
      };
    };

    const ensure_popup_thumb = async (position: { x: number, y: number }) => {
      if (!popup_thumb_ui) {
        popup_thumb_ui = await createShadowRootUi(ctx, {
          name: 'popup-thumb-ui',
          position: 'overlay',
          anchor: 'body',
          onMount(container) {
            // 设置容器的绝对定位
            container.style.position = 'absolute';
            container.style.left = `${position.x}px`;
            container.style.top = `${position.y}px`;
            container.style.zIndex = '10000';
            container.style.pointerEvents = 'auto';

            const app = createApp(popup_thumb);
            // 3. 将 eventManager 注入到 Vue 应用中
            app.provide('eventManager', eventManager);
            app.mount(container);
            return app;
          },
          onRemove(app) {
            app?.unmount();
          },
        });
      } else {
        // 如果UI已存在，更新位置
        const container = popup_thumb_ui.wrapper;
        if (container) {
          container.style.left = `${position.x}px`;
          container.style.top = `${position.y}px`;
        }
      }
    };

    const remove_thumb_ui = () => {
      if (popup_thumb_ui) {
        popup_thumb_ui.remove();
        popup_thumb_ui = null;
      }
    };

    // 函数：创建并显示单词卡片UI
    const ensure_word_card = async (position: { x: number, y: number }) => {
      if (!word_card_ui) {
        word_card_ui = await createShadowRootUi(ctx, {
          name: 'word-card-ui',
          position: 'overlay',
          anchor: 'body',
          onMount(container) {
            container.style.position = 'absolute';
            container.style.left = `${position.x}px`;
            container.style.top = `${position.y}px`;
            container.style.zIndex = '10000';
            container.style.pointerEvents = 'auto';

            const app = createApp(word_card);
            // 同样注入 eventManager
            app.provide('eventManager', eventManager);
            app.provide('ojb', select_word_storage); 
            app.mount(container);
            return app;
          },
          onRemove(app) {
            app?.unmount();
          },
        });
      }
      word_card_ui.mount();
    };

    // 函数：移除单词卡片UI
    const remove_word_card_ui = () => {
      if (word_card_ui) {
        word_card_ui.remove();
        word_card_ui = null;
      }
    };

    // 4. 使用 eventManager 监听事件
    eventManager.on('show-word-card', () => {
      const position = getSelectionPosition();
      if (position) {
        remove_thumb_ui();
        ensure_word_card(position);
      }
    });

    eventManager.on('close-word-card', () => {
      remove_word_card_ui();
    });

    document.addEventListener("mouseup", async (e) => {
      // 如果点击的是UI内部，则不处理
      if ((e.target as HTMLElement).closest('[data-wxt-shadow-root]')) {
        return;
      }

      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        select_word_storage.setValue(selection.toString().trim());
        const position = getSelectionPosition();
        if (position) {
          await ensure_popup_thumb(position);
          popup_thumb_ui.mount();
        }
      } else {
        remove_thumb_ui();
        remove_word_card_ui(); // 同时移除单词卡
      }
    });

    let ai_trans_card_ui: any = null;
    const ensure_ai_trans_card = async () => {
      if (!ai_trans_card_ui) {
        ai_trans_card_ui = await createShadowRootUi(ctx, {
          name: 'ai-trans-card',
          position: 'overlay',
          anchor: 'body',
          onMount(container) {
            // 设置容器的绝对定位
            container.style.position = 'absolute';
            container.style.zIndex = '10000';
            container.style.pointerEvents = 'auto';

            const app = createApp(ai_trans_card);
            // 3. 将 eventManager 注入到 Vue 应用中
            app.mount(container);
            return app;
          },
          onRemove(app) {
            app?.unmount();
          },
        });
      }
    };
    await ensure_ai_trans_card();
    ai_trans_card_ui.mount();
  },
});

