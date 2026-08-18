<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="close"></div>

        <!-- Modal -->
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
          <!-- Header -->
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <IoOutlineSparkles class="text-primary text-lg" />
              <h3 class="text-lg font-bold text-gray-800">AI Settings</h3>
            </div>
            <button @click="close" class="p-1 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Body -->
          <div class="px-6 py-5 space-y-4 overflow-y-auto flex-1">
            <!-- Provider -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Provider</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  @click="form.provider = 'gemini'"
                  :class="[
                    'px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
                    form.provider === 'gemini'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  ]"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  Gemini
                </button>
                <button
                  @click="form.provider = 'openai'"
                  :class="[
                    'px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2',
                    form.provider === 'openai'
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  ]"
                >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>
                  OpenAI Custom
                </button>
              </div>
            </div>

            <!-- API Key -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">API Key</label>
              <input
                v-model="form.apiKey"
                type="password"
                class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="Masukkan API Key..."
              />
            </div>

            <!-- Base URL (OpenAI only) -->
            <div v-if="form.provider === 'openai'">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Base URL</label>
              <input
                v-model="form.baseUrl"
                type="text"
                class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                placeholder="https://api.openai.com"
              />
            </div>

            <!-- Test Connection -->
            <div class="flex items-center gap-2">
              <button
                @click="testConnection"
                :disabled="isTesting || !form.apiKey"
                class="px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                :class="[
                  connectionStatus === 'success' ? 'bg-green-50 text-green-600 border border-green-200' :
                  connectionStatus === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
                  'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200',
                  (isTesting || !form.apiKey) ? 'opacity-50 cursor-not-allowed' : ''
                ]"
              >
                <IoOutlineSync v-if="isTesting" class="animate-spin text-sm" />
                <IoOutlineCheckmarkCircle v-else-if="connectionStatus === 'success'" class="text-sm" />
                <IoOutlineWarning v-else-if="connectionStatus === 'error'" class="text-sm" />
                <IoOutlineFlash v-else class="text-sm" />
                {{ isTesting ? 'Testing...' : connectionStatus === 'success' ? 'Connected' : connectionStatus === 'error' ? 'Failed' : 'Test Connection' }}
              </button>
            </div>

            <!-- Model Selection -->
            <div v-if="models.length > 0">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
              <div class="relative">
                <select
                  v-model="form.model"
                  class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm appearance-none bg-white"
                >
                  <option value="" disabled>Pilih model...</option>
                  <option v-for="m in models" :key="m" :value="m">{{ m }}</option>
                </select>
                <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <!-- Temperature -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                Temperature: <span class="text-primary font-semibold">{{ form.temperature.toFixed(1) }}</span>
              </label>
              <input
                v-model.number="form.temperature"
                type="range"
                min="0"
                max="1"
                step="0.1"
                class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <div class="flex justify-between text-[10px] text-gray-400 mt-1">
                <span>Tepat (0.0)</span>
                <span>Kreatif (1.0)</span>
              </div>
            </div>

            <!-- Max Tokens -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Max Tokens</label>
              <input
                v-model.number="form.maxTokens"
                type="number"
                min="64"
                max="4096"
                step="64"
                class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
              />
            </div>

            <!-- System Prompt -->
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">System Prompt</label>
              <textarea
                v-model="form.systemPrompt"
                rows="4"
                class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm resize-none"
                :placeholder="defaultPrompt"
              ></textarea>
              <button @click="form.systemPrompt = defaultPrompt" class="text-xs text-primary hover:underline mt-1">
                Reset ke default
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button @click="close"
              class="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button @click="save"
              :disabled="!form.apiKey || !form.model"
              class="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 rounded-lg shadow-sm transition-all flex items-center gap-2"
              :class="{ 'opacity-50 cursor-not-allowed': !form.apiKey || !form.model }"
            >
              <IoOutlineCheckmarkCircle class="text-sm" />
              Save
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  IoOutlineSparkles,
  IoOutlineSync,
  IoOutlineCheckmarkCircle,
  IoOutlineWarning,
  IoOutlineFlash
} from '@kalimahapps/vue-icons'

const defaultPrompt = `Saya adalah seorang pegawai administrasi di Kejaksaan Negeri PIDIE. Bantu saya menyusun format berikut berdasarkan dokumen yang saya berikan:

Nama kegiatan yang saya kerjakan: ...
Deskripsi kegiatan yang saya kerjakan: ...`

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const form = ref({
  provider: 'gemini',
  apiKey: '',
  model: '',
  baseUrl: 'https://api.openai.com',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024
})

const models = ref<string[]>([])
const isTesting = ref(false)
const connectionStatus = ref<'idle' | 'success' | 'error'>('idle')

const close = () => {
  emit('update:modelValue', false)
}

const loadSettings = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const settings = await window.ipcRenderer.invoke('get-ai-settings')
    if (settings) {
      form.value = {
        provider: settings.provider || 'gemini',
        apiKey: settings.apiKey || '',
        model: settings.model || '',
        baseUrl: settings.baseUrl || 'https://api.openai.com',
        systemPrompt: settings.systemPrompt || '',
        temperature: settings.temperature ?? 0.7,
        maxTokens: settings.maxTokens ?? 1024
      }
    }
  }
}

const testConnection = async () => {
  isTesting.value = true
  connectionStatus.value = 'idle'
  models.value = []

  try {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('test-ai-connection', {
      provider: form.value.provider,
      apiKey: form.value.apiKey,
      model: form.value.model,
      baseUrl: form.value.baseUrl
    })

    if (result.success) {
      connectionStatus.value = 'success'
      models.value = result.models || []
      if (models.value.length > 0 && !form.value.model) {
        form.value.model = models.value[0]
      }
    } else {
      connectionStatus.value = 'error'
    }
  } catch {
    connectionStatus.value = 'error'
  }

  isTesting.value = false
}

const save = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    await window.ipcRenderer.invoke('save-ai-settings', { ...form.value })
  }
  emit('saved')
  close()
}

watch(() => props.modelValue, (val) => {
  if (val) {
    loadSettings()
    connectionStatus.value = 'idle'
    models.value = []
  }
})
</script>
