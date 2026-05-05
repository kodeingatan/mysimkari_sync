<template>
  <header style="-webkit-app-region: drag;" class="h-14 bg-surface border-b border-gray-200 flex items-center px-6 pr-[140px] shadow-sm z-10 justify-between">
    <div class="flex items-center gap-3">
      <IoOutlineSyncCircle class="text-3xl text-primary" />
      <h1 class="text-xl font-semibold tracking-tight">MySimkari Sync</h1>
    </div>
    <div class="flex items-center gap-4">
      <span class="text-sm font-medium" :class="isLoggedIn ? 'text-success' : 'text-warning'">
        {{ isLoggedIn ? 'Connected to MySimkari' : 'Not Connected' }}
      </span>
      <button 
        v-if="!isLoggedIn"
        @click="$emit('login')"
        style="-webkit-app-region: no-drag;"
        class="px-4 py-1.5 bg-primary hover:bg-blue-600 text-white rounded-md text-sm font-medium transition-colors flex items-center gap-2"
      >
        <IoOutlineLogIn />
        Login
      </button>
      <button 
        v-else
        @click="$emit('logout')"
        style="-webkit-app-region: no-drag;"
        class="px-4 py-1.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 border border-gray-200 hover:border-red-200 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
      >
        <IoOutlineLogOut />
        Logout
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { IoOutlineSyncCircle, IoOutlineLogIn, IoOutlineLogOut } from '@kalimahapps/vue-icons';

defineProps<{
  isLoggedIn: boolean
}>()

defineEmits<{
  (e: 'login'): void
  (e: 'logout'): void
}>()
</script>
