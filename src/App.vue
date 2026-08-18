<template>
  <div class="h-screen w-screen flex flex-col bg-background text-gray-800">
    <AppHeader :isLoggedIn="isLoggedIn" @login="login" @logout="logout" />

    <div class="flex flex-1 overflow-hidden relative" @mousemove="onMouseMove" @mouseup="onMouseUp"
      @mouseleave="onMouseUp">
      <!-- Sidebar / Tree View -->
      <AppSidebar :files="files" :selectedFile="selectedFile" :width="sidebarWidth" @select-folder="selectFolder"
        @select-file="selectFile" @refresh="refreshFolder" @show-toast="showToast" @open-ai-settings="openAiSettings" />

      <!-- Resizer Divider -->
      <div
        class="w-1 hover:w-1.5 bg-transparent hover:bg-primary/30 cursor-col-resize z-10 transition-all duration-200 absolute"
        :style="{ left: sidebarWidth - 2 + 'px', height: '100%' }" @mousedown="onMouseDown"></div>

      <!-- Main Content -->
      <main class="flex-1 bg-gray-50 flex flex-col p-8 overflow-y-auto">
        <div v-if="!selectedFile" class="flex-1 flex flex-col items-center justify-center text-gray-400">
          <IoOutlineDocument class="text-7xl mb-4 text-gray-300" />
          <p class="text-lg">Select a file from the explorer to view details</p>
        </div>

        <div v-else class="max-w-3xl w-full mx-auto space-y-6">
          <div class="bg-surface rounded-xl shadow-sm border border-gray-100 p-6">
            <div class="flex items-start justify-between mb-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-800 mb-1">Document Verification</h2>
                <p class="text-sm text-gray-500">{{ selectedFile.name }} ({{ (selectedFile.size / 1024 /
                  1024).toFixed(2) }} MB)</p>
              </div>
              <StatusBadge :status="selectedFile.status || 'unprocessed'" />
            </div>

            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Tipe Kegiatan</label>
                  <SearchSelectItem v-model="formData.tipe_kegiatan" :options="formOptions.tipe"
                    placeholder="Pilih Tipe" />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Kategori Kegiatan</label>
                  <SearchSelectItem v-model="formData.kaitan_kegiatan" :options="formOptions.kategori"
                    placeholder="Pilih Kategori" />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Indikator Kinerja</label>
                <SearchSelectItem v-model="formData.id_indikator" :options="formOptions.indikator"
                  placeholder="Pilih Indikator" @change="onIndikatorChange" />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Sasaran Kinerja</label>
                <textarea v-model="formData.sasaran_kegiatan" rows="2"
                  class="w-full px-4 py-2 rounded-lg border border-gray-200 outline-none transition-all resize-none text-sm"
                  placeholder="Sasaran otomatis muncul setelah pilih Indikator..."></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Nama Kegiatan</label>
                <div class="relative">
                  <input v-model="formData.name" type="text"
                    class="w-full px-4 py-2 pr-28 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                    placeholder="E.g. Sosialisasi Peraturan...">
                  <button v-if="aiSettings.apiKey" @click="generateAiContent('name')" :disabled="isGeneratingName"
                    class="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-all flex items-center gap-1 whitespace-nowrap"
                    :class="{ 'opacity-50 cursor-not-allowed': isGeneratingName }">
                    <IoOutlineSparkles v-if="!isGeneratingName" class="text-xs" />
                    <IoOutlineSync v-else class="text-xs animate-spin" />
                    {{ isGeneratingName ? 'Generating...' : 'Generate AI' }}
                  </button>
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi Kegiatan</label>
                <div class="relative">
                  <textarea v-model="formData.description" rows="3"
                    class="w-full px-4 py-2 pr-28 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-sm"
                    placeholder="Details about the activity..."></textarea>
                  <button v-if="aiSettings.apiKey" @click="generateAiContent('description')"
                    :disabled="isGeneratingDesc"
                    class="absolute right-2 top-2 px-2.5 py-1 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-all flex items-center gap-1 whitespace-nowrap"
                    :class="{ 'opacity-50 cursor-not-allowed': isGeneratingDesc }">
                    <IoOutlineSparkles v-if="!isGeneratingDesc" class="text-xs" />
                    <IoOutlineSync v-else class="text-xs animate-spin" />
                    {{ isGeneratingDesc ? 'Generating...' : 'Generate AI' }}
                  </button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Tanggal Kegiatan</label>
                  <input v-model="formData.date" type="date"
                    class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm">
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Durasi (Menit)</label>
                  <input v-model="formData.menit" type="number"
                    class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm">
                </div>
              </div>
            </div>

            <div v-if="aiSettings.apiKey && selectedFile.status !== 'unprocessed'"
              class="mt-6 pt-4 border-t border-gray-100">
              <button @click="generateAll" :disabled="isGeneratingAll"
                class="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary to-blue-500 hover:from-blue-600 hover:to-blue-600 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
                :class="{ 'opacity-50 cursor-not-allowed': isGeneratingAll }">
                <IoOutlineSparkles v-if="!isGeneratingAll" class="text-base" />
                <IoOutlineSync v-else class="text-base animate-spin" />
                {{ isGeneratingAll ? 'Generating All Fields...' : 'Generate All with AI' }}
              </button>
              <p class="text-[10px] text-gray-400 text-center mt-1.5">
                Generate Nama Kegiatan &amp; Deskripsi Kegiatan dari file yang dipilih
              </p>
            </div>

            <div class="mt-8 flex justify-end gap-3">
              <button
                class="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button @click="syncData"
                class="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
                :disabled="isSyncing || selectedFile.status === 'synced'">
                <IoOutlineSync v-if="isSyncing" class="animate-spin h-4 w-4 text-white" />
                <IoOutlineCloudUpload v-else class="text-lg" />
                {{ isSyncing ? 'Syncing...' : 'Save & Sync' }}
              </button>
            </div>
          </div>
        </div>


        <!-- History Section -->
        <div class="max-w-3xl w-full mx-auto mt-12 pb-12">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
              <IoOutlineSync class="text-primary" />
              Recent Sync History
            </h3>
            <button @click="fetchSyncHistory" :disabled="isLoadingHistory"
              class="text-sm text-primary hover:underline flex items-center gap-1">
              <IoOutlineSync :class="{ 'animate-spin': isLoadingHistory }" />
              Refresh
            </button>
          </div>

          <div v-if="isLoadingHistory && syncHistory.length === 0" class="flex justify-center py-12">
            <IoOutlineSync class="animate-spin text-3xl text-gray-300" />
          </div>

          <div v-else-if="syncHistory.length === 0"
            class="bg-white rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-400">
            No synchronization history found.
          </div>

          <div v-else class="space-y-3">
            <div v-for="item in filteredSyncHistory" :key="item.id"
              class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-primary/30 transition-all group">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center justify-between mb-1">
                    <h4 class="font-semibold text-gray-800 group-hover:text-primary transition-colors">
                      {{ item.name || item.nama_kegiatan || 'Untitled Activity' }}
                    </h4>
                    <div class="flex gap-2">
                      <span v-if="item.is_iki"
                        class="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-bold">
                        IKI
                      </span>
                      <span v-if="item.is_verified"
                        class="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                        VERIFIED
                      </span>
                    </div>
                  </div>

                  <p v-if="item.text_kegiatan" class="text-xs text-gray-500 mb-3 line-clamp-2 leading-relaxed">
                    {{ item.text_kegiatan.replace(/<[^>]*>/g, "") }}
                  </p>

                  <div class="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-gray-500">
                    <span class="flex items-center gap-1.5">
                      <IoOutlineCalendar class="text-gray-400 text-sm" />
                      {{ item.tanggal_kegiatan || item.date }}
                    </span>
                    <span v-if="item.menit" class="flex items-center gap-1.5">
                      <IoOutlineSync class="text-gray-400 text-sm" />
                      {{ item.menit }} menit
                    </span>
                    <span v-if="item.nama_kegiatan && item.name" class="text-gray-400 italic">
                      {{ item.name }}
                    </span>
                    <span v-if="item.status" :class="[
                      'ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium',
                      item.status === 'Sudah Diverifikasi' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    ]">
                      {{ item.status }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>


      </main>
    </div>

    <!-- Toast Notification -->
    <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="translate-y-4 opacity-0"
      enter-to-class="translate-y-0 opacity-100" leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 opacity-100" leave-to-class="translate-y-4 opacity-0">
      <div v-if="toastMessage"
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 backdrop-blur-sm"
        :class="{
          'bg-green-500/90 text-white': toastType === 'success',
          'bg-red-500/90 text-white': toastType === 'error',
          'bg-gray-800/90 text-white': toastType === 'info'
        }">
        <IoOutlineCheckmarkCircle v-if="toastType === 'success'" class="text-lg" />
        <IoOutlineWarning v-else-if="toastType === 'error'" class="text-lg" />
        <IoOutlineInformationCircle v-else class="text-lg" />
        {{ toastMessage }}
      </div>
    </Transition>

    <!-- AI Settings Modal -->
    <AiSettingsModal v-model="showAiSettings" @saved="() => showToast('AI settings saved!', 'success')" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { IoOutlineDocument, IoOutlineSync, IoOutlineCloudUpload, IoOutlineCalendar, IoOutlineCheckmarkCircle, IoOutlineWarning, IoOutlineInformationCircle, IoOutlineSparkles } from '@kalimahapps/vue-icons'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar, { TreeNode } from './components/layout/AppSidebar.vue'
