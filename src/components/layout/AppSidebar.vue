<template>
  <aside :style="{ width: width + 'px' }" class="bg-surface border-r border-gray-200 flex flex-col shrink-0">
    <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
      <h2 class="font-semibold text-gray-700 text-sm uppercase tracking-wider overflow-hidden whitespace-nowrap">Explorer</h2>
      <div class="flex items-center gap-1">
        <button @click="$emit('open-ai-settings')"
          class="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center justify-center" title="Settings">
          <IoOutlineCog class="text-lg" />
        </button>
        <button @click="$emit('refresh')"
          class="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center justify-center" title="Refresh">
          <IoOutlineRefresh class="text-lg" />
        </button>
        <button @click="$emit('select-folder')"
          class="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center justify-center" title="Select Folder">
          <IoOutlineAddCircle class="text-xl" />
        </button>
      </div>
    </div>
    <div class="p-3 border-b border-gray-100 bg-gray-50/50 space-y-2 shrink-0">
      <div class="flex items-center justify-between">
        <span class="font-semibold text-gray-600 text-[11px] uppercase tracking-wider" title="Berdasarkan tanggal modifikasi file/folder">Filter Tgl Modifikasi</span>
        <button v-if="isFiltering" @click="clearDateFilter"
          class="text-[11px] text-primary hover:underline">
          Reset
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <label class="block min-w-0">
          <span class="text-[11px] text-gray-500">Dari</span>
          <input v-model="startDate" type="date"
            class="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs outline-none focus:border-primary bg-white" />
        </label>
        <label class="block min-w-0">
          <span class="text-[11px] text-gray-500">Sampai</span>
          <input v-model="endDate" type="date"
            class="mt-0.5 w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs outline-none focus:border-primary bg-white" />
        </label>
      </div>
      <p v-if="isFiltering" class="text-[11px] text-gray-500">
        {{ matchCount }} file cocok
      </p>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="files.length === 0" class="text-center text-sm text-gray-400 mt-10">
        No folder selected.<br />Click the + icon to select.
      </div>
      <div v-else-if="filteredFiles.length === 0" class="text-center text-sm text-gray-400 mt-10 px-4">
        Tidak ada file pada rentang tanggal ini.<br />
        <button @click="clearDateFilter" class="text-primary hover:underline mt-1">Reset filter</button>
      </div>
      <ul v-else class="space-y-0.5">
        <AppSidebarNode v-for="node in filteredFiles" :key="node.path" :node="node" :selectedFile="selectedFile"
          :force-open="isFiltering" @select-file="$emit('select-file', $event)"
          @context-menu="handleContextMenu" />
      </ul>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <ContextMenu v-model="showContextMenu" :position="contextMenuPos" :items="contextMenuItems" />
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { ref, h, computed } from 'vue'
import {
  IoOutlineAddCircle,
  IoOutlineOpen,
  IoOutlineApps,
  IoOutlineRocket,
  IoOutlineFlash,
  IoOutlineSearch,
  IoOutlineFolderOpen,
  IoOutlineResize,
  IoOutlineDocumentText,
  IoOutlineRefresh,
  IoOutlineCog
} from '@kalimahapps/vue-icons'
import AppSidebarNode from './AppSidebarNode.vue'
import ContextMenu, { MenuItem } from '../ui/ContextMenu.vue'
import { filterTreeByDateRange, countFiles } from '../../utils/filterTree'

export interface TreeNode {
  name: string
  path: string
  size: number
  mtime: string
  type: 'folder' | 'file'
  children?: TreeNode[]
  fileType?: string
  status?: 'unprocessed' | 'ready' | 'synced'
  parsedData?: {
    name: string
    description: string
    date: string
  }
}

const props = defineProps<{
  files: TreeNode[]
  selectedFile: TreeNode | null
  width: number
}>()

const emit = defineEmits<{
  (e: 'select-folder'): void
  (e: 'select-file', file: TreeNode): void
  (e: 'refresh'): void
  (e: 'show-toast', message: string, type: 'success' | 'error' | 'info'): void
  (e: 'open-ai-settings'): void
}>()

