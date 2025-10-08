<template>
  <div :class="['mx-auto p-4 space-y-4', page_flag === 'sentence' ? 'max-w-6xl' : 'max-w-3xl']">
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
      <a role="tab" :class="['tab', page_flag === 'sentence' && 'tab-active']" @click="switchTab('sentence')">
        句子高亮
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

    <!-- Wordbook -->
    <div v-else-if="page_flag === 'word'">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="card-title">收藏列表</h2>
              <p class="text-sm text-base-content/60">共 {{ wordCount }} 个单词</p>
            </div>
            <div class="flex items-center gap-2">
              <div class="badge" :class="eudic_switch ? 'badge-success' : 'badge-ghost'">
                {{ eudic_switch ? '远程同步已启用' : '远程同步未启用' }}
              </div>
              <button type="button" class="btn btn-outline btn-sm"
                :class="{ 'btn-disabled': !hasWords }" :disabled="!hasWords" @click="handleExportWords">
                导出单词
              </button>
              <button type="button" class="btn btn-primary btn-sm"
                :class="{ 'btn-disabled': syncing }" :disabled="syncing" @click="handleRemoteSync">
                <span v-if="syncing" class="loading loading-spinner loading-xs"></span>
                <span>同步所有单词</span>
              </button>
            </div>
          </div>
          <div v-if="message" :class="['alert', messageType === 'success' ? 'alert-success' : 'alert-error']">
            <span>{{ message }}</span>
          </div>
          <div class="divider my-0"></div>

          <div v-if="!hasWords" class="rounded-xl border border-dashed border-base-200 bg-base-200/40 p-6 text-center text-base-content/70">
            <p class="font-medium">暂未收藏单词</p>
            <p class="text-sm">在网页上选词并点击收藏后，将在此处展示。</p>
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="(word_data, idx) in collection_words"
              :key="`${word_data.word}-${idx}`"
              class="grid grid-cols-1 gap-3 rounded-2xl border border-base-200 bg-base-200/30 px-4 py-3 transition hover:border-base-300 hover:bg-base-100 md:grid-cols-[auto_auto_1fr_auto] md:items-center"
            >
              <div class="text-base font-semibold text-base-content md:text-lg">{{ word_data.word }}</div>
              <div class="text-sm text-base-content/60 md:text-base">{{ formatPronunciation(word_data.pronunciation) }}</div>
              <div
                class="text-sm text-base-content/80 md:text-base md:truncate"
                :title="formatMeaning(word_data.meaning)"
              >
                {{ formatMeaning(word_data.meaning) }}
              </div>
              <div class="flex justify-start md:justify-end gap-2">
                <button
                  type="button"
                  class="btn btn-outline btn-sm"
                  :class="{ 'btn-disabled': isWordSyncing(idx) }"
                  :disabled="isWordSyncing(idx)"
                  @click="handleSyncSingleWord(word_data, idx)"
                >
                  <span v-if="isWordSyncing(idx)" class="loading loading-spinner loading-xs"></span>
                  <span v-else>单词同步</span>
                </button>
                <button
                  type="button"
                  class="btn btn-error btn-outline btn-sm"
                  @click="handleDeleteWord(idx)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sentence Highlights -->
    <div v-else-if="page_flag === 'sentence'">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="card-title">句子高亮</h2>
              <p class="text-sm text-base-content/60">共 {{ totalHighlights }} 个高亮，{{ websiteCount }} 个网站</p>
            </div>
            <div class="flex items-center gap-3">
              <!-- 颜色选择器 -->
              <div class="flex items-center gap-2">
                <span class="text-sm text-base-content/60">高亮颜色:</span>
                <div class="relative">
                  <input
                    type="color"
                    v-model="sentenceHighlightColor"
                    @change="handleSentenceHighlightColorChange"
                    class="w-8 h-8 border border-base-300 rounded cursor-pointer"
                    :title="sentenceHighlightColor"
                  />
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" class="btn btn-outline btn-sm"
                  :class="{ 'btn-disabled': !hasHighlights }" :disabled="!hasHighlights" @click="handleExportHighlights">
                  导出
                </button>
                <button type="button" class="btn btn-error btn-outline btn-sm"
                  :class="{ 'btn-disabled': !hasHighlights }" :disabled="!hasHighlights" @click="handleClearAllHighlights">
                  清空
                </button>
              </div>
            </div>
          </div>
          <div v-if="message" :class="['alert', messageType === 'success' ? 'alert-success' : 'alert-error']">
            <span>{{ message }}</span>
          </div>
          <div class="divider my-0"></div>

          <div v-if="!hasHighlights" class="rounded-xl border border-dashed border-base-200 bg-base-200/40 p-6 text-center text-base-content/70">
            <p class="font-medium">暂无句子高亮</p>
            <p class="text-sm">在网页上选中句子并点击"高亮句子"后，将在此处展示。</p>
          </div>

          <div v-else class="flex gap-6">
            <!-- Left Sidebar - Website List -->
            <div class="w-96 min-w-0">
              <div class="form-control mb-3">
                <input
                  type="text"
                  v-model="websiteSearchQuery"
                  placeholder="搜索网站..."
                  class="input input-bordered input-sm w-full"
                />
              </div>
              <div class="max-h-96 overflow-y-auto space-y-2 pr-2">
                <div
                  v-for="group in filteredWebsiteGroups"
                  :key="group.url"
                  class="cursor-pointer rounded-lg border border-base-200 bg-base-200/30 p-3"
                  :class="{ 'border-primary bg-primary/10': selectedWebsite === group.url }"
                  @click="selectWebsite(group.url)"
                >
                  <div class="font-medium text-sm truncate" :title="group.title">
                    {{ group.title }}
                  </div>
                  <div class="text-xs text-base-content/60 truncate" :title="group.url">
                    {{ group.url }}
                  </div>
                  <div class="text-xs text-base-content/50 mt-1">
                    {{ group.highlights.length }} 个高亮
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Content - Selected Website Highlights -->
            <div class="flex-1 min-w-0">
              <div v-if="!selectedWebsite" class="rounded-xl border border-dashed border-base-200 bg-base-200/40 p-6 text-center text-base-content/70">
                <p class="font-medium">请选择网站</p>
                <p class="text-sm">从左侧列表中选择一个网站查看其句子高亮。</p>
              </div>

              <div v-else class="space-y-3">
                <div class="flex items-center justify-between">
                  <h3 class="font-semibold text-lg">{{ getSelectedWebsiteTitle() }}</h3>
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="btn btn-outline btn-xs"
                      @click="openUrl(selectedWebsite)"
                    >
                      打开网页
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline btn-xs"
                      @click="handleClearWebsiteHighlights"
                    >
                      清空网站高亮
                    </button>
                  </div>
                </div>

                <div class="max-h-80 overflow-y-auto space-y-3 pr-2">
                  <div
                    v-for="highlight in getSelectedWebsiteHighlights()"
                    :key="highlight.id"
                    class="rounded-lg border border-base-200 bg-base-200/30 p-4"
                  >
                    <div class="flex items-start justify-between gap-3 mb-2">
                      <div class="flex-1">
                        <div class="font-medium text-base-content/80 text-sm mb-2">
                          {{ highlight.sentence }}
                        </div>
                      </div>
                      <div class="flex flex-col gap-1">
                        <button
                          type="button"
                          class="btn btn-error btn-outline btn-xs"
                          @click="handleDeleteHighlight(highlight.id)"
                        >
                          删除
                        </button>
                        <button
                          type="button"
                          class="btn btn-outline btn-xs"
                          @click="copyToClipboard(highlight.sentence)"
                        >
                          复制
                        </button>
                      </div>
                    </div>
                    <div class="text-xs text-base-content/50">
                      {{ formatDate(highlight.timestamp) }}
                      <span v-if="highlight.note" class="ml-2">• {{ highlight.note }}</span>
                    </div>
                  </div>
                </div>
              </div>
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
import { ref, onMounted, computed, watch } from 'vue'
import {
  ai_api_url_storage, ai_api_key_storage, ai_model_storage, ai_word_model_storage, ai_prompt_storage,
  youdao_token_storage, eudic_token_storage, eudic_switch_storage, collection_words_storage, options_tab_storage,
  sentence_highlight_color_storage
} from '@/libs/local_storage'
import { WordData } from '@/libs/select_word'
import { collect_word } from '@/libs/word_collector'
import { OpenAI } from "openai";
import { SentenceHighlightStorage, type SentenceHighlightData } from '@/libs/sentence_highlight_storage';

