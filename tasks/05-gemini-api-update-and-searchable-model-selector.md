# 05 - Gemini API Update & Searchable Model Selector

## Ringkasan

Perbarui integrasi Gemini AI agar menggunakan endpoint REST terbaru (`/interactions` dengan header `x-goog-api-key`) dan tampilkan input Base URL khusus untuk provider Gemini. Ganti dropdown model biasa menjadi komponen `SearchSelectItem` yang sudah mendukung pencarian/filter.

---

## File yang Dimodifikasi

| File | Perubahan |
|---|---|
| `src/components/ui/AiSettingsModal.vue` | Base URL field untuk Gemini, default baseUrl dinamis, model selector pakai `SearchSelectItem` |
| `electron/main.ts` | `test-ai-connection` pakai `baseUrl` untuk Gemini; `generate-ai` pakai endpoint `/interactions` + header `x-goog-api-key` |

---

## Perubahan Detail

### 1. Base URL untuk Gemini

**Saat ini:** Base URL hanya muncul untuk provider `openai`. Default `form.baseUrl` adalah `https://api.openai.com`.

**Setelah:**
- Jika provider === `gemini` → tampilkan input Base URL dengan default `https://generativelanguage.googleapis.com/v1beta`
- Jika provider === `openai` → tampilkan input Base URL dengan default `https://api.openai.com`

**Di `AiSettingsModal.vue` line 67-73**, ubah kondisi dari:
```vue
<div v-if="form.provider === 'openai'">
```
menjadi:
```vue
<div v-if="form.provider === 'gemini' || form.provider === 'openai'">
```

Dan set default `baseUrl` di `form` ref secara dinamis:
```ts
const form = ref({
  provider: 'gemini',
  apiKey: '',
  model: '',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024
})
```

**Di `loadSettings`**, tetap load `baseUrl` dari settings (tidak di-hardcode ulang).

---

### 2. Test Connection menggunakan Base URL

**File:** `electron/main.ts` line 700-703

**Saat ini:**
```ts
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models?key=${settings.apiKey}`,
);
```

**Setelah:**
```ts
const baseUrl = settings.baseUrl.replace(/\/+$/, "");
const res = await fetch(`${baseUrl}/models?key=${settings.apiKey}`);
```

Ini memastikan jika user mengubah base URL (misal ke proxy atau regional endpoint), test connection tetap mengikuti.

---

### 3. Generate AI menggunakan endpoint `/interactions`

**File:** `electron/main.ts` line 797-821

**Saat ini:**
```ts
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${payload.model}:generateContent?key=${payload.apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: userPrompt }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: { ... }
    }),
  }
);
```

**Setelah:**
```ts
const baseUrl = payload.baseUrl.replace(/\/+$/, "");
const res = await fetch(`${baseUrl}/interactions?key=${payload.apiKey}`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-goog-api-key": payload.apiKey,
  },
  body: JSON.stringify({
    model: payload.model,
    input: userPrompt,
  }),
});
```

**Response handling:**
- Response JSON structure untuk `/interactions` kemungkinan berbeda dari `:generateContent`. Perlu disesuaikan setelah dokumentasi resmi Gemini REST API divalidasi.
- Fallback: jika response tidak sesuai, log error dan return generic message.

**Catatan:** Endpoint `/interactions` adalah endpoint Gemini yang lebih baru. Pastikan response parsing sesuai dengan schema yang benar.

---

### 4. Model Selection jadi Searchable

**File:** `src/components/ui/AiSettingsModal.vue` line 93-108

**Saat ini:** Pakai native `<select>` dengan `<option>`.

**Setelah:** Pakai komponen `SearchSelectItem` yang sudah ada di project dan sudah mendukung pencarian/filter.

```vue
<SearchSelectItem
  v-model="form.model"
  :options="models.map(m => ({ label: m, value: m }))"
  placeholder="Pilih model..."
  @change="onModelChange"
