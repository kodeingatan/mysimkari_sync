<template>
  <div class="relative" ref="dropdownRef">
    <!-- Trigger -->
    <div 
      @click="toggleDropdown"
      class="w-full px-4 py-2 rounded-lg border border-gray-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary bg-white transition-all cursor-pointer flex items-center justify-between group"
      :class="{ 'border-primary ring-1 ring-primary': isOpen }"
    >
      <span class="text-sm truncate" :class="{ 'text-gray-400': !selectedLabel }">
        {{ selectedLabel || placeholder }}
      </span>
      <div class="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform duration-200" :class="{ 'rotate-180': isOpen }" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <!-- Dropdown -->
    <div 
      v-if="isOpen"
      class="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
    >
      <!-- Search -->
      <div class="p-2 border-b border-gray-50">
        <div class="relative">
          <input 
            v-model="searchQuery"
            type="text"
            ref="searchInputRef"
            class="w-full pl-9 pr-4 py-2 bg-gray-50 border-none rounded-lg text-sm focus:ring-0 placeholder-gray-400"
            :placeholder="'Cari ' + placeholder.toLowerCase() + '...'"
            @keydown.esc="isOpen = false"
          >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      <!-- Options -->
      <div class="max-h-64 overflow-y-auto custom-scrollbar py-1">
        <div 
          v-for="option in filteredOptions" 
          :key="option.value"
          @click="selectOption(option)"
          class="px-4 py-2.5 text-xs cursor-pointer hover:bg-blue-50 transition-colors flex items-start justify-between gap-2 leading-relaxed"
          :class="{ 'bg-blue-50 text-primary font-medium': option.value === modelValue }"
        >
          <span class="break-words whitespace-normal flex-1">{{ option.label }}</span>
          <svg v-if="option.value === modelValue" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
          </svg>
        </div>
        <div v-if="filteredOptions.length === 0" class="px-4 py-8 text-center text-gray-400 text-sm italic">
          Data tidak ditemukan
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps<{
  modelValue: string | number
  options: Array<{ label: string, value: string | number, [key: string]: any }>
  placeholder: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
  (e: 'change', value: string | number): void
}>()

const isOpen = ref(false)
const searchQuery = ref('')
const dropdownRef = ref<HTMLElement | null>(null)
const searchInputRef = ref<HTMLInputElement | null>(null)

const selectedLabel = computed(() => {
  const option = props.options.find(opt => opt.value === props.modelValue)
  return option ? option.label : ''
})

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options
  const query = searchQuery.value.toLowerCase()
  return props.options.filter(opt => 
    opt.label.toLowerCase().includes(query) || 
    String(opt.value).toLowerCase().includes(query)
  )
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    searchQuery.value = ''
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
}

const selectOption = (option: any) => {
  emit('update:modelValue', option.value)
  emit('change', option.value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #d1d5db;
}

@keyframes animate-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-in {
  animation: animate-in 0.2s ease-out forwards;
}
</style>
