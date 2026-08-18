# 01 - AI Settings & Generate with AI

## Ringkasan

Menambahkan fitur koneksi ke AI LLM (Gemini / OpenAI custom endpoint) melalui popup settings, serta tombol "Generate with AI" pada field **Nama Kegiatan** dan **Deskripsi Kegiatan** untuk menghasilkan teks berdasarkan isi file yang dipilih.

---

## File yang Dimodifikasi

| File | Perubahan |
|---|---|
| `electron/main.ts` | Tambah IPC handlers: `save-ai-settings`, `get-ai-settings`, `generate-ai` |
| `src/components/layout/AppSidebar.vue` | Tambah tombol settings (gear icon) di header sidebar |
| `src/components/ui/AiSettingsModal.vue` | **Baru** - Modal popup untuk koneksi AI & pengaturan model |
| `src/App.vue` | Tambah tombol "Generate with AI" pada field Nama & Deskripsi; state AI settings; handle generate |

---

## Langkah Implementasi

### Langkah 1: IPC Handlers di Main Process

**File:** `electron/main.ts` (tambah di akhir bagian IPC, setelah line ~557)

#### 1a. `save-ai-settings` - Simpan semua pengaturan AI sekaligus

```ts
ipcMain.handle('save-ai-settings', (_event, settings: {
  provider: string        // 'gemini' | 'openai'
  apiKey: string
  model: string
  baseUrl: string         // custom endpoint untuk OpenAI-compatible
  systemPrompt: string
  temperature: number     // 0.0 - 1.0
  maxTokens: number
}) => {
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_provider', settings.provider)
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_api_key', settings.apiKey)
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_model', settings.model)
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_base_url', settings.baseUrl)
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_system_prompt', settings.systemPrompt)
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_temperature', settings.temperature.toString())
  db?.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('ai_max_tokens', settings.maxTokens.toString())
  return true
})
```

#### 1b. `get-ai-settings` - Ambil semua pengaturan AI

```ts
ipcMain.handle('get-ai-settings', () => {
  const get = (key: string) => {
    const row = db?.prepare('SELECT value FROM settings WHERE key = ?').get(key) as any
    return row ? row.value : ''
  }
  return {
    provider: get('ai_provider'),
    apiKey: get('ai_api_key'),
    model: get('ai_model'),
    baseUrl: get('ai_base_url'),
    systemPrompt: get('ai_system_prompt'),
    temperature: parseFloat(get('ai_temperature') || '0.7'),
    maxTokens: parseInt(get('ai_max_tokens') || '1024')
  }
})
```

#### 1c. `test-ai-connection` - Test koneksi ke AI provider

```ts
ipcMain.handle('test-ai-connection', async (_event, settings: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}) => {
  // Gemini: GET https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}
  // OpenAI-compatible: GET {baseUrl}/v1/models (Authorization: Bearer {apiKey})
  // Return: { success: boolean, models?: string[], error?: string }
})
```

#### 1d. `generate-ai` - Generate teks via AI

```ts
ipcMain.handle('generate-ai', async (_event, payload: {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  fileText: string           // teks hasil parsing dokumen
  tipeKegiatan: string       // dari form dropdown
  kategoriKegiatan: string   // dari form dropdown
  indikatorKinerja: string   // dari form dropdown
  sasaranKinerja: string     // dari form textarea
  target: 'name' | 'description' | 'both'
}) => {
  // Bangun prompt berdasarkan target
  // Kirim request ke provider (Gemini REST API / OpenAI-compatible API)
  // Return: { name?: string, description?: string, error?: string }
})
```

**Detail API calls:**

- **Gemini:** POST `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}`
- **OpenAI-compatible:** POST `{baseUrl}/v1/chat/completions` dengan `Authorization: Bearer {apiKey}`

Keduanya menggunakan JSON body dengan `messages` array (system + user prompt).

---

### Langkah 2: AI Settings Modal Component

**File:** `src/components/ui/AiSettingsModal.vue` (**baru**)

Komponen modal popup dengan struktur:

```
┌─────────────────────────────────────────────────┐
│  AI Settings                              [X]   │
├─────────────────────────────────────────────────┤
│                                                 │
│  Provider        [Gemini ▼] [OpenAI Custom ▼]   │
│                                                 │
│  API Key         [____________________________] │
│                                                 │
│  Base URL*       [____________________________] │  (* hanya untuk OpenAI)
│                                                 │
│  Model           [___________] [Test Connect]   │
│  (dropdown setelah test berhasil)               │
│                                                 │
│  Temperature     [===●====] 0.7                 │
│  Max Tokens      [1024]                         │
│                                                 │
│  System Prompt   [____________________________] │
│                   [____________________________] │
│                   [____________________________] │
│                                                 │
│              [Cancel]  [Save]                    │
└─────────────────────────────────────────────────┘
```

**Props:** `modelValue: boolean` (v-model for open/close)
**Emits:** `update:modelValue`, `saved`