/>
```

**Import yang dibutuhkan:**
```ts
import SearchSelectItem from './SearchSelectItem.vue'
```

---

## Interface / Kontrak

### `test-ai-connection` (updated)

```ts
{
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}
```

**Response Gemini (updated):**
```ts
{
  success: boolean
  models?: string[]
  error?: string
}
```

**Endpoint:** `GET {baseUrl}/models?key={apiKey}`

### `generate-ai` (updated)

```ts
{
  provider: string
  apiKey: string
  model: string
  baseUrl: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  fileText: string
  tipeKegiatan: string
  kategoriKegiatan: string
  indikatorKinerja: string
  sasaranKinerja: string
  target: 'name' | 'description' | 'both'
}
```

**Response:**
```ts
{
  name?: string
  description?: string
  error?: string
}
```

**Endpoint Gemini:** `POST {baseUrl}/interactions?key={apiKey}`

---

## Default Values

| Setting | Default (Gemini) | Default (OpenAI) |
|---|---|---|
| `baseUrl` | `https://generativelanguage.googleapis.com/v1beta` | `https://api.openai.com` |
| Test endpoint | `GET {baseUrl}/models?key={apiKey}` | `GET {baseUrl}/v1/models` (Bearer) |
| Generate endpoint | `POST {baseUrl}/interactions?key={apiKey}` | `POST {baseUrl}/v1/chat/completions` (Bearer) |

---

## Model Selector Search

Komponen `SearchSelectItem` sudah memiliki:
- Input pencarian dengan filter berdasarkan `label` dan `value`
- Dropdown dengan max-height scrollable
- Highlight selected item
- Click outside to close

Tidak perlu modifikasi tambahan pada `SearchSelectItem.vue`.

---

## Testing

### Manual Testing Checklist

| # | Test Case | Expected |
|---|---|---|
| 1 | Pilih provider Gemini → Base URL muncul dengan default `https://generativelanguage.googleapis.com/v1beta` | Input terisi dengan default Gemini |
| 2 | Pilih provider OpenAI → Base URL muncul dengan default `https://api.openai.com` | Input terisi dengan default OpenAI |
| 3 | Klik Test Connection (Gemini) → panggil `GET {baseUrl}/models?key={apiKey}` | Model list ter-load |
| 4 | Klik Test Connection (OpenAI) → panggil `GET {baseUrl}/v1/models` | Model list ter-load |
| 5 | Klik Generate (Gemini) → panggil `POST {baseUrl}/interactions?key={apiKey}` | Nama/deskripsi ter-generate |
| 6 | Model selector → klik dropdown → ketik di search box → filter bekerja | Model terfilter sesuai input |
| 7 | Model selector → pilih model → model ter-select | `form.model` ter-update |
| 8 | Simpan settings → restart app → settings ter-load | Settings persisten |

### Verification Command

```bash
npm run build
```

---

## Catatan Teknis

- **Backward compatibility:** Endpoint lama `:generateContent` untuk Gemini tidak dihapus dari codebase, hanya dialihkan ke `/interactions`. Jika `/interactions` gagal, bisa dipertimbangkan fallback ke endpoint lama (tapi tidak diimplementasikan di task ini).
- **Header `x-goog-api-key`:** Digunakan untuk Gemini REST API authentication, menggantikan query parameter `?key=` pada beberapa endpoint. Tetap sertakan `?key=` di URL untuk compatibility.
- **Model selector:** `SearchSelectItem` expects `options` sebagai array of `{ label, value, [key: string]: any }`. Mapping dari `models` (array of string) ke format ini dilakukan di template.
- **No new dependencies:** Semua komponen yang dibutuhkan sudah ada di project.

---

## Implementation Order

1. Update `AiSettingsModal.vue` — Base URL visibility + default dinamis + model selector
2. Update `electron/main.ts` `test-ai-connection` — gunakan `baseUrl`
3. Update `electron/main.ts` `generate-ai` — endpoint `/interactions` + header baru
4. Test manual dengan API key Gemini yang valid
5. `npm run build` — pastikan clean