import StatusBadge from './components/ui/StatusBadge.vue'
import SearchSelectItem from './components/ui/SearchSelectItem.vue'
import AiSettingsModal from './components/ui/AiSettingsModal.vue'

// State
const files = ref<TreeNode[]>([])
const currentFolderPath = ref<string | null>(null)
const selectedFile = ref<TreeNode | null>(null)
const isLoggedIn = ref(false)
const isSyncing = ref(false)
const syncHistory = ref<any[]>([])
const isLoadingHistory = ref(false)

// Resizing
const sidebarWidth = ref(288)
const isResizing = ref(false)

const onMouseDown = () => {
  isResizing.value = true
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

const onMouseMove = (e: MouseEvent) => {
  if (!isResizing.value) return
  const newWidth = e.clientX
  if (newWidth > 150 && newWidth < 600) {
    sidebarWidth.value = newWidth
  }
}

const onMouseUp = () => {
  if (!isResizing.value) return
  isResizing.value = false
  document.body.style.cursor = 'default'
  document.body.style.userSelect = 'auto'

  // Save width to settings
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    window.ipcRenderer.invoke('save-setting', 'sidebarWidth', sidebarWidth.value.toString())
  }
}

// Toast notification
const toastMessage = ref('')
const toastType = ref<'success' | 'error' | 'info'>('info')
let toastTimer: ReturnType<typeof setTimeout> | null = null

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
  toastMessage.value = message
  toastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMessage.value = ''
  }, 3000)
}

