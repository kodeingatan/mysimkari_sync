<template>
  <span class="px-3 py-1 text-xs font-semibold rounded-full border flex items-center gap-1.5 w-fit"
        :class="{
          'bg-gray-50 text-gray-600 border-gray-200': status === 'unprocessed',
          'bg-yellow-50 text-yellow-700 border-yellow-200': status === 'ready',
          'bg-green-50 text-green-700 border-green-200': status === 'synced'
        }">
    <IoOutlineHelpCircle v-if="status === 'unprocessed'" class="text-sm" />
    <IoOutlineCheckmarkCircle v-else-if="status === 'ready'" class="text-sm" />
    <IoOutlineCloudDone v-else-if="status === 'synced'" class="text-sm" />
    {{ status.toUpperCase() }}
  </span>
</template>

<script setup lang="ts">
import { IoOutlineHelpCircle, IoOutlineCheckmarkCircle, IoOutlineCloudDone } from '@kalimahapps/vue-icons';

defineProps<{
  status: 'unprocessed' | 'ready' | 'synced'
}>()
</script>