type Tab = 'ai' | 'collect' | 'word' | 'sentence'
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
const wordCount = computed(() => collection_words.value?.length || 0)
const hasWords = computed(() => wordCount.value > 0)

// Sentence highlights computed properties
const totalHighlights = computed(() => sentenceHighlights.value?.length || 0)
const hasHighlights = computed(() => totalHighlights.value > 0)

const websiteGroups = computed(() => {
  const groups: { [url: string]: { title: string; url: string; highlights: SentenceHighlightData[] } } = {};

  sentenceHighlights.value.forEach(highlight => {
    if (!groups[highlight.url]) {
      groups[highlight.url] = {
        title: highlight.title || getWebsiteTitle(highlight.url),
        url: highlight.url,
        highlights: []
      };
    }
    groups[highlight.url].highlights.push(highlight);
  });

  return Object.values(groups).sort((a, b) => {
    const aLatest = Math.max(...a.highlights.map(h => h.timestamp));
    const bLatest = Math.max(...b.highlights.map(h => h.timestamp));
    return bLatest - aLatest;
  });
});

const websiteCount = computed(() => websiteGroups.value?.length || 0);

const filteredWebsiteGroups = computed(() => {
  if (!websiteSearchQuery.value.trim()) {
    return websiteGroups.value;
  }

  const query = websiteSearchQuery.value.toLowerCase();
  return websiteGroups.value.filter(group =>
    group.title.toLowerCase().includes(query) ||
    group.url.toLowerCase().includes(query)
  );
});
const syncing = ref(false)
const wordSyncing = ref<Set<number>>(new Set())

