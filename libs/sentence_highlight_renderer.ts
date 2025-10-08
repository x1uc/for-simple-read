import { SentenceHighlightStorage, getElementByXPath, getConfiguredHighlightColor, type SentenceHighlightData } from './sentence_highlight_storage';
import { EventManager } from './event_manager';

// 句子高亮渲染类
export class SentenceHighlightRenderer {
  private static readonly HIGHLIGHT_ATTRIBUTE = 'data-sentence-highlight-id';

  // 渲染所有句子高亮
  static async renderHighlights() {
    try {
      // 先清除现有高亮
      this.clearHighlights();

      // 获取当前页面的句子高亮数据
      const highlights = await SentenceHighlightStorage.getHighlights(window.location.href);

      // 渲染每个句子高亮
      for (const highlight of highlights) {
        await this.renderSingleHighlight(highlight);
      }
    } catch (error) {
      console.error('Error rendering sentence highlights:', error);
    }
  }

  static async renderSingleHighlight(highlight: SentenceHighlightData) {
    try {
      const element = getElementByXPath(highlight.xpath);

      if (!element) {
        console.warn('Element not found for sentence highlight:', highlight);
        return;
      }

      // 查找包含目标文本的文本节点
      const textNodes = this.getTextNodesInElement(element);

      for (const textNode of textNodes) {
        if (textNode.textContent && textNode.textContent.includes(highlight.sentence)) {
          this.highlightTextInNode(textNode, highlight);
          break;
        }
      }
    } catch (error) {
      console.error('Error rendering single sentence highlight:', error);
    }
  }

  // 在文本节点中高亮指定句子
  static highlightTextInNode(textNode: Text, highlight: SentenceHighlightData) {
    const text = textNode.textContent || '';
    const sentenceIndex = text.toLowerCase().indexOf(highlight.sentence.toLowerCase());

    if (sentenceIndex === -1) return;

    // 创建高亮元素，使用内联样式
    const highlightSpan = document.createElement('span');
    highlightSpan.setAttribute(this.HIGHLIGHT_ATTRIBUTE, highlight.id);
    highlightSpan.textContent = text.substring(sentenceIndex, sentenceIndex + highlight.sentence.length);

    // 使用用户设置的颜色或默认颜色
    const color = highlight.color || '#FFF59D';

    // 使用内联样式
    highlightSpan.style.cssText = `
      background-color: ${color} !important;
      border-radius: 3px !important;
      padding: 2px 4px !important;
      cursor: pointer !important;
      transition: all 0.2s ease !important;
      position: relative !important;
      display: inline !important;
    `;

    // 添加鼠标悬停效果
    highlightSpan.addEventListener('mouseenter', () => {
      highlightSpan.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
      highlightSpan.style.transform = 'scale(1.02)';
    });

    highlightSpan.addEventListener('mouseleave', () => {
      highlightSpan.style.boxShadow = 'none';
      highlightSpan.style.transform = 'scale(1)';
    });

    // 如果有备注，添加tooltip
    if (highlight.note) {
      highlightSpan.title = highlight.note;
    }

    // 分割文本节点
    const beforeText = text.substring(0, sentenceIndex);
    const afterText = text.substring(sentenceIndex + highlight.sentence.length);

    const parent = textNode.parentNode;
    if (!parent) return;

    // 插入新节点
    if (beforeText) {
      parent.insertBefore(document.createTextNode(beforeText), textNode);
    }
    parent.insertBefore(highlightSpan, textNode);
    if (afterText) {
      parent.insertBefore(document.createTextNode(afterText), textNode);
    }

    // 移除原始文本节点
    parent.removeChild(textNode);
  }

  // 获取元素内的所有文本节点
  static getTextNodesInElement(element: Element): Text[] {
    const textNodes: Text[] = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT
    );

    let node: Node | null;
    while (node = walker.nextNode()) {
      textNodes.push(node as Text);
    }

