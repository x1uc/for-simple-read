export interface SentenceHighlightData {
  id: string;
  url: string;
  title: string;
  timestamp: number;
  startXPath: string;
  endXPath: string;
  startOffset: number;
  endOffset: number;
  exact: string;
  prefix: string;
  suffix: string;
  color?: string;
  note?: string;
}

// 定义存储项
const sentenceHighlightStorage = storage.defineItem<string>('local:sentence_highlights', {
  fallback: '[]'
});

// 句子高亮数据存储管理类
export class SentenceHighlightStorage {
  private static isValidHighlight(data: any): data is SentenceHighlightData {
    return !!data
      && typeof data.id === 'string'
      && typeof data.url === 'string'
      && typeof data.title === 'string'
      && typeof data.timestamp === 'number'
      && typeof data.startXPath === 'string'
      && typeof data.endXPath === 'string'
      && typeof data.startOffset === 'number'
      && typeof data.endOffset === 'number'
      && typeof data.exact === 'string'
      && typeof data.prefix === 'string'
      && typeof data.suffix === 'string';
  }

  private static async getRawHighlights(): Promise<SentenceHighlightData[]> {
    const stored = await sentenceHighlightStorage.getValue();
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => this.isValidHighlight(item));
  }

  // 获取当前页面的所有句子高亮数据
  static async getHighlights(url: string): Promise<SentenceHighlightData[]> {
    try {
      const allHighlights = await this.getRawHighlights();
      return allHighlights.filter(highlight => highlight.url === url);
    } catch (error) {
      console.error('Error getting sentence highlights:', error);
      return [];
    }
  }

  // 保存句子高亮数据
  static async saveHighlight(highlightData: SentenceHighlightData): Promise<void> {
    try {
      if (!this.isValidHighlight(highlightData)) {
        console.warn('Invalid sentence highlight payload:', highlightData);
        return;
      }

      const allHighlights = await this.getRawHighlights();

      // 检查是否已存在相同的高亮
      const existingIndex = allHighlights.findIndex(h =>
        h.url === highlightData.url &&
        h.startXPath === highlightData.startXPath &&
        h.startOffset === highlightData.startOffset &&
        h.exact === highlightData.exact &&
        h.prefix === highlightData.prefix &&
        h.suffix === highlightData.suffix
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
      const allHighlights = await this.getRawHighlights();
      const filtered = allHighlights.filter(h => h.id !== id);
      await sentenceHighlightStorage.setValue(JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing sentence highlight:', error);
    }
  }

  // 更新句子高亮数据
  static async updateHighlight(id: string, updates: Partial<SentenceHighlightData>): Promise<void> {
    try {
      const allHighlights = await this.getRawHighlights();
      const index = allHighlights.findIndex(h => h.id === id);

      if (index !== -1) {
        const merged = { ...allHighlights[index], ...updates };
        if (!this.isValidHighlight(merged)) {
          console.warn('Invalid sentence highlight updates ignored:', updates);
          return;
        }
        allHighlights[index] = merged;
        await sentenceHighlightStorage.setValue(JSON.stringify(allHighlights));
      }
    } catch (error) {
      console.error('Error updating sentence highlight:', error);
    }
  }

  // 获取所有句子高亮数据
  static async getAllHighlights(): Promise<SentenceHighlightData[]> {
    try {
      return await this.getRawHighlights();
    } catch (error) {
      console.error('Error getting all sentence highlights:', error);
      return [];
    }
  }

  // 清空指定URL的所有句子高亮数据
  static async clearHighlights(url: string): Promise<void> {
    try {
      const allHighlights = await this.getRawHighlights();
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
