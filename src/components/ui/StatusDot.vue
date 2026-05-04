<template>
  <div class="w-2 h-2 rounded-full shrink-0" 
       :class="{
         'bg-gray-300': status === 'unprocessed',
         'bg-warning': status === 'ready',
         'bg-success': status === 'synced'
       }"
       :title="status"></div>
</template>

<script setup lang="ts">
defineProps<{
  status: 'unprocessed' | 'ready' | 'synced'
}>()
</script>