// Date range filter: files match by mtime (YYYY-MM-DD); folders are kept
// only when they contain at least one matching descendant.
const startDate = ref('')
const endDate = ref('')

const isFiltering = computed(() => startDate.value !== '' || endDate.value !== '')

const filteredFiles = computed(() =>
  filterTreeByDateRange(props.files, startDate.value, endDate.value)
)

const matchCount = computed(() => countFiles(filteredFiles.value))

const clearDateFilter = () => {
  startDate.value = ''
  endDate.value = ''
}

// Context Menu State
const showContextMenu = ref(false)
const contextMenuPos = ref({ x: 0, y: 0 })
const contextMenuItems = ref<MenuItem[]>([])

const getMenuItems = (node: TreeNode, apps: string[] = []): MenuItem[] => {
  const isFile = node.type === 'file'
  const items: MenuItem[] = []

  if (isFile) {
    items.push({
      label: 'Open',
      icon: h(IoOutlineOpen),
      action: () => {
        // @ts-ignore
        window.ipcRenderer.invoke('open-file', node.path)
      }
    })

    items.push({
      label: 'Open With',
      icon: h(IoOutlineApps),
      children: [
        ...apps.map(app => ({
          label: app.replace('.exe', '').charAt(0).toUpperCase() + app.replace('.exe', '').slice(1),
          icon: h(IoOutlineRocket),
          action: () => {
            // @ts-ignore
            window.ipcRenderer.invoke('open-with-app', node.path, app)
          }
        })),
        ...(apps.length > 0 ? [{ type: 'divider' as const }] : []),
        {
          label: 'Default Application',
          icon: h(IoOutlineFlash),
          action: () => {
            // @ts-ignore
            window.ipcRenderer.invoke('open-file', node.path)
          }
        },
        {
          label: 'Choose another app...',
          icon: h(IoOutlineSearch),
          action: () => {
            // @ts-ignore
            window.ipcRenderer.invoke('open-with-dialog', node.path)
          }
        }
      ]
    })

    items.push({ type: 'divider' as const })

    // PDF specific actions
    if (node.fileType === 'pdf') {
      items.push({
        label: 'Compress PDF',
        icon: h(IoOutlineResize),
        action: async () => {
          // @ts-ignore
          const success = await window.ipcRenderer.invoke('compress-pdf', node.path)
          if (success) {
            emit('show-toast', 'PDF compressed successfully!', 'success')
            emit('refresh')
          } else {
            emit('show-toast', 'Failed to compress PDF.', 'error')
          }
        }
      })
    } else if (['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'gif'].includes(node.fileType || '')) {
      // Office to PDF conversion
      items.push({
        label: 'Convert to PDF',
        icon: h(IoOutlineDocumentText),
        action: async () => {
          // @ts-ignore
          const success = await window.ipcRenderer.invoke('convert-to-pdf', node.path)
          if (success) {
            emit('show-toast', 'Converted to PDF successfully!', 'success')
            emit('refresh')
          } else {
            emit('show-toast', 'Failed to convert to PDF. Make sure Microsoft Office is installed.', 'error')
          }
        }
      })
    }

    items.push({ type: 'divider' as const })
  }

  items.push({
    label: 'Show in Folder',
    icon: h(IoOutlineFolderOpen),
    action: () => {
      // @ts-ignore
      window.ipcRenderer.invoke('show-item-in-folder', node.path)
    }
  })

  return items
}

const handleContextMenu = async ({ node, x, y }: { node: TreeNode, x: number, y: number }) => {
  contextMenuPos.value = { x, y }

  // Set initial menu while fetching apps
  contextMenuItems.value = getMenuItems(node)
  showContextMenu.value = true

  // Fetch associated apps
  if (node.type === 'file' && node.fileType) {
    try {
      // @ts-ignore
      const apps = await window.ipcRenderer.invoke('get-associated-apps', node.fileType)
      if (apps && apps.length > 0) {
        contextMenuItems.value = getMenuItems(node, apps)
      }
    } catch (err) {
      console.error('Failed to get associated apps:', err)
    }
  }
}
</script>
