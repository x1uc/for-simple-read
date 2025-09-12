<template>
    <div class="bg-white border-1 border-gray-300 rounded-xl min-w-100 max-w-150 min-h-20 p-4 text-black">
        <div class="flex justify-between items-center">
            <div class="flex items-center space-x-2">
                <div class="text-2xl font-bold">{{ ojb?.word }}</div>
                <div
                    class="text-sm bg-gray-200 rounded-sm px-2 py-1 hover:bg-green-300 hover:bg-opacity-50 cursor-pointer transition-colors duration-100">
                    {{ ojb?.pronunciation }}</div>
            </div>
            <div
                class="bg-gray-200 rounded px-1 text-base cursor-pointer  hover:bg-orange-500 hover:bg-opacity-50 transition-colors duration-200">
                ⭐️收藏</div>
        </div>
        <div class="py-2 text-base text-justify" v-html="ojb?.meaning.replace(/\n/g, '<br>')"></div>
    </div>
</template>


<script lang="ts" setup>
import { inject } from 'vue';
let selected_word = inject('ojb') as any;


type WordData = {
    word: string;
    pronunciation: string;
    meaning: string;
};

let ojb = ref<WordData | null>(null);

const fetch_word_data = async (word: string) => {
    word = await selected_word.getValue();
    console.log("test" + word);
    const url = new URL("https://telegram-bot.ergouli848.workers.dev");
    url.searchParams.append("password", "lxc123");
    url.searchParams.append("word", word);

    const res = await fetch(url, {
        method: "GET"
    });

    if (res.ok) {
        const data = await res.json();
        ojb.value = {
            word: data.word,
            pronunciation: '/' + data.pronunciation + '/',
            meaning: data.meaning
        };
    }
};

onMounted(() => {
        fetch_word_data('test');
});





</script>
