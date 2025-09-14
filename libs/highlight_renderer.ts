import { HighlightStorage, getElementByXPath, type HighlightData } from './highlight_storage';
import { EventManager } from './event_manager';
import { select_word_storage } from './select_word';

// 高亮渲染类
export class HighlightRenderer {
  private static readonly HIGHLIGHT_ATTRIBUTE = 'data-highlight-id';

  // 渲染所有高亮
  static async renderHighlights() {
    try {
      // 先清除现有高亮
      this.clearHighlights();
      
      // 获取当前页面的高亮数据
      const highlights = await HighlightStorage.getHighlights(window.location.href);
      
      // 渲染每个高亮
      for (const highlight of highlights) {
        await this.renderSingleHighlight(highlight);
      }
    } catch (error) {
      console.error('Error rendering highlights:', error);
    }
  }

  static async renderSingleHighlight(highlight: HighlightData) {
    try {
      const element = getElementByXPath(highlight.xpath);
      
      if (!element) {
        console.warn('Element not found for highlight:', highlight);
        return;
      }

      // 查找包含目标文本的文本节点
      const textNodes = this.getTextNodesInElement(element);
      
      for (const textNode of textNodes) {
        if (textNode.textContent && textNode.textContent.includes(highlight.word)) {
          this.highlightTextInNode(textNode, highlight);
          break;
        }
      }
    } catch (error) {
      console.error('Error rendering single highlight:', error);
    }
  }

  // 在文本节点中高亮指定文本
  static highlightTextInNode(textNode: Text, highlight: HighlightData) {
    const text = textNode.textContent || '';
    const wordIndex = text.toLowerCase().indexOf(highlight.word.toLowerCase());
    
    if (wordIndex === -1) return;

    // 创建高亮元素，使用内联样式
    const highlightSpan = document.createElement('span');
    highlightSpan.setAttribute(this.HIGHLIGHT_ATTRIBUTE, highlight.id);
    highlightSpan.textContent = text.substring(wordIndex, wordIndex + highlight.word.length);
    
    // 使用内联样式
    highlightSpan.style.cssText = `
      background-color: rgba(255, 255, 0, 0.3) !important;
      border-radius: 3px !important;
      padding: 1px 2px !important;
      cursor: pointer !important;
      transition: background-color 0.2s ease !important;
    `;
    
    // 添加鼠标悬停效果
    highlightSpan.addEventListener('mouseenter', () => {
      highlightSpan.style.backgroundColor = 'rgba(255, 255, 0, 0.5)';
      highlightSpan.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    });
    
    highlightSpan.addEventListener('mouseleave', () => {
      highlightSpan.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
      highlightSpan.style.boxShadow = 'none';
    });
    
    // 分割文本节点
    const beforeText = text.substring(0, wordIndex);
    const afterText = text.substring(wordIndex + highlight.word.length);
    
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

  // 清除所有高亮
  static clearHighlights() {
    // 通过属性选择器找到所有高亮元素
    const highlightElements = document.querySelectorAll(`[${this.HIGHLIGHT_ATTRIBUTE}]`);
    highlightElements.forEach(element => {
      const parent = element.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(element.textContent || ''), element);
        parent.normalize(); // 合并相邻的文本节点
      }
    });
  }

  // 为高亮元素添加点击事件监听
  static addHighlightClickListeners(eventManager: EventManager) {
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      // 检查是否是高亮元素（通过属性判断）
      if (target.hasAttribute(this.HIGHLIGHT_ATTRIBUTE)) {
        const word = target.textContent?.trim();
        const highlightId = target.getAttribute(this.HIGHLIGHT_ATTRIBUTE);
        
        if (word && highlightId) {
          try {
            // 获取高亮数据
            const highlights = await HighlightStorage.getHighlights(window.location.href);
            const highlightData = highlights.find(h => h.id === highlightId);
            
            // 计算正确的弹窗位置
            const rect = target.getBoundingClientRect();
            const position = {
              x: rect.left + window.scrollX,
              y: rect.bottom + window.scrollY + 5 // 在高亮元素下方5px
            };
            
            if (highlightData && highlightData.wordData) {
              // 如果有缓存的单词数据，直接使用
              console.log('Using cached word data:', highlightData.wordData);
              
              // 触发显示缓存单词卡片事件
              eventManager.emit('show-cached-word-card', {
                wordData: highlightData.wordData,
                position: position
              });
            } else {
              // 没有缓存数据，使用原来的方式
              select_word_storage.setValue(word);
              // 创建一个虚拟的选择来获取位置
              const range = document.createRange();
              range.selectNodeContents(target);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
              
              // 触发显示单词卡片事件
              eventManager.emit('show-word-card');
            }
          } catch (error) {
            console.error('Error handling highlight click:', error);
            // 出错时回退到原来的方式
            select_word_storage.setValue(word);
            eventManager.emit('show-word-card');
          }
        }
      }
    });
  }
}
