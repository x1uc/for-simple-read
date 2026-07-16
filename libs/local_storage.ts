import { WordData } from "./select_word";

// AI 配置持久化
export const ai_api_key_storage = storage.defineItem<string | null>("local:ai_api_key");
export const ai_api_url_storage = storage.defineItem<string | null>("local:ai_api_url");
export const ai_model_storage = storage.defineItem<string | null>("local:ai_model");
export const ai_split_config_storage = storage.defineItem<boolean>("local:ai_split_config", {
  fallback: false,
});
export const ai_word_api_key_storage = storage.defineItem<string | null>("local:ai_word_api_key");
export const ai_word_api_url_storage = storage.defineItem<string | null>("local:ai_word_api_url");
export const ai_word_model_storage = storage.defineItem<string | null>("local:ai_word_model");
export const ai_prompt_storage = storage.defineItem<string | null>("local:ai_prompt");

// 单词收藏持久化
export const collection_words_storage = storage.defineItem<WordData[]>("local:collection_words");

// 云端生词同步配置
export const cloud_api_key_storage = storage.defineItem<string | null>("local:cloud_api_key");
export const cloud_device_name_storage = storage.defineItem<string>("local:cloud_device_name", {
  fallback: "default",
});
export const cloud_account_storage = storage.defineItem<{ username: string; hourlyLimit: number } | null>(
  "local:cloud_account",
);

export const options_tab_storage = storage.defineItem<string>('local:options_tab')

// AI 翻译弹窗尺寸持久化
export const ai_trans_card_size_storage = storage.defineItem<{ width: number; height: number } | null>(
  "local:ai_trans_card_size",
);
