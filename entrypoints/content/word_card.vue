<template>
    <div class="bg-white border-1 border-gray-300 rounded-xl min-w-[420px] min-h-[60px] p-3 text-black">
        <div v-if="loading_flag" class="items-center justify-center flex h-full py-2">
            <div class="loading loading-dots lodding-sm"></div>
        </div>
        <div v-else class="flex justify-between items-center">
            <div class="flex items-center justify-center">
                <div class="text-xl font-bold">{{ ojb?.word }}</div>
                <div @click="playAudio"
                      class="text-xs text-gray-400 px-2 rounded-sm hover:bg-gray-100 cursor-pointer">
                    {{ ojb?.pronunciation }}
            </div>
            </div>
            <div class="flex items-center justify-center">
                <!-- 高亮按钮 -->
                <div @click="highlightWord"
                     title="高亮"
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
                <div @click="toggleFavorite"
                     title="收藏"
                     class="rounded p-2 text-sm cursor-pointer w-10 h-10 flex items-center justify-center select-none hover:bg-gray-100">
                    <svg v-if="!isFavorited" class="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none"
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

        <div class="py-2 text-sm text-justify" v-html="ojb?.meaning.replace(/\n/g, '<br>')"></div>
    </div>
</template>

<script lang="ts" setup>
import { inject, ref, onMounted } from 'vue';

let selected_word = inject('ojb') as any;
let eventManager = inject('eventManager') as any;
let cachedWordData = inject('cachedWordData', null) as any;

let loading_flag = ref<boolean>(true);

type WordData = {
    word: string;
    pronunciation: string;
    meaning: string;
};

let ojb = ref<WordData | null>(null);
const isFavorited = ref(false);

const fetch_word_data = async () => {
    try {
        if (cachedWordData) {
            console.log('Using cached word data:', cachedWordData);
            ojb.value = {
                word: cachedWordData.word,
                pronunciation: cachedWordData.pronunciation,
                meaning: cachedWordData.meaning
            };
            loading_flag.value = false;
            return;
        }
        const word = await selected_word.getValue();
        const url = new URL("https://telegram-bot.ergouli848.workers.dev");
        url.searchParams.append("password", "lxc123");
        url.searchParams.append("word", word);
        const res = await fetch(url, { method: "GET" });
        if (res.ok) {
            const data = await res.json();
            ojb.value = {
                word: data.word,
                pronunciation: '/' + data.pronunciation + '/',
                meaning: data.meaning
            };
        }
    } catch (error) {
        console.error("Error fetching word data:", error);
    } finally {
        loading_flag.value = false;
    }
};

const highlightWord = async () => {
    if (!ojb.value?.word) return;
    try {
        eventManager.emit('highlight-word', {
            word: ojb.value.word,
            wordData: ojb.value
        });
        eventManager.emit('close-word-card');
    } catch (error) {
        console.error('Error emitting highlight event:', error);
    }
};

const toggleFavorite = () => {
    if (!ojb.value) return;
    isFavorited.value = !isFavorited.value;
    // 可在此处触发收藏持久化逻辑，如 eventManager.emit('favorite-word', ojb.value)
};

const playAudio = () => {
    if (!ojb.value?.word) return;
    const utter = new SpeechSynthesisUtterance(ojb.value.word);
    utter.lang = "en-US";
    speechSynthesis.speak(utter);
};

onMounted(() => {
    fetch_word_data();
});
</script>
