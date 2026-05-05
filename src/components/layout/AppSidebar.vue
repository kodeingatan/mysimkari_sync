<template>
  <aside class="w-72 bg-surface border-r border-gray-200 flex flex-col">
    <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
      <h2 class="font-semibold text-gray-700 text-sm uppercase tracking-wider">Explorer</h2>
      <button @click="$emit('select-folder')"
        class="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center justify-center" title="Select Folder">
        <IoOutlineAddCircle class="text-xl" />
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="files.length === 0" class="text-center text-sm text-gray-400 mt-10">
        No folder selected.<br />Click the + icon to select.
      </div>
      <ul v-else class="space-y-0.5">
        <AppSidebarNode v-for="node in files" :key="node.path" :node="node" :selectedFile="selectedFile"
          @select-file="$emit('select-file', $event)" @context-menu="handleContextMenu" />
      </ul>
    </div>

    <!-- Context Menu -->
    <Teleport to="body">
      <ContextMenu v-model="showContextMenu" :position="contextMenuPos" :items="contextMenuItems" />
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { ref, h } from 'vue'
import {
  IoOutlineAddCircle,
  IoOutlineOpen,
  IoOutlineApps,
  IoOutlineRocket,
  IoOutlineFlash,
  IoOutlineSearch,
  IoOutlineFolderOpen
} from '@kalimahapps/vue-icons'
import AppSidebarNode from './AppSidebarNode.vue'
import ContextMenu, { MenuItem } from '../ui/ContextMenu.vue'

export interface TreeNode {
  name: string
  path: string
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
}>()

const emit = defineEmits<{
  (e: 'select-folder'): void
  (e: 'select-file', file: TreeNode): void
}>()

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
