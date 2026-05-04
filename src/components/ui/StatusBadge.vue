<template>
  <span class="px-3 py-1 text-xs font-semibold rounded-full border"
        :class="{
          'bg-gray-50 text-gray-600 border-gray-200': status === 'unprocessed',
          'bg-yellow-50 text-yellow-700 border-yellow-200': status === 'ready',
          'bg-green-50 text-green-700 border-green-200': status === 'synced'
        }">
    {{ status.toUpperCase() }}
  </span>
</template>

<script setup lang="ts">
defineProps<{
  status: 'unprocessed' | 'ready' | 'synced'
}>()
</script>
