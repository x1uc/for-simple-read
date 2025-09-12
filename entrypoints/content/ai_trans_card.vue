<template>
    <div class="w-150 min-h-70  border-1 rounded-lg shadow-2xl">
        <div>
            <div class="bg-gray-200 text-black font-bold text-lg p-2 rounded-t-lg">AI翻译</div>
            <div class="p-4 text-black text-base min-h-50 max-h-100 overflow-y-auto" v-html="content.replace(/\n/g, '<br>')"></div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { OpenAI } from "openai";
import { inject } from "vue";


const openai = new OpenAI({
    apiKey: import.meta.env.WXT_AI_API_KEY,
    baseURL: "https://api.deepseek.com",
    dangerouslyAllowBrowser: true
});

const content = ref<string>('');


export type ai_stream_from_contentscript = {
    type: 'start',
    message: string
};

export type ai_stream_from_backgroud = {
    type: 'chunk',
    text: string
} | {
    type: 'done'
} | {
    type: 'error',
    error: string
}

const test_func = async () => {
    const stream = await openai.chat.completions.create({
        model: "deepseek-chat",
        stream: true,
        messages: [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": "Hello Nice to meet you.Are you OK" }
        ]
    });
    for await (const chunk of stream) {
        const now_text = chunk.choices[0].delta.content;
        content.value += now_text;
        console.log(now_text);
    }
}

onMounted(() => {
    test_func();
});

</script>