// AI Settings
const showAiSettings = ref(false)
const aiSettings = ref({
  provider: '',
  apiKey: '',
  model: '',
  baseUrl: '',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024
})
const isGeneratingName = ref(false)
const isGeneratingDesc = ref(false)
const isGeneratingAll = ref(false)
const fileRawText = ref('')

const formOptions = ref({
  tipe: [] as any[],
  kategori: [] as any[],
  indikator: [] as any[]
})

const formData = ref({
  tipe_kegiatan: '',
  kaitan_kegiatan: '',
  id_indikator: '',
  sasaran_kegiatan: '',
  name: '',
  description: '',
  date: '',
  menit: 420
})

const fetchOptions = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const options = await window.ipcRenderer.invoke('get-form-options')
    if (options) {
      formOptions.value = options
    }
  }
}

const fetchSyncHistory = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    isLoadingHistory.value = true
    // @ts-ignore
    const history = await window.ipcRenderer.invoke('get-sync-history')
    if (history) {
      syncHistory.value = history
    }
    isLoadingHistory.value = false
  }
}

const filteredSyncHistory = computed(() => {
  console.log('formData.value.date', formData.value.date)
  if (!formData.value.date) return syncHistory.value

  // Convert YYYY-MM-DD (from input date) to DD-MM-YYYY (from API)
  const [year, month, day] = formData.value.date.split('-')
  const formattedDate = `${day}-${month}-${year}`

  return syncHistory.value.filter(item => {
    return item.tanggal_kegiatan === formattedDate
  })
})