**Alur:**
1. User buka modal -> load settings dari `get-ai-settings`
2. User pilih provider -> tampilkan/base URL field
3. User isi API Key -> klik "Test Connect" -> panggil `test-ai-connection`
4. Jika berhasil -> populate dropdown model dari response
5. User pilih model, atur temperature/maxTokens/systemPrompt
6. User klik "Save" -> panggil `save-ai-settings` -> emit `saved`

**Default System Prompt:**
```
Saya adalah seorang pegawai administrasi di Kejaksaan Negeri PIDIE. Bantu saya menyusun format berikut berdasarkan dokumen yang saya berikan:

Nama kegiatan yang saya kerjakan: [isi berdasarkan dokumen]
Deskripsi kegiatan yang saya kerjakan: [isi berdasarkan dokumen]
```

---

### Langkah 3: Tombol Settings di Sidebar Header

**File:** `src/components/layout/AppSidebar.vue`

Tambah tombol gear icon di header (sebelum tombol Refresh):

```vue
<div class="flex items-center gap-1">
  <!-- Tombol AI Settings (baru) -->
  <button @click="$emit('open-ai-settings')"
    class="p-1.5 hover:bg-gray-200 rounded text-gray-600 flex items-center justify-center"
    title="AI Settings">
    <IoOutlineCog class="text-lg" />
  </button>
  <!-- tombol Refresh & Select Folder existing -->
</div>
```

**Emit baru:** `(e: 'open-ai-settings'): void`

**Import icon:** Tambah `IoOutlineCog` dari `@kalimahapps/vue-icons`

---

### Langkah 4: Integrasi di App.vue

**File:** `src/App.vue`

#### 4a. State tambahan

```ts
// AI Settings
const aiSettings = ref({
  provider: '',
  apiKey: '',
  model: '',
  baseUrl: '',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024
})
const showAiSettings = ref(false)
const isGeneratingName = ref(false)
const isGeneratingDesc = ref(false)
```

#### 4b. Load AI settings on mount

```ts
onMounted(async () => {
  // ... existing code ...
  // Load AI settings
  if (window.ipcRenderer) {
    const settings = await window.ipcRenderer.invoke('get-ai-settings')
    if (settings) aiSettings.value = settings
  }
})
```

#### 4c. Generate functions

```ts
const generateWithName = async () => {
  if (!selectedFile.value || !aiSettings.value.apiKey) {
    showToast("Please configure AI settings first!", "error")
    return
  }
  isGeneratingName.value = true
  try {
    // Ambil teks file yang sudah di-parse
    const fileText = await window.ipcRenderer.invoke('get-file-text', selectedFile.value.path)
    const result = await window.ipcRenderer.invoke('generate-ai', {
      ...aiSettings.value,
      fileText,
      tipeKegiatan: formData.value.tipe_kegiatan,
      kategoriKegiatan: formData.value.kaitan_kegiatan,
      indikatorKinerja: formData.value.id_indikator,
      sasaranKinerja: formData.value.sasaran_kegiatan,
      target: 'name'
    })
    if (result.error) {
      showToast(result.error, "error")
    } else {
      formData.value.name = result.name
      showToast("Nama kegiatan generated!", "success")
    }
  } catch (e) {
    showToast("Failed to generate with AI", "error")
  }
  isGeneratingName.value = false
}

const generateWithDescription = async () => {
  // Sama seperti generateWithName tapi target: 'description'
}
```

#### 4d. Tombol di template

Pada field **Nama Kegiatan** (setelah input):
```vue
<div class="relative">
  <input v-model="formData.name" type="text" ... />
  <button v-if="aiSettings.apiKey" @click="generateWithName" :disabled="isGeneratingName"
    class="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded transition-all flex items-center gap-1"
    :class="{ 'opacity-50 cursor-not-allowed': isGeneratingName }">
    <IoOutlineSparkles v-if="!isGeneratingName" class="text-xs" />
    <IoOutlineSync v-else class="text-xs animate-spin" />
    {{ isGeneratingName ? 'Generating...' : 'Generate with AI' }}
  </button>
</div>
```

Pada field **Deskripsi Kegiatan** (setelah textarea, serupa):
```vue
<div class="relative">
  <textarea v-model="formData.description" rows="3" ... ></textarea>
  <button v-if="aiSettings.apiKey" @click="generateWithDescription" :disabled="isGeneratingDesc"
    class="absolute right-2 top-2 px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded transition-all flex items-center gap-1"
    :class="{ 'opacity-50 cursor-not-allowed': isGeneratingDesc }">
    <IoOutlineSparkles v-if="!isGeneratingDesc" class="text-xs" />
    <IoOutlineSync v-else class="text-xs animate-spin" />
    {{ isGeneratingDesc ? 'Generating...' : 'Generate with AI' }}
  </button>
</div>
```

#### 4e. Handler buka modal

```ts
const openAiSettings = () => {
  showAiSettings.value = true
}
```

---

### Langkah 5: IPC Handler `get-file-text` (opsional tapi disarankan)

**File:** `electron/main.ts`

