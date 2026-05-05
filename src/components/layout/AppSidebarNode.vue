<template>
  <li>
    <!-- Folder -->
    <div v-if="node.type === 'folder'" class="flex flex-col">
      <div 
        class="px-3 py-1.5 rounded-md cursor-pointer text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors text-gray-700 font-medium"
        @click="isOpen = !isOpen"
        @contextmenu.prevent.stop="$emit('context-menu', { node, x: $event.clientX, y: $event.clientY })"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 transition-transform" :class="{'rotate-90': isOpen}">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <svg class="text-blue-400 shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
        <span class="truncate">{{ node.name }}</span>
      </div>
      
      <ul v-if="isOpen && node.children" class="pl-4 space-y-0.5 mt-0.5 border-l border-gray-200 ml-5">
        <AppSidebarNode 
          v-for="child in node.children" 
          :key="child.path" 
          :node="child"
          :selectedFile="selectedFile"
          @select-file="$emit('select-file', $event)"
          @context-menu="$emit('context-menu', $event)"
        />
      </ul>
    </div>

    <!-- File -->
    <div v-else
         class="px-3 py-1.5 rounded-md cursor-pointer text-sm flex items-center gap-2 transition-colors ml-1"
         :class="selectedFile?.path === node.path ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600'"
         @click="$emit('select-file', node)"
         @contextmenu.prevent.stop="$emit('context-menu', { node, x: $event.clientX, y: $event.clientY })">
      
      <FileIcon :type="node.fileType" />
      <span class="truncate flex-1">{{ node.name }}</span>
      <StatusDot :status="node.status" />
    </div>
  </li>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import FileIcon from '../ui/FileIcon.vue'
import StatusDot from '../ui/StatusDot.vue'
import type { TreeNode } from './AppSidebar.vue'

defineProps<{
  node: TreeNode
  selectedFile: any
}>()

defineEmits<{
  (e: 'select-file', file: any): void
  (e: 'context-menu', payload: { node: TreeNode, x: number, y: number }): void
}>()

const isOpen = ref(false)
</script>