// Initialize session check
onMounted(async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    isLoggedIn.value = await window.ipcRenderer.invoke('check-session')

    // Load last width
    // @ts-ignore
    const savedWidth = await window.ipcRenderer.invoke('get-setting', 'sidebarWidth')
    if (savedWidth) sidebarWidth.value = parseInt(savedWidth)

    // Load last folder
    // @ts-ignore
    const lastFolder = await window.ipcRenderer.invoke('get-setting', 'lastFolder')
    if (lastFolder) {
      currentFolderPath.value = lastFolder
      // @ts-ignore
      const result = await window.ipcRenderer.invoke('read-folder', lastFolder)
      if (result) files.value = result
    }

    if (isLoggedIn.value) {
      fetchOptions()
      fetchSyncHistory()
    }

    // Load AI settings
    // @ts-ignore
    const aiCfg = await window.ipcRenderer.invoke('get-ai-settings')
    if (aiCfg) aiSettings.value = aiCfg
  }
})

const selectFolder = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('select-folder')
    if (result) {
      files.value = result.fileTree
      currentFolderPath.value = result.folderPath
      selectedFile.value = null

      // Save last folder
      // @ts-ignore
      window.ipcRenderer.invoke('save-setting', 'lastFolder', result.folderPath)
    }
  } else {
    showToast("Folder selection will be available in Electron app", "info")
  }
}

const refreshFolder = async () => {
  if (!currentFolderPath.value) return

  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('read-folder', currentFolderPath.value)
    if (result) {
      files.value = result
      // Keep selection if possible
      if (selectedFile.value) {
        const findInTree = (tree: TreeNode[]): TreeNode | null => {
          for (const node of tree) {
            if (node.path === selectedFile.value?.path) return node
            if (node.children) {
              const found = findInTree(node.children)
              if (found) return found
            }
          }
          return null
        }
        const updated = findInTree(files.value)
        if (updated) selectedFile.value = updated
      }
    }
  }
}

const selectFile = async (file: TreeNode) => {



  let size = 0
  let mtime = ''
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const stats = await window.ipcRenderer.invoke('get-file-stats', file.path)
    if (stats) {
      mtime = stats.mtime
      size = stats.size
    }
  }

  selectedFile.value = { ...file, size, mtime }

  if (file.status === 'unprocessed') {
    // Attempt to parse
    formData.value = { ...formData.value, name: 'Parsing...', description: 'Extracting data...', date: mtime || '' }
    // @ts-ignore
    if (window.ipcRenderer) {
      // @ts-ignore
      const parsedData = await window.ipcRenderer.invoke('parse-file', file.path, file.type)
      formData.value = { ...formData.value, ...parsedData, date: mtime || parsedData.date || '' }

      fileRawText.value = parsedData.rawText || ''
      file.status = 'ready'
      file.parsedData = { ...parsedData, date: formData.value.date }
    } else {
      setTimeout(() => {
        formData.value = { ...formData.value, name: `Parsed: ${file.name}`, description: 'Auto-extracted', date: mtime || new Date().toISOString().split('T')[0] }
        file.status = 'ready'
        file.parsedData = { name: formData.value.name, description: formData.value.description, date: formData.value.date }
      }, 1000)
    }
  } else if (file.parsedData) {
    formData.value = { ...formData.value, ...file.parsedData, date: mtime || (file.parsedData as any).date || '' }
    // @ts-ignore
    if (window.ipcRenderer) {
      // @ts-ignore
      const rawText = await window.ipcRenderer.invoke('get-file-text', file.path)
      fileRawText.value = rawText || ''
    }
  }
}

// Update Sasaran Kinerja when Indikator changes
const onIndikatorChange = () => {
  const selected = formOptions.value.indikator.find(i => i.value === formData.value.id_indikator)
  if (selected) {
    formData.value.sasaran_kegiatan = selected.sasaran
  }
}

const login = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const success = await window.ipcRenderer.invoke('login-mysimkari')
    if (success) {
      isLoggedIn.value = true
      fetchOptions()
    } else {
      showToast("Login failed or cancelled.", "error")
    }
  } else {
    showToast("Login flow will open an external browser window in Electron app", "info")
    isLoggedIn.value = true
    fetchOptions()
  }
}

