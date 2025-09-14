// 高亮数据的接口定义
export interface HighlightData {
  id: string;
  word: string;
  url: string;
  timestamp: number;
  textContent: string; // 高亮文本的前后文本内容，用于定位
  xpath: string; // 元素的xpath路径
  offset: number; // 在文本节点中的偏移位置
  length: number; // 高亮文本的长度
  // 新增：缓存的单词详细信息
  wordData?: {
    word: string;
    pronunciation: string;
    meaning: string;
  };
}

// 定义存储项
const highlightStorage = storage.defineItem<string>('local:highlight_words', {
  fallback: '[]'
});

// 高亮数据存储管理类
export class HighlightStorage {
  // 获取当前页面的所有高亮数据
  static async getHighlights(url: string): Promise<HighlightData[]> {
    try {
      const stored = await highlightStorage.getValue();
      const allHighlights: HighlightData[] = JSON.parse(stored);
      return allHighlights.filter(highlight => highlight.url === url);
    } catch (error) {
      console.error('Error getting highlights:', error);
      return [];
    }
  }

  // 保存高亮数据
  static async saveHighlight(highlightData: HighlightData): Promise<void> {
    try {
      const stored = await highlightStorage.getValue();
      const allHighlights: HighlightData[] = JSON.parse(stored);
      
      // 检查是否已存在相同的高亮
      const existingIndex = allHighlights.findIndex(h => 
        h.url === highlightData.url && 
        h.xpath === highlightData.xpath && 
        h.offset === highlightData.offset &&
        h.word === highlightData.word
      );

      if (existingIndex === -1) {
        allHighlights.push(highlightData);
        await highlightStorage.setValue(JSON.stringify(allHighlights));
      }
    } catch (error) {
      console.error('Error saving highlight:', error);
    }
  }

  // 删除高亮数据
  static async removeHighlight(id: string): Promise<void> {
    try {
      const stored = await highlightStorage.getValue();
      const allHighlights: HighlightData[] = JSON.parse(stored);
      const filtered = allHighlights.filter(h => h.id !== id);
      await highlightStorage.setValue(JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing highlight:', error);
    }
  }

  // 获取所有高亮数据
  static async getAllHighlights(): Promise<HighlightData[]> {
    try {
      const stored = await highlightStorage.getValue();
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error getting all highlights:', error);
      return [];
    }
  }

  // 清空指定URL的所有高亮数据
  static async clearHighlights(url: string): Promise<void> {
    try {
      const stored = await highlightStorage.getValue();
      const allHighlights: HighlightData[] = JSON.parse(stored);
      const filtered = allHighlights.filter(h => h.url !== url);
      await highlightStorage.setValue(JSON.stringify(filtered));
    } catch (error) {
      console.error('Error clearing highlights:', error);
    }
  }
}

// 生成唯一ID
export function generateHighlightId(): string {
  return `highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 获取元素的XPath
export function getElementXPath(element: Node): string {
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

// 根据XPath查找元素
export function getElementByXPath(xpath: string): Element | null {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue as Element;
  } catch (error) {
    console.error('Error finding element by XPath:', error);
    return null;
  }
}
