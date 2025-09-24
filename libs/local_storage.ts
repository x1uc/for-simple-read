import { WordData } from "./select_word";

// AI 配置持久化
export const ai_api_key_storage = storage.defineItem<string | null>("local:ai_api_key"); 
export const ai_api_url_storage = storage.defineItem<string | null>("local:ai_api_url");
export const ai_model_storage = storage.defineItem<string | null>("local:ai_model");
export const ai_word_model_storage = storage.defineItem<string | null>("local:ai_word_model");
export const ai_prompt_storage = storage.defineItem<string | null>("local:ai_prompt");

// 收藏单词Token配置
export const youdao_token_storage = storage.defineItem<string | null>("local:youdao_token");
export const youdao_switch_storage = storage.defineItem<boolean>("local:youdao_switch");
export const eudic_token_storage = storage.defineItem<string | null>("local:eudic_token");
export const eudic_switch_storage = storage.defineItem<boolean>("local:eudic_switch");

// 单词收藏持久化
export const collection_words_storage = storage.defineItem<WordData[]>("local:collection_words");

export const options_tab_storage = storage.defineItem<string>('local:options_tab')