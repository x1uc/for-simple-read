// 句子高亮数据的接口定义
export interface SentenceHighlightData {
  id: string;
  sentence: string;
  url: string;
  title: string; // 网页标题
  timestamp: number;
  textContent: string; // 高亮文本的前后文本内容，用于定位
  xpath: string; // 元素的xpath路径
  offset: number; // 在文本节点中的偏移位置
  length: number; // 高亮文本的长度
  color?: string; // 高亮颜色
  note?: string; // 用户备注
}

// 定义存储项
const sentenceHighlightStorage = storage.defineItem<string>('local:sentence_highlights', {
  fallback: '[]'
});

// 句子高亮数据存储管理类
export class SentenceHighlightStorage {
  // 获取当前页面的所有句子高亮数据
  static async getHighlights(url: string): Promise<SentenceHighlightData[]> {
    try {
      const stored = await sentenceHighlightStorage.getValue();
      const allHighlights: SentenceHighlightData[] = JSON.parse(stored);
      return allHighlights.filter(highlight => highlight.url === url);
    } catch (error) {
      console.error('Error getting sentence highlights:', error);
      return [];
    }
  }

  // 保存句子高亮数据
  static async saveHighlight(highlightData: SentenceHighlightData): Promise<void> {
    try {
      const stored = await sentenceHighlightStorage.getValue();
      const allHighlights: SentenceHighlightData[] = JSON.parse(stored);

      // 检查是否已存在相同的高亮
      const existingIndex = allHighlights.findIndex(h =>
        h.url === highlightData.url &&
        h.xpath === highlightData.xpath &&
        h.offset === highlightData.offset &&
        h.sentence === highlightData.sentence
      );

      if (existingIndex === -1) {
        allHighlights.push(highlightData);
        await sentenceHighlightStorage.setValue(JSON.stringify(allHighlights));
      }
    } catch (error) {
      console.error('Error saving sentence highlight:', error);
    }
  }

  // 删除句子高亮数据
  static async removeHighlight(id: string): Promise<void> {
    try {
      const stored = await sentenceHighlightStorage.getValue();
      const allHighlights: SentenceHighlightData[] = JSON.parse(stored);
      const filtered = allHighlights.filter(h => h.id !== id);
      await sentenceHighlightStorage.setValue(JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing sentence highlight:', error);
    }
  }

  // 更新句子高亮数据
  static async updateHighlight(id: string, updates: Partial<SentenceHighlightData>): Promise<void> {
    try {
      const stored = await sentenceHighlightStorage.getValue();
      const allHighlights: SentenceHighlightData[] = JSON.parse(stored);
      const index = allHighlights.findIndex(h => h.id === id);

      if (index !== -1) {
        allHighlights[index] = { ...allHighlights[index], ...updates };
        await sentenceHighlightStorage.setValue(JSON.stringify(allHighlights));
      }
    } catch (error) {
      console.error('Error updating sentence highlight:', error);
    }
  }

  // 获取所有句子高亮数据
  static async getAllHighlights(): Promise<SentenceHighlightData[]> {
    try {
      const stored = await sentenceHighlightStorage.getValue();
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error getting all sentence highlights:', error);
      return [];
    }
  }

  // 清空指定URL的所有句子高亮数据
  static async clearHighlights(url: string): Promise<void> {
    try {
      const stored = await sentenceHighlightStorage.getValue();
      const allHighlights: SentenceHighlightData[] = JSON.parse(stored);
      const filtered = allHighlights.filter(h => h.url !== url);
      await sentenceHighlightStorage.setValue(JSON.stringify(filtered));
    } catch (error) {
      console.error('Error clearing sentence highlights:', error);
    }
  }
}

// 生成唯一ID
export function generateSentenceHighlightId(): string {
  return `sentence_highlight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 预定义的高亮颜色
export const HIGHLIGHT_COLORS = [
  '#FFF59D', // 黄色
  '#FFCCBC', // 橙色
  '#C8E6C9', // 绿色
  '#BBDEFB', // 蓝色
  '#E1BEE7', // 紫色
  '#FFCDD2', // 红色
  '#B2EBF2', // 青色
  '#D1C4E9', // 靛蓝色
];

// 获取配置的高亮颜色
export async function getConfiguredHighlightColor(): Promise<string> {
  try {
    const { sentence_highlight_color_storage } = await import('./local_storage');
    return await sentence_highlight_color_storage.getValue();
  } catch (error) {
    console.error('Error getting configured highlight color:', error);
    return '#FFF59D'; // 默认黄色
  }
}

// 通过XPath获取DOM元素
export function getElementByXPath(xpath: string): Element | null {
  return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue as Element | null;
}