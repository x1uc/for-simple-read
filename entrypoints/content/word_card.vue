<template>
    <div class="bg-white border-1 border-gray-300 rounded-xl min-w-[360px] max-w-[450px] min-h-[60px] p-3 text-black">
        <div v-if="loading_flag" class="items-center justify-center flex h-full py-2">
            <div class="loading loading-dots lodding-sm"></div>
        </div>
        <div v-else class="flex justify-between items-center">
            <div class="flex items-center space-x-2">
                <div class="text-xl font-bold">{{ ojb?.word }}</div>
                <!-- 点击播放发音 -->
                <div @click="playAudio"
                    class="text-xs bg-gray-200 rounded-sm px-2 py-1 hover:bg-green-300 hover:bg-opacity-50 cursor-pointer transition-colors duration-100">
                    {{ ojb?.pronunciation }}
                </div>
            </div>
            <div class="flex items-center justify-center">
                <div @click="highlightWord"
                    class="bg-gray-200 rounded mx-1 px-3 py-1 text-sm cursor-pointer hover:bg-yellow-200 hover:bg-opacity-50 transition-colors duration-200 w-[60px] flex items-center justify-center select-none">
                    高亮
                </div>
                <div
                    class="bg-gray-200 rounded px-3 py-1 text-sm cursor-pointer hover:bg-yellow-400 hover:bg-opacity-50 transition-colors duration-200 w-[60px] flex items-center justify-center select-none">
                    收藏
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
let cachedWordData = inject('cachedWordData', null) as any; // 注入缓存的单词数据

let loading_flag = ref<boolean>(true);

type WordData = {
    word: string;
    pronunciation: string;
    meaning: string;
};

let ojb = ref<WordData | null>(null);

const fetch_word_data = async () => {
    try {
        // 如果有缓存的数据，直接使用
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

        // 没有缓存数据，从API获取
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

// 高亮当前选中的单词
const highlightWord = async () => {
    console.log('Preparing to highlight word');
    if (!ojb.value?.word) return;

    try {
        // 通过 eventManager 发送高亮事件，传递完整的单词数据
        eventManager.emit('highlight-word', {
            word: ojb.value.word,
            wordData: ojb.value  // 传递完整的单词数据进行缓存
        });

        // 关闭单词卡片
        eventManager.emit('close-word-card');
    } catch (error) {
        console.error('Error emitting highlight event:', error);
    }
};

// 播放发音
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
