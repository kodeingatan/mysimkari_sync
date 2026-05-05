<template>
  <li>
    <!-- Folder -->
    <div v-if="node.type === 'folder'" class="flex flex-col">
      <div 
        class="px-3 py-1.5 rounded-md cursor-pointer text-sm flex items-center gap-2 hover:bg-gray-100 transition-colors text-gray-700 font-medium"
        @click="isOpen = !isOpen"
        @contextmenu.prevent.stop="$emit('context-menu', { node, x: $event.clientX, y: $event.clientY })"
      >
        <IoOutlineChevronForward 
          class="shrink-0 transition-transform duration-200 text-gray-400" 
          :class="{'rotate-90': isOpen}"
        />
        <component 
          :is="isOpen ? IoSharpFolderOpen : IoSharpFolder" 
          class="text-blue-400 shrink-0 text-lg"
        />
        <span class="truncate">{{ node.name }}</span>
      </div>
      
      <div v-if="isOpen && node.children" class="ml-3 border-l border-gray-100 pl-2 mt-0.5 space-y-0.5">
        <AppSidebarNode 
          v-for="child in node.children" 
          :key="child.path" 
          :node="child"
          :selectedFile="selectedFile"
          @select-file="$emit('select-file', $event)"
          @context-menu="$emit('context-menu', $event)"
        />
      </div>
    </div>

    <!-- File -->
    <div v-else
         class="px-3 py-1.5 rounded-md cursor-pointer text-sm flex items-center gap-2 transition-colors ml-1"
         :class="selectedFile?.path === node.path ? 'bg-blue-50 text-blue-700 font-medium' : 'hover:bg-gray-100 text-gray-600'"
         @click="$emit('select-file', node)"
         @contextmenu.prevent.stop="$emit('context-menu', { node, x: $event.clientX, y: $event.clientY })">
      
      <FileIcon :type="node.fileType || ''" />
      <span class="truncate flex-1">{{ node.name }}</span>
      <StatusDot :status="node.status || 'unprocessed'" />
    </div>
  </li>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { IoOutlineChevronForward, IoSharpFolder, IoSharpFolderOpen } from '@kalimahapps/vue-icons'
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
