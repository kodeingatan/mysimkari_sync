<template>
  <div class="h-screen w-screen flex flex-col bg-background text-gray-800">
    <AppHeader :isLoggedIn="isLoggedIn" @login="login" />

    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar / Tree View -->
      <AppSidebar 
        :files="files" 
        :selectedFile="selectedFile" 
        @select-folder="selectFolder" 
        @select-file="selectFile" 
      />

      <!-- Main Content -->
      <main class="flex-1 bg-gray-50 flex flex-col p-8 overflow-y-auto">
        <div v-if="!selectedFile" class="flex-1 flex flex-col items-center justify-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" class="mb-4 text-gray-300"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
          <p class="text-lg">Select a file from the explorer to view details</p>
        </div>
        
        <div v-else class="max-w-3xl w-full mx-auto space-y-6">
          <div class="bg-surface rounded-xl shadow-sm border border-gray-100 p-6">
            <div class="flex items-start justify-between mb-6">
              <div>
                <h2 class="text-2xl font-bold text-gray-800 mb-1">Document Verification</h2>
                <p class="text-sm text-gray-500">{{ selectedFile.name }}</p>
              </div>
              <StatusBadge :status="selectedFile.status" />
            </div>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Activity Name</label>
                <input v-model="formData.name" type="text" class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" placeholder="E.g. Sosialisasi Peraturan...">
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Activity Description</label>
                <textarea v-model="formData.description" rows="4" class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none" placeholder="Details about the activity..."></textarea>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Activity Date</label>
                <input v-model="formData.date" type="date" class="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all">
              </div>
            </div>

            <div class="mt-8 flex justify-end gap-3">
              <button class="px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Cancel
              </button>
              <button @click="syncData" 
                      class="px-5 py-2 text-sm font-medium text-white bg-primary hover:bg-blue-600 rounded-lg shadow-sm shadow-blue-200 transition-all active:scale-95 flex items-center gap-2"
                      :disabled="isSyncing || selectedFile.status === 'synced'">
                <svg v-if="isSyncing" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
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
import AppHeader from './components/layout/AppHeader.vue'
import AppSidebar, { TreeNode } from './components/layout/AppSidebar.vue'
import StatusBadge from './components/ui/StatusBadge.vue'

// State
const files = ref<TreeNode[]>([])
const selectedFile = ref<TreeNode | null>(null)
const isLoggedIn = ref(false)
const isSyncing = ref(false)
const formData = ref({
  name: '',
  description: '',
  date: ''
})

// Mock initial data - remove
onMounted(() => {
  // We don't load mock data anymore
})

const selectFolder = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('select-folder')
    if (result) {
      files.value = result
      selectedFile.value = null
    }
  } else {
    alert("Folder selection will be available in Electron app")
  }
}

const selectFile = async (file: TreeNode) => {
  selectedFile.value = file
  
  if (file.status === 'unprocessed') {
    // Attempt to parse
    formData.value = { name: 'Parsing...', description: 'Extracting data...', date: '' }
    // @ts-ignore
    if (window.ipcRenderer) {
      // @ts-ignore
      const parsedData = await window.ipcRenderer.invoke('parse-file', file.path, file.type)
      formData.value = { ...parsedData }
      file.status = 'ready'
      file.parsedData = { ...parsedData }
    } else {
      setTimeout(() => {
        formData.value = { name: `Parsed: ${file.name}`, description: 'Auto-extracted', date: new Date().toISOString().split('T')[0] }
        file.status = 'ready'
        file.parsedData = { ...formData.value }
      }, 1000)
    }
  } else if (file.parsedData) {
    formData.value = { ...file.parsedData }
  }
}

const login = async () => {
  // @ts-ignore
  if (window.ipcRenderer) {
    // @ts-ignore
    const success = await window.ipcRenderer.invoke('login-mysimkari')
    if (success) {
      isLoggedIn.value = true
    } else {
      alert("Login failed or cancelled.")
    }
  } else {
    alert("Login flow will open an external browser window in Electron app")
    isLoggedIn.value = true
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
