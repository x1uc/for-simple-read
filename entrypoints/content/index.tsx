import "../../assets/tailwind.css";
import { createRoot, type Root } from "react-dom/client";
import PopupThumb from "@/entrypoints/content/views/popup_thumb";
import WordCard from "@/entrypoints/content/views/word_card";
import AITransCard from "@/entrypoints/content/views/ai_trans_card";
import { select_word_storage } from "@/libs/select_word";
import { HighlightStorage, generateHighlightId, getElementXPath, type HighlightData } from "@/libs/highlight_storage";
import { EventManager } from "@/libs/event_manager";
import { HighlightRenderer } from "@/libs/highlight_renderer";

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    // 核心触发代码：监听用户选择文本动作

    //--------------代码逻辑--------------------------
    let popup_thumb_ui: any = null;
    let popup_thumb_ui_creation: Promise<any> | null = null;
    let word_card_ui: any = null;
    let ai_trans_card_ui: any = null;
    let isAiTransCardPinned = false;
    let aiTransCardPosition: { left: number; top: number } | null = null;

    // 保存当前选择信息（增加上下文信息）
    let currentSelection: {
      range: Range;
      text: string;
      position: { x: number, y: number };
      context?: {
        paragraphText: string;
        sentence: string;
        snippet: string;
        xpath: string;
      };
    } | null = null;

    // 2. 实例化事件管理器
    const eventManager = new EventManager();


    // 提取选区所在段落/句子上下文
    const getClosestContextElement = (node: Node): HTMLElement | null => {
      let el: HTMLElement | null =
        node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : (node.parentElement as HTMLElement | null);
      while (el) {
        if (el.matches?.("p, li, blockquote, pre, h1,h2,h3,h4,h5,h6, article, section")) return el;
        const style = window.getComputedStyle(el);
        if (style.display === "block" && (el.textContent || "").trim().length > 0) return el;
        el = el.parentElement;
      }
      return null;
    };

    const extractSelectionContext = (range: Range) => {
      const containerEl = getClosestContextElement(range.commonAncestorContainer);
      if (!containerEl) {
        return { paragraphText: "", sentence: "", snippet: "", xpath: "" };
      }
      const paragraphText = (containerEl.innerText || containerEl.textContent || "").replace(/\s+\n/g, " ").trim();
      // 计算选区在段落中的起止位置
      const preRange = document.createRange();
      preRange.selectNodeContents(containerEl);
      preRange.setEnd(range.startContainer, range.startOffset);
      const startIndex = preRange.toString().length;
      const selected = range.toString();
      const endIndex = startIndex + selected.length;
      // 基于常见句号符号寻找句子边界
      const marks = [".", "!", "?", "。", "！", "？", "…", ";", "；"];
      let leftPos = -1;
      for (const ch of marks) {
        const pos = paragraphText.lastIndexOf(ch, Math.max(0, startIndex - 1));
        if (pos > leftPos) leftPos = pos;
      }
      let rightPos = paragraphText.length;
      for (const ch of marks) {
        const pos = paragraphText.indexOf(ch, endIndex);
        if (pos !== -1) rightPos = Math.min(rightPos, pos + 1);
      }
      const sentence = paragraphText.slice(leftPos + 1, rightPos).trim();
      const radius = 80;
      const snippet = paragraphText.slice(Math.max(0, startIndex - radius), Math.min(paragraphText.length, endIndex + radius)).trim();
      const xpath = getElementXPath(containerEl);
      return { paragraphText, sentence, snippet, xpath };
    };

    const getSelectionPosition = (selectionRange?: Range) => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return null;

      const range = selectionRange ?? selection.getRangeAt(0);
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

    const applyAiTransCardPosition = (left: number, top: number) => {
      if (!ai_trans_card_ui) return;
      const container = ai_trans_card_ui.uiContainer;
      if (!container) return;
      container.style.position = 'fixed';
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
    };


    const configurePopupHost = (shadowHost: HTMLElement) => {
      shadowHost.style.position = 'fixed';
      shadowHost.style.left = '0';
      shadowHost.style.top = '0';
      shadowHost.style.width = '0';
      shadowHost.style.height = '0';
      shadowHost.style.margin = '0';
      shadowHost.style.overflow = 'visible';
      shadowHost.style.zIndex = '10000';
      shadowHost.style.pointerEvents = 'none';
    };

    const applyPopupPosition = (container: HTMLElement, position: { x: number; y: number }) => {
      const viewportLeft = position.x - window.scrollX;
      const viewportTop = position.y - window.scrollY;
      const maxLeft = Math.max(8, window.innerWidth - 96);
      const left = Math.min(Math.max(8, viewportLeft), maxLeft);
      const top = viewportTop + 44 <= window.innerHeight
        ? Math.max(8, viewportTop)
        : Math.max(8, viewportTop - 46);

      container.style.position = 'fixed';
      container.style.left = `${left}px`;
      container.style.top = `${top}px`;
      container.style.zIndex = '10000';
      container.style.pointerEvents = 'auto';
      container.style.background = 'transparent';
      container.style.border = 'none';
      container.style.boxShadow = 'none';
    };

    const ensure_popup_thumb_reliable = async (
      position: { x: number, y: number },
      shouldApply: () => boolean = () => true,
    ) => {
      if (!popup_thumb_ui) {
        let creation = popup_thumb_ui_creation;
        if (!creation) {
          creation = createShadowRootUi(ctx, {
            name: 'popup-thumb-ui',
            position: 'overlay',
            anchor: 'body',
            onMount(container, _shadow, shadowHost) {
              configurePopupHost(shadowHost);
              applyPopupPosition(container, position);
              const root = createRoot(container);
              root.render(<PopupThumb eventManager={eventManager} />);
              return root;
            },
            onRemove(root?: Root) {
              root?.unmount();
            },
          });
          popup_thumb_ui_creation = creation;
        }

        try {
          popup_thumb_ui = await creation;
        } finally {
          if (popup_thumb_ui_creation === creation) {
            popup_thumb_ui_creation = null;
          }
        }
      }

      if (!shouldApply()) return;

      const ui = popup_thumb_ui;
      if (!ui) return;
      configurePopupHost(ui.shadowHost);
      applyPopupPosition(ui.uiContainer, position);
      if (!shouldApply()) return;
      if (!ui.mounted) {
        ui.mount();
      }
      applyPopupPosition(ui.uiContainer, position);
    };

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
            container.style.background = 'transparent';
            container.style.border = 'none';
            container.style.boxShadow = 'none';

            const root = createRoot(container);
            root.render(
              <WordCard
                eventManager={eventManager}
                selectedWordStore={select_word_storage}
              />,
            );
            return root;
          },
          onRemove(root?: Root) {
            root?.unmount();
          },
        });
      }
      word_card_ui.mount();
    };

    // 显示缓存的单词卡片（无需再次查询API）
    const ensure_cached_word_card = async (wordData: any, position: { x: number, y: number }) => {
      if (!word_card_ui) {
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
            container.style.background = 'transparent';
            container.style.border = 'none';
            container.style.boxShadow = 'none';

            const root = createRoot(container);
            root.render(
              <WordCard
                eventManager={eventManager}
                selectedWordStore={select_word_storage}
                cachedWordData={wordData}
              />,
            );
            return root;
          },
          onRemove(root?: Root) {
            root?.unmount();
          },
        });
      }
      word_card_ui.mount();
    };

    const ensure_ai_trans_card = async (position: { x: number, y: number }) => {
      const toViewportPosition = ({ x, y }: { x: number; y: number }) => ({
        left: x - window.scrollX,
        top: y - window.scrollY,
      });

      const desiredPosition = (isAiTransCardPinned && aiTransCardPosition)
        ? aiTransCardPosition
        : toViewportPosition(position);

      aiTransCardPosition = { ...desiredPosition };

      if (!ai_trans_card_ui) {
        const initialPosition = { ...desiredPosition };
        ai_trans_card_ui = await createShadowRootUi(ctx, {
          name: 'ai-trans-card',
          position: 'overlay',
          anchor: 'body',
          onMount(container) {
            container.style.position = 'fixed';
            container.style.left = `${initialPosition.left}px`;
            container.style.top = `${initialPosition.top}px`;
            container.style.zIndex = '10000';
            container.style.pointerEvents = 'auto';
            container.style.background = 'transparent';
            container.style.border = 'none';
            container.style.boxShadow = 'none';

            const root = createRoot(container);
            root.render(
              <AITransCard
                eventManager={eventManager}
                selectedWordStore={select_word_storage}
                initialPinned={isAiTransCardPinned}
              />,
            );
            return root;
          },
          onRemove(root?: Root) {
            root?.unmount();
          },
        });
      } else if (!isAiTransCardPinned) {
        applyAiTransCardPosition(desiredPosition.left, desiredPosition.top);
      }

      ai_trans_card_ui.mount();
      if (aiTransCardPosition) {
        applyAiTransCardPosition(aiTransCardPosition.left, aiTransCardPosition.top);
      }
      eventManager.emit('ai-trans-card-apply-pin', isAiTransCardPinned);
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
    const remove_ai_trans_card_ui = ({ force = false }: { force?: boolean } = {}) => {
      if (isAiTransCardPinned && !force) {
        return;
      }
      if (ai_trans_card_ui) {
        ai_trans_card_ui.remove();
        ai_trans_card_ui = null;
        aiTransCardPosition = null;
      }
    }

    const readSelectionSnapshot = () => {
      try {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return null;

        const text = selection.toString().trim();
        if (!text) return null;

        const range = selection.getRangeAt(0).cloneRange();
        const position = getSelectionPosition(range);
        if (!position) return null;

        let context;
        try {
          context = extractSelectionContext(range);
        } catch (error) {
          console.warn('Failed to extract selection context:', error);
        }

        return { range, text, position, context };
      } catch (error) {
        console.warn('Failed to read current selection:', error);
        return null;
      }
    };

    let selectionRequestId = 0;
    let selectionFrame: number | null = null;

    const isOwnUiEvent = (event: Event) => {
      const target = event.target;
      return target instanceof Element && !!target.closest('[data-wxt-shadow-root]');
    };

    const processSelection = async () => {
      const requestId = ++selectionRequestId;
      const snapshot = readSelectionSnapshot();

      if (!snapshot) {
        currentSelection = null;
        remove_thumb_ui();
        remove_word_card_ui();
        remove_ai_trans_card_ui();
        return;
      }

      currentSelection = snapshot;
      select_word_storage.setValue({
        word: snapshot.text,
        context: snapshot.context?.sentence || "",
      });

      try {
        await ensure_popup_thumb_reliable(snapshot.position, () => requestId === selectionRequestId);
        if (requestId !== selectionRequestId) return;
      } catch (error) {
        console.error('Failed to show selection popup:', error);
      }
    };

    const scheduleSelectionHandling = () => {
      if (selectionFrame !== null) {
        cancelAnimationFrame(selectionFrame);
      }
      selectionFrame = requestAnimationFrame(() => {
        selectionFrame = null;
        void processSelection();
      });
    };

    const handleSelectionInteraction = (event: Event) => {
      if (isOwnUiEvent(event)) return;
      scheduleSelectionHandling();
    };

    document.addEventListener('pointerup', handleSelectionInteraction, true);
    document.addEventListener('mouseup', handleSelectionInteraction, true);
    document.addEventListener('keyup', (event: KeyboardEvent) => {
      const selectionKeys = ['Shift', 'Control', 'Meta', 'Alt', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];
      if (selectionKeys.includes(event.key) || event.ctrlKey || event.metaKey) {
        handleSelectionInteraction(event);
      }
    }, true);

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

    eventManager.on('ai-trans-card-pin-state-change', (pinned: boolean) => {
      isAiTransCardPinned = !!pinned;
      eventManager.emit('ai-trans-card-apply-pin', isAiTransCardPinned);
    });

    eventManager.on('ai-trans-card-position-change', (data: { left: number; top: number; dragging: boolean }) => {
      if (!data || typeof data.left !== 'number' || typeof data.top !== 'number') {
        return;
      }
      aiTransCardPosition = { left: data.left, top: data.top };
      applyAiTransCardPosition(data.left, data.top);
    });

    eventManager.on('close-ai-trans-card', () => {
      isAiTransCardPinned = false;
      aiTransCardPosition = null;
      eventManager.emit('ai-trans-card-apply-pin', false);
      remove_ai_trans_card_ui({ force: true });
    });

    // 添加高亮事件监听器（把上下文合并进 wordData 里）
    eventManager.on('highlight-word', async (data: { word: string; wordData?: any }) => {
      try {
        if (!currentSelection) {
          console.warn('No current selection available for highlighting');
          return;
        }

        const { range, text, context } = currentSelection;

        if (text.toLowerCase() !== data.word.toLowerCase()) {
          console.warn('Selected text does not match word to highlight');
          return;
        }

        const startContainer = range.startContainer;
        const startOffset = range.startOffset;

        const wordDataWithContext = {
          ...(data.wordData || {}),
          context: context || null, // 段落文本/句子/片段 + xpath
        };

        const highlightData: HighlightData = {
          id: generateHighlightId(),
          word: text,
          url: window.location.href,
          timestamp: Date.now(),
          textContent: startContainer.textContent || '',
          xpath: getElementXPath(startContainer),
          offset: startOffset,
          length: text.length,
          wordData: wordDataWithContext
        };

        await HighlightStorage.saveHighlight(highlightData);
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

  },
});
