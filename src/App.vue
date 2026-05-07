<template>
  <div class="h-screen w-screen flex flex-col bg-background text-gray-800">
    <AppHeader :isLoggedIn="isLoggedIn" @login="login" @logout="logout" />

    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar / Tree View -->
      <AppSidebar :files="files" :selectedFile="selectedFile" @select-folder="selectFolder" @select-file="selectFile"
        @refresh="refreshFolder" />

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
                <input v-model="formData.name" type="text"
                  class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all text-sm"
                  placeholder="E.g. Sosialisasi Peraturan...">
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Deskripsi Kegiatan</label>
                <textarea v-model="formData.description" rows="3"
                  class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none text-sm"
                  placeholder="Details about the activity..."></textarea>
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
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { IoOutlineDocument, IoOutlineSync, IoOutlineCloudUpload } from '@kalimahapps/vue-icons'
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar, { TreeNode } from './components/layout/AppSidebar.vue'
import StatusBadge from './components/ui/StatusBadge.vue'
import SearchSelectItem from './components/ui/SearchSelectItem.vue'

// State
const files = ref<TreeNode[]>([])
const currentFolderPath = ref<string | null>(null)
const selectedFile = ref<TreeNode | null>(null)
const isLoggedIn = ref(false)
const isSyncing = ref(false)

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

// Initialize session check
onMounted(async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    isLoggedIn.value = await window.ipcRenderer.invoke('check-session')
    if (isLoggedIn.value) {
      fetchOptions()
    }
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
    }
  } else {
    alert("Folder selection will be available in Electron app")
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
      alert("Login failed or cancelled.")
    }
  } else {
    alert("Login flow will open an external browser window in Electron app")
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

const syncData = async () => {
  if (!selectedFile.value) return
  if (!isLoggedIn.value) {
    alert("Please login first!")
    return
  }

  isSyncing.value = true

  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const success = await window.ipcRenderer.invoke('sync-data', selectedFile.value.path, formData.value)
    isSyncing.value = false
    if (success) {
      selectedFile.value.status = 'synced'
      selectedFile.value.parsedData = { ...formData.value }
      alert("Successfully synced to MySimkari!")
    } else {
      alert("Failed to sync! Please check your connection and login status.")
    }
  } else {
    setTimeout(() => {
      selectedFile.value!.status = 'synced'
      selectedFile.value!.parsedData = { ...formData.value }
      isSyncing.value = false
      alert("Successfully synced to MySimkari!")
    }, 1500)
  }
}
</script>
