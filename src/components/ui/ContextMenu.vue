<template>
  <div 
    v-if="modelValue"
    class="fixed z-[100] min-w-[200px] bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 animate-in fade-in zoom-in-95 duration-100 select-none"
    :style="{ left: position.x + 'px', top: position.y + 'px' }"
    ref="menuRef"
  >
    <template v-for="(item, index) in items" :key="index">
      <!-- Divider -->
      <div v-if="item.type === 'divider'" class="my-1 border-t border-gray-100"></div>
      
      <!-- Action Item -->
      <div 
        v-else
        @click="handleItemClick(item)"
        class="group relative px-3 py-1.5 mx-1 rounded-lg text-sm flex items-center justify-between cursor-pointer transition-all hover:bg-blue-50"
        :class="item.danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:text-blue-700'"
      >
        <div class="flex items-center gap-2.5">
          <component :is="item.icon" v-if="item.icon" class="w-4 h-4" :class="item.danger ? 'text-red-500' : 'text-gray-400 group-hover:text-blue-500'" />
          <span class="font-medium">{{ item.label }}</span>
        </div>
        
        <!-- Submenu Arrow -->
        <svg v-if="item.children" xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        <!-- Submenu -->
        <div 
          v-if="item.children"
          class="invisible group-hover:visible absolute left-[calc(100%-8px)] top-[-6px] min-w-[180px] bg-white rounded-xl shadow-2xl border border-gray-100 py-1.5 animate-in fade-in slide-in-from-left-2 duration-150 z-10"
        >
          <div 
            v-for="(child, cIndex) in item.children" 
            :key="cIndex"
            @click.stop="handleItemClick(child)"
            class="px-3 py-1.5 mx-1 rounded-lg text-sm flex items-center gap-2.5 cursor-pointer transition-all hover:bg-blue-50 text-gray-700 hover:text-blue-700 font-medium"
          >
            <component :is="child.icon" v-if="child.icon" class="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
            <span>{{ child.label }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

export interface MenuItem {
  label?: string
  icon?: any
  action?: () => void
  type?: 'divider' | 'action'
  children?: MenuItem[]
  danger?: boolean
}

const props = defineProps<{
  modelValue: boolean
  position: { x: number, y: number }
  items: MenuItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const menuRef = ref<HTMLElement | null>(null)

const handleItemClick = (item: MenuItem) => {
  if (item.children) return
  if (item.action) item.action()
  emit('update:modelValue', false)
}

const handleClickOutside = (event: MouseEvent) => {
  if (menuRef.value && !menuRef.value.contains(event.target as Node)) {
    emit('update:modelValue', false)
  }
}

watch(() => [props.modelValue, props.position], ([newVal]) => {
  if (newVal) {
    nextTick(() => {
      if (!menuRef.value) return
      
      // Adjust position if menu goes off screen
      const rect = menuRef.value.getBoundingClientRect()
      const winWidth = window.innerWidth
      const winHeight = window.innerHeight
      
      let x = props.position.x
      let y = props.position.y
      
      if (x + rect.width > winWidth) x = winWidth - rect.width - 8
      if (y + rect.height > winHeight) y = winHeight - rect.height - 8
      
      menuRef.value.style.left = `${x}px`
      menuRef.value.style.top = `${y}px`
    })
  }
}, { deep: true })

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
  document.addEventListener('contextmenu', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
  document.removeEventListener('contextmenu', handleClickOutside)
})
</script>

<style scoped>
@keyframes zoom-in-95 {
  from {
    transform: scale(0.95);
  }
  to {
    transform: scale(1);
  }
}

.zoom-in-95 {
  animation: zoom-in-95 0.1s ease-out;
}
</style>
