# 02 - Fix fileRawText + Generate All Button

## Masalah

Tombol "Generate AI" menampilkan error `No file text available. Select a file first.` karena `fileRawText` hanya diisi saat file berstatus `unprocessed` (baru pertama dipilih). Jika file sudah pernah diparsing (status `ready`/`synced`), `fileRawText` tidak pernah diisi.

**Root cause di `src/App.vue` line 483-485:**
```ts
} else if (file.parsedData) {
  // Hanya restore formData, TIDAK load fileRawText
  formData.value = { ...formData.value, ...file.parsedData, date: ... }
}
```

---

## File yang Dimodifikasi

| File | Perubahan |
|---|---|
| `src/App.vue` | Fix `selectFile` agar `fileRawText` selalu diisi; tambah tombol "Generate All"; tambah `generateAll()` function |

---

## Langkah Implementasi

### Langkah 1: Fix `fileRawText` di `selectFile`

**File:** `src/App.vue`, baris 483-485

Tambahkan panggilan `get-file-text` di branch `else if (file.parsedData)`:

```ts
} else if (file.parsedData) {
  formData.value = { ...formData.value, ...file.parsedData, date: mtime || (file.parsedData as any).date || '' }
  // FIX: Load rawText untuk file yang sudah pernah diparsed
  if (window.ipcRenderer) {
    const rawText = await window.ipcRenderer.invoke('get-file-text', file.path)
    fileRawText.value = rawText || ''
  }
}
```

### Langkah 2: Tambah tombol "Generate All" di template

**File:** `src/App.vue`, letakkan di atas tombol Cancel/Save & Sync (sebelum `<div class="mt-8 flex justify-end gap-3">`)

```html
<!-- Generate All with AI -->
<div v-if="aiSettings.apiKey && selectedFile.status !== 'unprocessed'" class="mt-6 pt-4 border-t border-gray-100">
  <button
    @click="generateAll"
    :disabled="isGeneratingAll"
    class="w-full px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-primary to-blue-500 hover:from-blue-600 hover:to-blue-600 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2"
    :class="{ 'opacity-50 cursor-not-allowed': isGeneratingAll }"
  >
    <IoOutlineSparkles v-if="!isGeneratingAll" class="text-base" />
    <IoOutlineSync v-else class="text-base animate-spin" />
    {{ isGeneratingAll ? 'Generating All Fields...' : 'Generate All with AI' }}
  </button>
  <p class="text-[10px] text-gray-400 text-center mt-1.5">
    Generate Nama Kegiatan & Deskripsi Kegiatan dari file yang dipilih
  </p>
</div>
```

### Langkah 3: Tambah state `isGeneratingAll` dan function `generateAll`

**File:** `src/App.vue`

State (tambah di dekat `isGeneratingName` / `isGeneratingDesc`):
```ts
const isGeneratingAll = ref(false)
```

Function:
```ts
const generateAll = async () => {
  if (!selectedFile.value) return
  if (!aiSettings.value.apiKey) {
    showToast("Please configure AI settings first!", "error")
    showAiSettings.value = true
    return
  }
  if (!fileRawText.value) {
    showToast("No file text available. Select a file first.", "error")
    return
  }

  isGeneratingAll.value = true

  try {
    // @ts-ignore
    const result = await window.ipcRenderer.invoke('generate-ai', {
      ...aiSettings.value,
      fileText: fileRawText.value,
      tipeKegiatan: formData.value.tipe_kegiatan,
      kategoriKegiatan: formData.value.kaitan_kegiatan,
      indikatorKinerja: formData.value.id_indikator,
      sasaranKinerja: formData.value.sasaran_kegiatan,
      target: 'both'
    })

    if (result.error) {
      showToast(result.error, "error")
    } else {
      if (result.name) formData.value.name = result.name
      if (result.description) formData.value.description = result.description
      showToast("All fields generated with AI!", "success")
    }
  } catch {
    showToast("Failed to generate with AI", "error")
  }

  isGeneratingAll.value = false
}
```

---

## Urutan Tombol di Form

```
┌─────────────────────────────────────────┐
│  [Form Fields...]                       │
│                                         │
│  ───── border-top ─────                 │
│  [✨ Generate All with AI]  ← baru      │
│                                         │
│  [Cancel]  [Save & Sync]                │
└─────────────────────────────────────────┘
```

Tombol "Generate All with AI" hanya muncul jika:
- AI sudah dikonfigurasi (`aiSettings.apiKey` ada)
- File tidak berstatus `unprocessed` (sudah diparsing)
