<template>
    <div class="flex w-35 h-10 border-2 justify-around items-center">
        <div @click="handleWordClick"
            class="w-[45%] h-[90%] cursor-pointer bg-red-200 justify-center items-center flex active:bg-red-400 select-none">
            单词
        </div>
        <div
            class="w-[45%] h-[90%] cursor-pointer bg-green-200 flex justify-center items-center active:bg-green-400 select-none">
            翻译
        </div>
    </div>
</template>

<script lang="ts" setup>
import { inject } from 'vue';

const eventManager: any = inject('eventManager');

const handleWordClick = () => {
    // 2. 使用 eventManager 发送事件
    eventManager.emit('show-word-card');
};
</script>