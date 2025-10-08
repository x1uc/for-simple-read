<template>
  <div class="w-80 p-4">
    <!-- Header with settings button -->
    <div class="flex justify-end items-center mb-6" @click="openSettings">
      <div> 
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor"
          stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    </div>

    <!-- Tab buttons -->
    <div class="grid grid-cols-2 gap-3">
      <button class="tab-button" @click="openOptionsTab('ai')">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span class="text-sm">AI 翻译</span>
      </button>

      <button class="tab-button" @click="openOptionsTab('collect')">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <span class="text-sm">收藏设置</span>
      </button>

      <button class="tab-button" @click="openOptionsTab('word')">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <span class="text-sm">生词本</span>
      </button>

      <button class="tab-button" @click="openOptionsTab('sentence')">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <span class="text-sm">句子高亮</span>
      </button>

    </div>
  </div>
</template>

<script lang="ts" setup>
import { options_tab_storage } from "@/libs/local_storage";

// 打开选项页面并设置tab
const openOptionsWithTab = async (tabName: string) => {
  await options_tab_storage.setValue(tabName);
  browser.runtime.openOptionsPage();
};

// 打开设置页面（不指定tab）
const openSettings = () => {
  browser.runtime.openOptionsPage();
};

// 打开选项页面并跳转到指定tab
const openOptionsTab = async (tabName: string) => {
  await openOptionsWithTab(tabName);
};

</script>

<style scoped>
.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  height: 5rem;
  padding: 1rem;
  border: 1.5px solid #e5e7eb;
  border-radius: 0.5rem;
  background: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button:hover {
  border-color: #6366f1;
  color: #6366f1;
  background: #f5f3ff;
}

.tab-button:active {
  background: #ede9fe;
}
</style>