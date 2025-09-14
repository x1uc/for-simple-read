import "../../assets/tailwind.css";
import { createApp } from "vue";
import popup_thumb from "@/entrypoints/content/popup_thumb.vue";
import word_card from "@/entrypoints/content/word_card.vue"; // 引入 word_card 组件
import ai_trans_card from "@/entrypoints/content/ai_trans_card.vue";
import { select_word_storage } from "@/libs/select_word";
import { HighlightStorage, generateHighlightId, getElementXPath, type HighlightData } from "@/libs/highlight_storage";
import { EventManager } from "@/libs/event_manager";
import { HighlightRenderer } from "@/libs/highlight_renderer";

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    let popup_thumb_ui: any = null;
    let word_card_ui: any = null;
    let ai_trans_card_ui: any = null;

    // 保存当前选择信息
    let currentSelection: {
      range: Range;
      text: string;
      position: { x: number, y: number };
    } | null = null;

    // 2. 实例化事件管理器
    const eventManager = new EventManager();

    const getSelectionPosition = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      return {
        x: rect.left + window.scrollX,
        y: rect.bottom + window.scrollY + 10, // 在选择文本下方10px处显示
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

    // 显示缓存的单词卡片（无需再次查询API）
    const ensure_cached_word_card = async (wordData: any, position: { x: number, y: number }) => {
      if (!word_card_ui) {
        // 创建一个特殊的存储对象来提供缓存的数据
        const cached_word_storage = {
          getValue: () => Promise.resolve(wordData.word),
          setValue: (value: string) => Promise.resolve()
        };

        word_card_ui = await createShadowRootUi(ctx, {
          name: 'word-card',
          position: 'overlay',
          anchor: 'body',
          onMount(container) {
            // 设置容器的绝对定位
            container.style.position = 'absolute';
            container.style.left = `${position.x}px`;
            container.style.top = `${position.y}px`;
            container.style.zIndex = '10000';
            container.style.pointerEvents = 'auto';

            const app = createApp(word_card);
            // 注入 eventManager 和缓存的单词数据
            app.provide('eventManager', eventManager);
            app.provide('ojb', cached_word_storage);
            app.provide('cachedWordData', wordData); // 提供缓存的数据
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

    const ensure_ai_trans_card = async (position: { x: number, y: number }) => {
      if (!ai_trans_card_ui) {
        ai_trans_card_ui = await createShadowRootUi(ctx, {
          name: 'ai-trans-card',
          position: 'overlay',
          anchor: 'body',
          onMount(container) {
            // 设置容器的绝对定位
            container.style.position = 'absolute';
            container.style.left = `${position.x}px`;
            container.style.top = `${position.y}px`;
            container.style.zIndex = '10000';
            container.style.pointerEvents = 'auto';

            const app = createApp(ai_trans_card);

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
      ai_trans_card_ui.mount();
    };

    // 函数：移除选择框
    const remove_thumb_ui = () => {
      if (popup_thumb_ui) {
        popup_thumb_ui.remove();
        popup_thumb_ui = null;
      }
    };

    // 函数：移除单词卡片UI
    const remove_word_card_ui = () => {
      if (word_card_ui) {
        word_card_ui.remove();
        word_card_ui = null;
      }
    };

    // 函数：移除AI翻译卡片UI
    const remove_ai_trans_card_ui = () => {
      if (ai_trans_card_ui) {
        ai_trans_card_ui.remove();
        ai_trans_card_ui = null;
      }
    }

    eventManager.on('show-word-card', () => {
      const position = getSelectionPosition();
      if (position) {
        remove_thumb_ui();
        remove_ai_trans_card_ui();
        ensure_word_card(position);
      }
    });

    // 处理显示缓存单词卡片的事件
    eventManager.on('show-cached-word-card', (data: { wordData: any; position: { x: number; y: number } }) => {
      remove_thumb_ui();
      remove_ai_trans_card_ui();
      ensure_cached_word_card(data.wordData, data.position);
    });

    eventManager.on('show-ai-trans-card', () => {
      const position = getSelectionPosition();
      if (position) {
        remove_thumb_ui();
        remove_word_card_ui(); // 移除单词卡，确保同时只显示一个卡片
        ensure_ai_trans_card(position);
      }
    });

    eventManager.on('close-word-card', () => {
      remove_word_card_ui();
    });

    eventManager.on('close-ai-trans-card', () => {
      remove_ai_trans_card_ui();
    });

    // 添加高亮事件监听器
    eventManager.on('highlight-word', async (data: { word: string; wordData?: any }) => {
      try {
        if (!currentSelection) {
          console.warn('No current selection available for highlighting');
          return;
        }

        const { range, text } = currentSelection;
        
        // 确保选中的文本与要高亮的单词匹配
        if (text.toLowerCase() !== data.word.toLowerCase()) {
          console.warn('Selected text does not match word to highlight');
          return;
        }
        
        // 获取文本节点和偏移量
        const startContainer = range.startContainer;
        const startOffset = range.startOffset;
        
        // 创建高亮数据，包含缓存的单词详细信息
        const highlightData: HighlightData = {
          id: generateHighlightId(),
          word: text,
          url: window.location.href,
          timestamp: Date.now(),
          textContent: startContainer.textContent || '',
          xpath: getElementXPath(startContainer),
          offset: startOffset,
          length: text.length,
          wordData: data.wordData // 保存单词详细信息
        };
        
        // 保存到存储
        await HighlightStorage.saveHighlight(highlightData);
        
        // 重新渲染高亮
        HighlightRenderer.renderHighlights();
        
        console.log('Word highlighted successfully:', highlightData);
      } catch (error) {
        console.error('Error highlighting word:', error);
      }
    });

    // 添加高亮渲染事件监听
    eventManager.on('render-highlights', () => {
      HighlightRenderer.renderHighlights();
    });

    // 页面加载时恢复高亮
    setTimeout(() => {
      HighlightRenderer.renderHighlights();
      HighlightRenderer.addHighlightClickListeners(eventManager);
    }, 1000); // 延迟1秒确保页面完全加载

    document.addEventListener("mouseup", async (e) => {
      // 如果点击的是UI内部，则不处理
      if ((e.target as HTMLElement).closest('[data-wxt-shadow-root]')) {
        return;
      }

      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const selectedText = selection.toString().trim();
        select_word_storage.setValue(selectedText);
        
        const position = getSelectionPosition();
        if (position) {
          // 保存当前选择信息
          if (selection.rangeCount > 0) {
            currentSelection = {
              range: selection.getRangeAt(0).cloneRange(),
              text: selectedText,
              position: position
            };
          }
          
          await ensure_popup_thumb(position);
          popup_thumb_ui.mount();
        }
      } else {
        // 清除选择信息
        currentSelection = null;
        remove_thumb_ui();
        remove_word_card_ui(); // 同时移除单词卡
        remove_ai_trans_card_ui(); // 同时移除AI翻译卡
      }
    });
  },
});