// Sentence highlights state
const sentenceHighlights = ref<SentenceHighlightData[]>([])
const selectedWebsite = ref<string>('')
const websiteSearchQuery = ref<string>('')
const sentenceHighlightColor = ref<string>('#FFF59D')

const testing = ref(false)
const saving = ref(false)
const message = ref<string>('')
const messageType = ref<'success' | 'error'>('success')
let messageTimer: number | null = null


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

    // Load sentence highlight color
    sentenceHighlightColor.value = await sentence_highlight_color_storage.getValue() || '#FFF59D'

    // Load sentence highlights
    await loadSentenceHighlights()
  } catch {
    console.warn('Failed to load saved settings')
  }
})

// Watch for tab changes to reload sentence highlights
watch(page_flag, async (newTab) => {
  if (newTab === 'sentence') {
    await loadSentenceHighlights();
  }
});

// 新增：切换tab并保存状态
const switchTab = async (tab: Tab) => {
  page_flag.value = tab
  try {
    await options_tab_storage.setValue(tab)
  } catch {
    console.warn('Failed to save tab state')
  }
}

const notify = (msg: string, type: 'success' | 'error' = 'success', duration = 2500) => {
  message.value = msg
  messageType.value = type
  if (messageTimer) {
    clearTimeout(messageTimer)
    messageTimer = null
  }
  if (duration > 0) {
    messageTimer = window.setTimeout(() => {
      message.value = ''
      messageTimer = null
    }, duration)
  }
}

const setWordSyncing = (idx: number, value: boolean) => {
  const next = new Set(wordSyncing.value)
  if (value) {
    next.add(idx)
  } else {
    next.delete(idx)
  }
  wordSyncing.value = next
}

const isWordSyncing = (idx: number) => wordSyncing.value.has(idx)

const formatPronunciation = (text: string | null | undefined) => {
  const output = text?.trim()
  return output && output !== '/' ? output : '—'
}

