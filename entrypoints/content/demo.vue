<template>
    <div class="bg-white border-1 border-gray-300 rounded-xl min-w-80 max-w-120 min-h-20 p-4 text-black">
        <div class="flex justify-between items-center">
            <div class="flex items-center space-x-2">
                <div class="text-2xl font-bold">{{ ojb.word }}</div>
                <div class="text-sm bg-gray-200 rounded-sm px-2 py-1">{{ ojb.pronounce }}</div>
            </div>
            <div
                class="bg-gray-200 rounded px-1 text-base cursor-pointer  hover:bg-orange-500 hover:bg-opacity-50 transition-colors duration-200">
                ⭐️收藏</div>
        </div>
    </div>
</template>


<script lang="ts" setup>
import { ref } from 'vue';
const ojb = ref({
    word: 'example',
    pronounce: '/ɪɡˈzɑːmpəl/',
    meaning: 'A thing characteristic of its kind or illustrating a general rule.',
})
</script>