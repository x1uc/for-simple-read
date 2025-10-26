<template>
    <div class="bg-white border border-gray-200 rounded-xl shadow-lg  min-w-100 min-h-15 p-3 text-black">
        <transition name="fade-scale" mode="out-in">
            <!-- Loading View -->
            <div v-if="loading_flag" key="loading" class="flex flex-col gap-3 py-2">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="skeleton h-6 w-24 rounded"></div>
                        <div class="skeleton h-4 w-16 rounded"></div>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="skeleton h-8 w-8 rounded"></div>
                        <div class="skeleton h-8 w-8 rounded"></div>
                    </div>
                </div>
                <div class="skeleton h-4 w-4/12 rounded"></div>
            </div>

            <!-- Content View -->
            <div v-else key="content">
                <div class="flex justify-between items-center">
                    <div class="flex items-center justify-center">
                        <div class="text-xl font-bold">{{ wordData?.word }}</div>
                        <div @click="playAudio"
                            class="text-xs text-gray-400 px-2 rounded-sm hover:bg-gray-100 cursor-pointer">
                            {{ wordData?.pronunciation }}
                        </div>
                    </div>
                    <div class="flex items-center justify-center">
                        <!-- 高亮按钮 -->
                        <div @click="highlightWord" title="高亮"
                            class="rounded mx-1 p-2 text-sm cursor-pointer hover:bg-gray-100 w-10 h-10 flex items-center justify-center select-none">
                            <svg class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M9 11l6-6 3 3-6 6H9v-3z"></path>
                                <path d="M13 5l3 3"></path>
                                <path d="M8 17h8"></path>
                                <path d="M6 21h12"></path>
                            </svg>
                        </div>
                        <!-- 收藏按钮 -->
                        <div @click="collect_words" title="收藏"
                            class="rounded p-2 text-sm cursor-pointer w-10 h-10 flex items-center justify-center select-none hover:bg-gray-100">
                            <svg v-if="!is_collected" class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none"
                                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                aria-hidden="true">
                                <path
                                    d="M12 17.3l-5.4 3.3 1.5-6.1L3 9.9l6.3-.5L12 3.8l2.7 5.6 6.3.5-5.1 4.6 1.5 6.1z" />
                            </svg>
                            <svg v-else class="w-5 h-5 text-yellow-600" viewBox="0 0 24 24" fill="currentColor"
                                aria-hidden="true">
                                <path
                                    d="M12 17.3l-5.4 3.3 1.5-6.1L3 9.9l6.3-.5L12 3.8l2.7 5.6 6.3.5-5.1 4.6 1.5 6.1z" />
                            </svg>
                        </div>
                    </div>
                </div>
                <div class="py-2 text-sm text-justify fade-in" v-html="wordData?.meaning"></div>
            </div>
        </transition>
    </div>
</template>

<script lang="ts" setup>
import { inject, ref, onMounted } from 'vue';
import { OpenAI } from "openai";
import { collect_word } from '@/libs/word_collector';
import { WordData } from '@/libs/select_word';
import { ai_api_key_storage, ai_api_url_storage, ai_word_model_storage, ai_prompt_storage, collection_words_storage } from "@/libs/local_storage";

let selected_word = inject('selectedWord') as any;
let eventManager = inject('eventManager') as any;
let cachedWordData = inject('cachedWordData', null) as any;

let loading_flag = ref<boolean>(true);

let wordData = ref<WordData | null>(null);
const is_collected = ref(false);

const default_prompt =
    `
You are an assistant that extracts dictionary-like information.

I will give you a word and its context.  
Return the result strictly as a JSON object with the following TypeScript type:

export type WordData = {
    word: string;
    pronunciation: string;
    meaning: string;
};

Rules:
- Do not include anything outside the JSON.
- "word": exactly the given word.
- "pronunciation": return the phonetic transcription in IPA if possible (e.g., "/wɜːd/"), otherwise leave it as an empty string.
- "meaning": give the chinese meaning of the word in the provided context, concise but clear.just the word meaning, don't include context, this is important.
`

const check_api_config = async () => {
    if (!await ai_api_key_storage.getValue()) {
        wordData.value = {
            word: "Error",
            pronunciation: "",
            meaning: "Please set your OpenAI API key in the settings."
        };
        return false;
    }
    if (!await ai_api_url_storage.getValue()) {
        wordData.value = {
            word: "Error",
            pronunciation: "",
            meaning: "Please set your OpenAI API key in the settings."
        };
        return false;
    }
    if (!await ai_word_model_storage.getValue()) {
        wordData.value = {
            word: "Error",
            pronunciation: "",
            meaning: "Please set your OpenAI API key in the settings."
        };
        return false;
    }
    return true;
};

const ai_trans = async () => {
    if (!await check_api_config()) {
        loading_flag.value = false;
        return;
    }
    if (cachedWordData) {
        wordData.value = {
            word: cachedWordData.word,
            pronunciation: cachedWordData.pronunciation,
            meaning: cachedWordData.meaning
        };
        is_collected.value = await f_is_collected();
        loading_flag.value = false;
        return;
    }
    const cur_api_url = await ai_api_url_storage.getValue();
    const cur_model = await ai_word_model_storage.getValue();
    const cur_api_key = await ai_api_key_storage.getValue();
    const cur_prompt = await ai_prompt_storage.getValue() || default_prompt;
    const openai = new OpenAI({
        apiKey: cur_api_key!,
        baseURL: cur_api_url!,
        dangerouslyAllowBrowser: true
    });
    const word_info = await selected_word.getValue();
    console.log("Selected word info:", word_info.word, word_info.context);
    const response = await openai.chat.completions.create({
        model: cur_model!,
        messages: [
            { "role": "system", "content": cur_prompt },
            { "role": "user", "content": `Word: ${word_info.word} Context: ${word_info.context}` }
        ],
        response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const word_obj = JSON.parse(content!) as WordData;
    wordData.value = word_obj;
    await f_is_collected();
    loading_flag.value = false;
}

const highlightWord = async () => {
    if (!wordData.value?.word) return;
    try {
        eventManager.emit('highlight-word', {
            word: wordData.value.word,
            wordData: wordData.value
        });
        eventManager.emit('close-word-card');
    } catch (error) {
        console.error('Error emitting highlight event:', error);
    }
};

const collect_words = async () => {
    if (!wordData.value) return;
    const collected = await f_is_collected();
    if (collected) {
        return;
    }
    await collection_words_storage.setValue([...await collection_words_storage.getValue() || [], wordData.value]);
    const word_info = await selected_word.getValue();
    collect_word(word_info.word, word_info.context);
    is_collected.value = true;
};

const f_is_collected = async () => {
    if (!wordData.value?.word) return true;
    try {
        const storedWords = await collection_words_storage.getValue() || [];
        is_collected.value = storedWords.some(item => item.word === wordData.value?.word);
        if (is_collected.value) {
            return true;
        }
    } catch (error) {
        console.error('Error checking if word is collected:', error);
    }
    return false;
};

const playAudio = () => {
    if (!wordData.value?.word) return;
    const utter = new SpeechSynthesisUtterance(wordData.value.word);
    utter.lang = "en-US";
    speechSynthesis.speak(utter);
};

onMounted(() => {
    ai_trans();
});
</script>

<style scoped>
.fade-scale-enter-active,
.fade-scale-leave-active {
    transition: opacity 180ms ease, transform 200ms ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
    opacity: 0;
    transform: scale(0.98);
}

.fade-scale-enter-to,
.fade-scale-leave-from {
    opacity: 1;
    transform: scale(1);
}

.fade-in {
    animation: fadeIn 220ms ease both;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(2px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
