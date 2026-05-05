<template>
  <aside class="w-72 bg-surface border-r border-gray-200 flex flex-col">
    <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
      <h2 class="font-semibold text-gray-700 text-sm uppercase tracking-wider">Explorer</h2>
      <button @click="$emit('select-folder')" class="p-1.5 hover:bg-gray-200 rounded text-gray-600"
        title="Select Folder">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path
            d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z">
          </path>
          <line x1="12" y1="10" x2="12" y2="16"></line>
          <line x1="9" y1="13" x2="15" y2="13"></line>
        </svg>
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

defineProps<{
  files: TreeNode[]
  selectedFile: TreeNode | null
}>()

defineEmits<{
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
      icon: h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
        h('polyline', { points: '15 3 21 3 21 9' }),
        h('line', { x1: '10', y1: '14', x2: '21', y2: '3' })
      ]),
      action: () => {
        // @ts-ignore
        window.ipcRenderer.invoke('open-file', node.path)
      }
    })

    items.push({
      label: 'Open With',
      icon: h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
        h('rect', { x: '2', y: '3', width: '20', height: '14', rx: '2', ry: '2' }),
        h('line', { x1: '8', y1: '21', x2: '16', y2: '21' }),
        h('line', { x1: '12', y1: '17', x2: '12', y2: '21' })
      ]),
      children: [
        ...apps.map(app => ({
          label: app.replace('.exe', '').charAt(0).toUpperCase() + app.replace('.exe', '').slice(1),
          icon: h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
            h('circle', { cx: '12', cy: '12', r: '10' }),
            h('path', { d: 'M12 16v-4' }),
            h('path', { d: 'M12 8h.01' })
          ]),
          action: () => {
            // @ts-ignore
            window.ipcRenderer.invoke('open-with-app', node.path, app)
          }
        })),
        ...(apps.length > 0 ? [{ type: 'divider' as const }] : []),
        {
          label: 'Default Application',
          icon: h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
            h('circle', { cx: '12', cy: '12', r: '10' }),
            h('polyline', { points: '12 6 12 12 16 14' })
          ]),
          action: () => {
            // @ts-ignore
            window.ipcRenderer.invoke('open-file', node.path)
          }
        },
        {
          label: 'Choose another app...',
          icon: h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
            h('circle', { cx: '11', cy: '11', r: '8' }),
            h('line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' })
          ]),
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
    icon: h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
      h('path', { d: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z' })
    ]),
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
