<template>
  <IoSharpDocumentText v-if="type === 'pdf'" class="text-red-500 shrink-0 text-lg" />
  <IoSharpDocument v-else-if="type === 'docx' || type === 'doc'" class="text-blue-500 shrink-0 text-lg" />
  <IoSharpGrid v-else-if="type === 'xlsx' || type === 'xls'" class="text-green-500 shrink-0 text-lg" />
  <IoSharpEasel v-else-if="type === 'pptx' || type === 'ppt'" class="text-orange-600 shrink-0 text-lg" />
  <IoSharpDocument v-else class="text-gray-400 shrink-0 text-lg" />
</template>

<script setup lang="ts">
import { IoSharpDocumentText, IoSharpDocument, IoSharpGrid, IoSharpEasel } from '@kalimahapps/vue-icons';

defineProps<{
  type: string
}>()
</script>
