<template>
  <aside class="w-72 bg-surface border-r border-gray-200 flex flex-col">
    <div class="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
      <h2 class="font-semibold text-gray-700 text-sm uppercase tracking-wider">Explorer</h2>
      <button @click="$emit('select-folder')" class="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Select Folder">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"></path><line x1="12" y1="10" x2="12" y2="16"></line><line x1="9" y1="13" x2="15" y2="13"></line></svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <div v-if="files.length === 0" class="text-center text-sm text-gray-400 mt-10">
        No folder selected.<br/>Click the + icon to select.
      </div>
      <ul v-else class="space-y-0.5">
        <AppSidebarNode 
          v-for="node in files" 
          :key="node.path" 
          :node="node"
          :selectedFile="selectedFile"
          @select-file="$emit('select-file', $event)"
        />
      </ul>
    </div>
  </aside>
</template>

<script setup lang="ts">
import AppSidebarNode from './AppSidebarNode.vue'

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
</script>
