<template>
    <div class="bg-white rounded-lg shadow-lg border border-gray-100 p-1 flex gap-1 min-w-[140px]">
        <button @click="eventManager.emit('show-word-card')"
            class="btn btn-sm btn-ghost flex-1 gap-1 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 border-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 1 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <span class="text-xs font-medium">单词</span>
        </button>
                
        <button @click="eventManager.emit('show-ai-trans-card')"
            class="btn btn-sm btn-ghost flex-1 gap-1 hover:bg-emerald-50 hover:text-emerald-600 transition-all duration-200 border-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                <path stroke-linecap="round" stroke-linejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
            </svg>
            <span class="text-xs font-medium">翻译</span>
        </button>
    </div>
</template>

<script lang="ts" setup>
import { inject } from 'vue';
const eventManager: any = inject('eventManager');
</script>