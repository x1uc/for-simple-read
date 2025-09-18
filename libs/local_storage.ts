export const ai_api_key_storage = storage.defineItem<string | null>("local:ai_api_key"); 
export const ai_api_url_storage = storage.defineItem<string | null>("local:ai_api_url");
export const ai_model_storage = storage.defineItem<string | null>("local:ai_model");
export const ai_prompt_storage = storage.defineItem<string | null>("local:ai_prompt");

export const youdao_token_storage = storage.defineItem<string | null>("local:youdao_token");
export const youdao_switch_storage = storage.defineItem<boolean>("local:youdao_switch");
export const eudic_token_storage = storage.defineItem<string | null>("local:eudic_token");
export const eudic_switch_storage = storage.defineItem<boolean>("local:eudic_switch");

