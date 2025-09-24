<template>
  <div class="max-w-3xl mx-auto p-4 space-y-4">
    <!-- Tabs -->
    <div role="tablist" class="tabs tabs-boxed">
      <a role="tab" :class="['tab', page_flag === 'ai' && 'tab-active']" @click="switchTab('ai')">
        AI 翻译
      </a>
      <a role="tab" :class="['tab', page_flag === 'collect' && 'tab-active']" @click="switchTab('collect')">
        收藏设置
      </a>
      <a role="tab" :class="['tab', page_flag === 'word' && 'tab-active']" @click="switchTab('word')">
        生词本
      </a>
    </div>

    <!-- AI Settings -->
    <div v-if="page_flag === 'ai'">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">AI 配置</h2>
          <div class="divider"></div>
          <div v-if="message" :class="['alert', messageType === 'success' ? 'alert-success' : 'alert-error']">
            <span>{{ message }}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="label py-1">
                <span class="label-text">API 接口地址</span>
              </label>
              <input type="text" v-model="apiUrl" placeholder="https://api.example.com"
                class="input input-bordered w-full" />
            </div>

            <div>
              <label class="label">
                <span class="label-text py-1">SECRET KEY</span>
              </label>
              <input type="password" v-model="apiKey" placeholder="sk-xxxx" class="input w-full" />
            </div>

            <div>
              <label class="label">
                <span class="label-text py-1">AI 模型（翻译用）</span>
              </label>
              <input type="text" v-model="model" placeholder="gpt-4o" class="input w-full" />
            </div>
            
            <div>
              <label class="label">
                <span class="label-text py-1">AI 模型（查词用）</span>
              </label>
              <input type="text" v-model="word_model" placeholder="gpt-4o" class="input w-full" />
            </div>

            <div class="md:col-span-2">
              <label class="label">
                <span class="label-text py-1">Prompt</span>
              </label>
              <textarea v-model="prompt" class="textarea w-full min-h-28"
                placeholder="如果不想使用默认，请输入你想在 AI 翻译中使用的 Prompt"></textarea>
            </div>
          </div>

          <div class="card-actions justify-end mt-2 py-2">
            <button class="btn btn-secondary" :class="{ 'btn-disabled': testing }" @click="handleTest">
              <span v-if="testing" class="loading loading-spinner loading-sm"></span>
              <span>测试 API</span>
            </button>
            <button class="btn btn-primary" :class="{ 'btn-disabled': saving }" @click="handleSave">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              <span>保存设置</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Collect Settings -->
    <div v-else-if="page_flag === 'collect'">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">收藏设置</h2>
          <div class="divider"></div>
          <div v-if="message" :class="['alert', messageType === 'success' ? 'alert-success' : 'alert-error']">
            <span>{{ message }}</span>
          </div>
          <div class="grid grid-cols-1 gap-4">
            <div class="flex items-center">
              <div class="px-2">
                生词收藏到欧路词典生词本
              </div>
              <div>
                <input type="checkbox" :checked="eudic_switch" @change="handleOpenEudicCollect" class="toggle" />
              </div>
            </div>
            <div v-if="eudic_switch" class="flex-1 ml-2">
              <div>
                <input type="text" v-model="eudic_token" placeholder="欧路词典授权信息（格式示例：NIS XXXXXXXXX）"
                  class="input input-bordered w-full" />
              </div>
              <div class="my-1">
                <a class="text-blue-300" href="https://my.eudic.net/OpenAPI/Authorization">获取欧路授权信息地址</a>
                我的个人主页>获取授权
              </div>
            </div>
          </div>

          <div class="card-actions justify-end mt-2 py-2">
            <button class="btn btn-primary" :class="{ 'btn-disabled': saving }" @click="handle_save_collection">
              <span v-if="saving" class="loading loading-spinner loading-sm"></span>
              <span>保存设置</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Collect Settings -->
    <div v-else-if="page_flag === 'word'">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title">收藏列表</h2>
          <div class="divider"></div>
          <div>
            <div v-for="word_data of collection_words">
              {{ word_data.word }} - {{ word_data.meaning }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 测试 API 结果弹窗 -->
    <dialog ref="testDialog" class="modal">
      <div class="modal-box max-w-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="font-bold text-lg">API 测试</h3>
            <span v-if="testing" class="loading loading-dots loading-sm"></span>
            <div class="badge" :class="isError ? 'badge-error' : 'badge-success'">
              {{ isError ? '错误' : (testing ? '测试中' : 'API可用！') }}
            </div>
          </div>
          <button class="btn btn-sm btn-circle btn-ghost" @click="closeTestDialog">✕</button>
        </div>

        <div class="mt-3">
          <div v-if="isError" class="alert alert-error">
            <span>{{ content }}</span>
          </div>
          <div v-else class="border rounded-2xl p-4 bg-gray-50">
            <div className="chat chat-start">
              <div className="chat-bubble chat-bubble-primary">{{ test_question }}</div>
            </div>
            <div className="chat chat-end">
              <div className="chat-bubble chat-bubble-info">{{ content }}</div>
            </div>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button aria-label="close">close</button>
      </form>
    </dialog>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import {
  ai_api_url_storage, ai_api_key_storage, ai_model_storage, ai_word_model_storage, ai_prompt_storage,
  youdao_token_storage, eudic_token_storage, eudic_switch_storage, collection_words_storage, options_tab_storage
} from '@/libs/local_storage'
import { WordData } from '@/libs/select_word'
import { OpenAI } from "openai";

type Tab = 'ai' | 'collect' | 'word'
const page_flag = ref<Tab>('ai')

const apiUrl = ref<string>('')
const apiKey = ref<string>('')
const model = ref<string>('')
const prompt = ref<string>('')
const word_model = ref<string>('')
const youdao_token = ref<string>('')
const eudic_token = ref<string>('')
const eudic_switch = ref<boolean>(false)
const collection_words = ref<WordData[]>([])

const testing = ref(false)
const saving = ref(false)
const message = ref<string>('')
const messageType = ref<'success' | 'error'>('success')


let content = ref<string>('')
const test_question = ref<string>('你好，我想测试一下你是否可用！')
const isError = ref(false)
const testDialog = ref<HTMLDialogElement | null>(null)

const openTestDialog = () => testDialog.value?.showModal()
const closeTestDialog = () => testDialog.value?.close()

onMounted(async () => {
  try {
    // 读取保存的tab状态，如果没读到则使用默认值 'ai'
    const savedTab = await options_tab_storage.getValue()
    page_flag.value = (savedTab as Tab) || 'ai'
    
    apiUrl.value = await ai_api_url_storage.getValue() || ''
    apiKey.value = await ai_api_key_storage.getValue() || ''
    model.value = await ai_model_storage.getValue() || ''
    word_model.value = await ai_word_model_storage.getValue() || ''
    prompt.value = await ai_prompt_storage.getValue() || ''
    youdao_token.value = await youdao_token_storage.getValue() || ''
    eudic_token.value = await eudic_token_storage.getValue() || ''
    eudic_switch.value = await eudic_switch_storage.getValue() || false
    collection_words.value = await collection_words_storage.getValue() || []
  } catch {
    console.warn('Failed to load saved settings')
  }
})

// 新增：切换tab并保存状态
const switchTab = async (tab: Tab) => {
  page_flag.value = tab
  try {
    await options_tab_storage.setValue(tab)
  } catch {
    console.warn('Failed to save tab state')
  }
}

const notify = (msg: string, type: 'success' | 'error' = 'success') => {
  message.value = msg
  messageType.value = type
  setTimeout(() => (message.value = ''), 2500)
}

const handleSave = async () => {
  try {
    saving.value = true
    if (!apiUrl.value?.trim() || !apiKey.value?.trim() || !model.value?.trim() || !word_model.value?.trim()) {
      notify('请填写 API 调用信息', 'error')
      return
    }
    await ai_api_url_storage.setValue(apiUrl.value.trim())
    await ai_api_key_storage.setValue(apiKey.value.trim())
    await ai_model_storage.setValue(model.value.trim())
    await ai_word_model_storage.setValue(word_model.value.trim() || null)
    await ai_prompt_storage.setValue(prompt.value.trim() || null)
    notify('已保存')
  } catch (e) {
    notify('保存失败', 'error')
  } finally {
    saving.value = false
  }
}

const handle_save_collection = async () => {
  try {
    saving.value = true
    if (eudic_switch.value && !eudic_token.value?.trim()) {
      notify('请填写欧路词典授权信息', 'error')
      return
    }
    await eudic_token_storage.setValue(eudic_token.value.trim() || null)
    await eudic_switch_storage.setValue(eudic_switch.value)
    notify('已保存')
  } catch (e) {
    notify('保存失败', 'error')
  } finally {
    saving.value = false
  }
}

const handleTest = async () => {
  if (!apiUrl.value?.trim() || !apiKey.value?.trim() || !model.value?.trim()) {
    isError.value = true
    content.value = 'API接口地址、AI模型、SecRetKey不能为空'
    openTestDialog()
    return
  }
  content.value = ''
  isError.value = false
  testing.value = true
  openTestDialog()

  try {
    const openai = new OpenAI({
      apiKey: apiKey.value.trim(),
      baseURL: apiUrl.value.trim(),
      dangerouslyAllowBrowser: true
    })

    const ai_stream = await openai.chat.completions.create({
      model: model.value.trim(),
      stream: true,
      messages: [
        { role: "user", content: test_question.value },
      ]
    })

    for await (const chunk of ai_stream) {
      const now_text = chunk?.choices?.[0]?.delta?.content ?? ''
      if (now_text) content.value += now_text
    }
  } catch (e: any) {
    isError.value = true
    content.value = e?.message || '请求失败'
  } finally {
    testing.value = false
  }
}

const handleOpenEudicCollect = () => {
  eudic_switch.value = !eudic_switch.value
  eudic_switch_storage.setValue(eudic_switch.value)
}
</script>

<style scoped>
/* 可按需添加微调样式 */
</style>