const formatMeaning = (text: string | null | undefined) => {
  if (!text) return '暂无释义'
  const stripped = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return stripped || '暂无释义'
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

const handleRemoteSync = async () => {
  if (syncing.value) return

  if (!hasWords.value) {
    notify('暂无可同步的单词', 'error', 4000)
    return
  }

  if (!eudic_switch.value) {
    notify('请先在“收藏设置”中开启欧路词典同步', 'error', 4500)
    return
  }

  syncing.value = true
  try {
    let successCount = 0
    let failureCount = 0
    const failedWords: string[] = []
    const failureReasons: string[] = []

    for (const wordItem of collection_words.value) {
      const results = await collect_word(wordItem.word)
      const failedResults = results.filter(res => res.code !== 0)
      if (failedResults.length === 0) {
        successCount += 1
      } else {
        failureCount += 1
        failedWords.push(wordItem.word)
        failureReasons.push(...failedResults.map(res => res.message))
      }
    }

    if (failureCount === 0) {
      notify(`远程同步完成，成功同步 ${successCount} 个单词`, 'success', 4000)
    } else {
      const uniqueReasons = [...new Set(failureReasons.filter(Boolean))]
      const failedDetail = failedWords.length ? `：${failedWords.join('、')}` : ''
      const reasonDetail = uniqueReasons.length ? `（${uniqueReasons.join('；')}）` : ''
      notify(`远程同步完成，成功 ${successCount} 个，失败 ${failureCount} 个${failedDetail}${reasonDetail}`, 'error', 6000)
    }
  } catch (error: any) {
    console.error('Remote sync error', error)
    notify(error?.message ? `同步失败：${error.message}` : '同步失败，请稍后重试', 'error', 5000)
  } finally {
    syncing.value = false
  }
}

const handleSyncSingleWord = async (wordItem: WordData, idx: number) => {
  if (isWordSyncing(idx)) return

  if (!eudic_switch.value) {
    notify('请先在“收藏设置”中开启欧路词典同步', 'error', 4500)
    return
  }

  if (!eudic_token.value?.trim()) {
    notify('请在“收藏设置”中填写欧路词典授权信息', 'error', 4500)
    return
  }

  setWordSyncing(idx, true)
  try {
    const results = await collect_word(wordItem.word)
    const failedResults = results.filter(res => res.code !== 0)

    if (failedResults.length === 0) {
      notify(`已同步 ${wordItem.word}`, 'success', 3500)
    } else {
      const uniqueReasons = [...new Set(failedResults.map(res => res.message).filter(Boolean))]
      const reasonDetail = uniqueReasons.length ? `（${uniqueReasons.join('；')}）` : ''
      notify(`同步 ${wordItem.word} 失败${reasonDetail}`, 'error', 5000)
    }
  } catch (error: any) {
    console.error('Single word sync error', error)
    notify(error?.message ? `同步失败：${error.message}` : '同步失败，请稍后重试', 'error', 5000)
  } finally {
    setWordSyncing(idx, false)
  }
}

const handleDeleteWord = async (idx: number) => {
  if (idx < 0 || idx >= collection_words.value.length) return

  const wordToDelete = collection_words.value[idx].word

  try {
    const newCollectionWords = collection_words.value.filter((_, index) => index !== idx)
    collection_words.value = newCollectionWords
    await collection_words_storage.setValue(newCollectionWords)
    notify(`已删除 "${wordToDelete}"`, 'success', 2000)
  } catch (error) {
    console.error('Delete word error', error)
    notify('删除失败，请稍后重试', 'error', 3000)
  }
}

const handleExportWords = () => {
  if (!hasWords.value) {
    notify('暂无可导出的单词', 'error', 2000)
    return
  }

  try {
    const wordsText = collection_words.value
      .map(wordItem => wordItem.word.trim())
      .filter(word => word)
      .join('\n')

    const blob = new Blob([wordsText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `words_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    notify(`已导出 ${wordCount.value} 个单词`, 'success', 2000)
  } catch (error) {
    console.error('Export words error', error)
    notify('导出失败，请稍后重试', 'error', 3000)
  }
}

const handleOpenEudicCollect = () => {
  eudic_switch.value = !eudic_switch.value
  eudic_switch_storage.setValue(eudic_switch.value)
}

// 句子高亮颜色配置
const handleSentenceHighlightColorChange = async () => {
  try {
    await sentence_highlight_color_storage.setValue(sentenceHighlightColor.value);
    notify('高亮颜色已保存', 'success', 2000);
  } catch (error) {
    console.error('Error saving sentence highlight color:', error);
    notify('保存颜色失败', 'error', 2000);
  }
};

// Sentence highlights methods
const loadSentenceHighlights = async () => {
  try {
    sentenceHighlights.value = await SentenceHighlightStorage.getAllHighlights();
  } catch (error) {
    console.error('Error loading sentence highlights:', error);
    sentenceHighlights.value = [];
  }
};

const getWebsiteTitle = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
  } catch {
    return url;
  }
};

const selectWebsite = (url: string) => {
  selectedWebsite.value = url;
};

const getSelectedWebsiteTitle = (): string => {
  if (!selectedWebsite.value) return '';
  const group = websiteGroups.value.find(g => g.url === selectedWebsite.value);
  return group?.title || selectedWebsite.value;
};

const getSelectedWebsiteHighlights = (): SentenceHighlightData[] => {
  if (!selectedWebsite.value) return [];
  const group = websiteGroups.value.find(g => g.url === selectedWebsite.value);
  return group?.highlights.sort((a, b) => b.timestamp - a.timestamp) || [];
};


const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const openUrl = (url: string) => {
  window.open(url, '_blank');
};

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    notify('已复制到剪贴板', 'success', 2000);
  } catch (error) {
    notify('复制失败', 'error', 2000);
  }
};

const handleDeleteHighlight = async (id: string) => {
  try {
    await SentenceHighlightStorage.removeHighlight(id);
    await loadSentenceHighlights();
    notify('已删除高亮', 'success', 2000);
  } catch (error) {
    console.error('Error deleting highlight:', error);
    notify('删除失败', 'error', 2000);
  }
};

const handleClearWebsiteHighlights = async () => {
  if (!selectedWebsite.value) return;

  if (!confirm(`确定要清空"${getSelectedWebsiteTitle()}"的所有高亮吗？`)) {
    return;
  }

  try {
    await SentenceHighlightStorage.clearHighlights(selectedWebsite.value);
    await loadSentenceHighlights();
    selectedWebsite.value = '';
    notify('已清空网站高亮', 'success', 2000);
  } catch (error) {
    console.error('Error clearing website highlights:', error);
    notify('清空失败', 'error', 2000);
  }
};

const handleClearAllHighlights = async () => {
  if (!confirm('确定要清空所有句子高亮吗？此操作不可恢复。')) {
    return;
  }

  try {
    const highlights = await SentenceHighlightStorage.getAllHighlights();
    for (const highlight of highlights) {
      await SentenceHighlightStorage.removeHighlight(highlight.id);
    }
    await loadSentenceHighlights();
    selectedWebsite.value = '';
    notify('已清空所有高亮', 'success', 2000);
  } catch (error) {
    console.error('Error clearing all highlights:', error);
    notify('清空失败', 'error', 2000);
  }
};

const handleExportHighlights = async () => {
  if (!hasHighlights.value) {
    notify('暂无可导出的高亮', 'error', 2000);
    return;
  }

  try {
    const exportData = sentenceHighlights.value
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(highlight => ({
        网站: getWebsiteTitle(highlight.url),
        句子: highlight.sentence,
        时间: formatDate(highlight.timestamp),
        颜色: highlight.color || '#FFF59D',
        备注: highlight.note || ''
      }));

    const headers = ['网站', '句子', '时间', '颜色', '备注'];
    const csvContent = [
      headers.join(','),
      ...exportData.map(row =>
        headers.map(header =>
          `"${(row as any)[header]?.toString().replace(/"/g, '""') || ''}"`
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], {
      type: 'text/csv;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sentence_highlights_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    notify(`已导出 ${totalHighlights.value} 个高亮`, 'success', 2000);
  } catch (error) {
    console.error('Export highlights error:', error);
    notify('导出失败，请稍后重试', 'error', 3000);
  }
};
</script>

<style scoped>
/* 可按需添加微调样式 */
</style>