const logout = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    await window.ipcRenderer.invoke('logout-mysimkari')
    isLoggedIn.value = false
  } else {
    isLoggedIn.value = false
  }
}

const generateAiContent = async (target: 'name' | 'description' | 'both') => {
  if (!selectedFile.value) return
  if (!aiSettings.value.apiKey) {
    showToast("Please configure AI settings first!", "error")
    showAiSettings.value = true
    return
  }
  if (!fileRawText.value && selectedFile.value) {
    // @ts-ignore
    if (window.ipcRenderer) {
      // @ts-ignore
      const rawText = await window.ipcRenderer.invoke('get-file-text', selectedFile.value.path)
      fileRawText.value = rawText || ''
    }
  }
  if (!fileRawText.value) {
    showToast("No file text available. Select a file first.", "error")
    return
  }

  if (target === 'name') isGeneratingName.value = true
  if (target === 'description') isGeneratingDesc.value = true

  try {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('generate-ai', {
      ...aiSettings.value,
      fileText: fileRawText.value,
      tipeKegiatan: formData.value.tipe_kegiatan,
      kategoriKegiatan: formData.value.kaitan_kegiatan,
      indikatorKinerja: formData.value.id_indikator,
      sasaranKinerja: formData.value.sasaran_kegiatan,
      target
    })

    if (result.error) {
      showToast(result.error, "error")
    } else {
      if (result.name) formData.value.name = result.name
      if (result.description) formData.value.description = result.description
      showToast("Generated with AI!", "success")
    }
  } catch {
    showToast("Failed to generate with AI", "error")
  }

  if (target === 'name') isGeneratingName.value = false
  if (target === 'description') isGeneratingDesc.value = false
}

const openAiSettings = () => {
  showAiSettings.value = true
}

const generateAll = async () => {
  if (!selectedFile.value) return
  if (!aiSettings.value.apiKey) {
    showToast("Please configure AI settings first!", "error")
    showAiSettings.value = true
    return
  }
  if (!fileRawText.value) {
    // @ts-ignore
    if (window.ipcRenderer) {
      // @ts-ignore
      const rawText = await window.ipcRenderer.invoke('get-file-text', selectedFile.value.path)
      fileRawText.value = rawText || ''
    }
  }
  if (!fileRawText.value) {
    showToast("No file text available. Select a file first.", "error")
    return
  }

  isGeneratingAll.value = true

  try {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('generate-ai', {
      ...aiSettings.value,
      fileText: fileRawText.value,
      tipeKegiatan: formData.value.tipe_kegiatan,
      kategoriKegiatan: formData.value.kaitan_kegiatan,
      indikatorKinerja: formData.value.id_indikator,
      sasaranKinerja: formData.value.sasaran_kegiatan,
      target: 'both'
    })

    if (result.error) {
      showToast(result.error, "error")
    } else {
      if (result.name) formData.value.name = result.name
      if (result.description) formData.value.description = result.description
      showToast("All fields generated with AI!", "success")
    }
  } catch {
    showToast("Failed to generate with AI", "error")
  }

  isGeneratingAll.value = false
}

const syncData = async () => {
  if (!selectedFile.value) return
  if (!isLoggedIn.value) {
    showToast("Please login first!", "error")
    return
  }

  isSyncing.value = true

  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const success = await window.ipcRenderer.invoke('sync-data', selectedFile.value.path, JSON.parse(JSON.stringify(formData.value)))
    isSyncing.value = false
    if (success) {
      selectedFile.value.status = 'synced'
      selectedFile.value.parsedData = { ...formData.value }
      showToast("Successfully synced to MySimkari!", "success")
      fetchSyncHistory()
    } else {
      showToast("Failed to sync! Please check your connection and login status.", "error")
    }
  } else {
    setTimeout(() => {
      selectedFile.value!.status = 'synced'
      selectedFile.value!.parsedData = { ...formData.value }
      isSyncing.value = false
      showToast("Successfully synced to MySimkari!", "success")
    }, 1500)
  }
}
</script>