    return textNodes;
  }

  // 清除所有句子高亮
  static clearHighlights() {
    // 通过属性选择器找到所有句子高亮元素
    const highlightElements = document.querySelectorAll(`[${this.HIGHLIGHT_ATTRIBUTE}]`);
    highlightElements.forEach(element => {
      const parent = element.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(element.textContent || ''), element);
        parent.normalize(); // 合并相邻的文本节点
      }
    });
  }

  // 为句子高亮元素添加点击事件监听
  static addHighlightClickListeners(eventManager: EventManager) {
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      // 检查是否是句子高亮元素（通过属性判断）
      if (target.hasAttribute(this.HIGHLIGHT_ATTRIBUTE)) {
        const sentence = target.textContent?.trim();
        const highlightId = target.getAttribute(this.HIGHLIGHT_ATTRIBUTE);

        if (sentence && highlightId) {
          try {
            // 获取句子高亮数据
            const highlights = await SentenceHighlightStorage.getHighlights(window.location.href);
            const highlightData = highlights.find(h => h.id === highlightId);

            if (highlightData) {
              // 创建一个高亮菜单
              const rect = target.getBoundingClientRect();
              const position = {
                x: rect.left + window.scrollX,
                y: rect.bottom + window.scrollY + 5
              };

              // 触发显示高亮菜单事件
              eventManager.emit('show-sentence-highlight-menu', {
                highlightData: highlightData,
                position: position,
                target: target
              });
            }
          } catch (error) {
            console.error('Error handling sentence highlight click:', error);
          }
        }
      }
    });

    // 添加右键菜单支持
    document.addEventListener('contextmenu', async (e) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute(this.HIGHLIGHT_ATTRIBUTE)) {
        e.preventDefault();
        const highlightId = target.getAttribute(this.HIGHLIGHT_ATTRIBUTE);

        if (highlightId) {
          const highlights = await SentenceHighlightStorage.getHighlights(window.location.href);
          const highlightData = highlights.find(h => h.id === highlightId);

          if (highlightData) {
            eventManager.emit('show-sentence-highlight-context-menu', {
              highlightData: highlightData,
              position: { x: e.clientX, y: e.clientY },
              target: target
            });
          }
        }
      }
    });
  }

  // 高亮选中的文本
  static async highlightSelection(currentSelection: any) {
    if (!currentSelection) {
      console.warn('No current selection available for sentence highlighting');
      return false;
    }

    const { range, text, context } = currentSelection;

    if (!text || text.trim().length === 0) {
      console.warn('No selected text for sentence highlighting');
      return false;
    }

    // 获取选中文本的起始位置
    const startContainer = range.startContainer;
    const startOffset = range.startOffset;

    // 获取配置的高亮颜色
    const color = await getConfiguredHighlightColor();

    // 创建句子高亮数据
    const highlightData: SentenceHighlightData = {
      id: `sentence_highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sentence: text,
      url: window.location.href,
      title: document.title,
      timestamp: Date.now(),
      textContent: startContainer.textContent || '',
      xpath: this.getElementXPath(startContainer),
      offset: startOffset,
      length: text.length,
      color: color
    };

    // 保存高亮数据
    await SentenceHighlightStorage.saveHighlight(highlightData);

    // 渲染高亮
    this.renderSingleHighlight(highlightData);

    console.log('Sentence highlighted successfully:', highlightData);
    return true;
  }

  // 获取元素的XPath
  private static getElementXPath(element: Node): string {
    if (element.nodeType === Node.TEXT_NODE) {
      element = element.parentNode!;
    }

    const parts: string[] = [];
    let current = element as Element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = current.previousElementSibling;

      while (sibling) {
        if (sibling.tagName === current.tagName) {
          index++;
        }
        sibling = sibling.previousElementSibling;
      }

      const tagName = current.tagName.toLowerCase();
      const pathIndex = index > 1 ? `[${index}]` : '';
      parts.unshift(`${tagName}${pathIndex}`);

      current = current.parentElement!;

      // 停止在body或html标签
      if (tagName === 'body' || tagName === 'html') {
        break;
      }
    }

    return '//' + parts.join('/');
  }
}