Untuk mendapatkan teks mentah file (hasil parsing) tanpa heuristic extraction:

```ts
ipcMain.handle('get-file-text', async (_event, filePath: string) => {
  // Panggil parseDocument tetapi return text mentah, bukan extracted info
  // Atau: baca ulang file dan return teks langsung
})
```

**Alternatif:** Gunakan `parse-file` yang sudah ada, tapi simpan raw text di `parsedData`. Saat ini parser hanya return `{ name, description, date }` - tidak ada raw text. Perlu modifikasi `parser.ts` untuk return raw text juga, atau buat IPC handler baru yang return raw text.

**Rekomendasi:** Tambah field `rawText` di return `parseDocument()` di `parser.ts`, lalu simpan di `formData` atau state terpisah. Ini agar tidak perlu parse ulang saat user klik Generate.

---

## Settings Keys di SQLite

| Key | Tipe | Default | Deskripsi |
|---|---|---|---|
| `ai_provider` | TEXT | `''` | `'gemini'` atau `'openai'` |
| `ai_api_key` | TEXT | `''` | API key provider |
| `ai_model` | TEXT | `''` | Nama model (mis. `gemini-2.0-flash`) |
| `ai_base_url` | TEXT | `''` | Custom endpoint (untuk OpenAI-compatible) |
| `ai_system_prompt` | TEXT | *(default prompt)* | System prompt untuk LLM |
| `ai_temperature` | TEXT | `'0.7'` | Temperature (0.0-1.0) |
| `ai_max_tokens` | TEXT | `'1024'` | Max tokens output |

---

## Alur User

```
1. Klik tombol gear di sidebar header
   ↓
2. Modal AI Settings terbuka
   ↓
3. Pilih provider (Gemini / OpenAI Custom)
   ↓
4. Masukkan API Key
   ↓
5. Klik "Test Connection" → ambil daftar model
   ↓
6. Pilih model dari dropdown
   ↓
7. Atur temperature, max tokens, system prompt (opsional)
   ↓
8. Klik "Save" → settings tersimpan di SQLite
   ↓
9. Pilih file di sidebar → form terisi dengan parsed data
   ↓
10. Klik "Generate with AI" di field Nama/Deskripsi
    → file text + form context dikirim ke LLM
    → response mengisi field
   ↓
11. Klik "Save & Sync" untuk sinkron ke MySimkari
```

---

## API Reference

### Gemini REST API

**Test connection:**
```
GET https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}
```

**Generate content:**
```
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}

{
  "contents": [{ "parts": [{ "text": "user prompt" }] }],
  "systemInstruction": { "parts": [{ "text": "system prompt" }] },
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 1024
  }
}
```

### OpenAI-Compatible API

**Test connection:**
```
GET {baseUrl}/v1/models
Header: Authorization: Bearer {apiKey}
```

**Generate content:**
```
POST {baseUrl}/v1/chat/completions
Header: Authorization: Bearer {apiKey}
Header: Content-Type: application/json

{
  "model": "{model}",
  "messages": [
    { "role": "system", "content": "system prompt" },
    { "role": "user", "content": "user prompt" }
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}
```

---

## Prompt Template untuk Generate

### Generate Nama Kegiatan

```
[System Prompt]:
{sasaranSystemPrompt}

[User Prompt]:
Berdasarkan dokumen berikut, buatkan nama kegiatan yang singkat dan formal (maksimal 100 karakter):

Konteks:
- Tipe Kegiatan: {tipe_kegiatan}
- Kategori: {kaitan_kegiatan}
- Indikator: {id_indikator}

Isi Dokumen:
{fileText}

Format output: Tulis hanya nama kegiatannya saja, tanpa penjelasan tambahan.
```

### Generate Deskripsi Kegiatan

```
[System Prompt]:
{sasaranSystemPrompt}

[User Prompt]:
Berdasarkan dokumen berikut, buatkan deskripsi kegiatan yang detail dan formal (maksimal 300 karakter):

Konteks:
- Tipe Kegiatan: {tipe_kegiatan}
- Kategori: {kaitan_kegiatan}
- Indikator: {id_indikator}
- Sasaran: {sasaran_kegiatan}

Isi Dokumen:
{fileText}

Format output: Tulis hanya deskripsi kegiatannya saja, tanpa penjelasan tambahan.
```

---

## Catatan Teknis

- **Tidak perlu `.env`** - API key disimpan di SQLite (sudah ada pattern `save-setting`/`get-setting`)
- **No new dependencies** - HTTP requests ke AI API pakai native `fetch` (Node.js 18+ / Electron)
- **Context isolation: false** - IPC calls pakai `window.ipcRenderer.invoke()` langsung (sudah ada pattern `// @ts-ignore`)
- **Error handling** - semua AI calls harus handle rate limit, invalid key, network error
- **Loading state** - tombol Generate harus disable + tampilkan spinner saat proses
- **Abaikan** - tombol Generate tidak muncul jika AI belum dikonfigurasi (`aiSettings.apiKey === ''`)
