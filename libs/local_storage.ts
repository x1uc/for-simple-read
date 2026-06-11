import { WordData } from "./select_word";

export const DEFAULT_SENTENCE_HIGHLIGHT_COLOR = "#38BDF8";

// AI 配置持久化
export const ai_api_key_storage = storage.defineItem<string | null>("local:ai_api_key"); 
export const ai_api_url_storage = storage.defineItem<string | null>("local:ai_api_url");
export const ai_model_storage = storage.defineItem<string | null>("local:ai_model");
export const ai_word_model_storage = storage.defineItem<string | null>("local:ai_word_model");
export const ai_prompt_storage = storage.defineItem<string | null>("local:ai_prompt");

// 单词收藏持久化
export const collection_words_storage = storage.defineItem<WordData[]>("local:collection_words");

export const options_tab_storage = storage.defineItem<string>('local:options_tab')

// 句子高亮配置
export const sentence_highlight_color_storage = storage.defineItem<string>('local:sentence_highlight_color', {
  fallback: DEFAULT_SENTENCE_HIGHLIGHT_COLOR
})
