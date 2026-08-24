# 04 - Document Parser Refactor

## Masalah

`electron/parser.ts` saat ini (78 baris) punya beberapa kelemahan:

1. **DOC lama (.doc) tidak ditangani.** `mammoth` hanya support `.docx`. File `.doc` akan menghasilkan teks kosong.
2. **Tidak ada OCR.** File gambar (JPG, PNG, dst) dan PDF scanned menghasilkan `rawText` kosong.
3. **XLSX hanya baca sheet pertama.** Multi-sheet workbook kehilangan data dari sheet lain.
4. **Tidak ada image preprocessing.** OCR tanpa grayscale/normalize/sharpen menghasilkan kualitas rendah.
5. **Semua logic dalam satu fungsi.** Sulit di-maintain dan test.
6. **`rawText` limit 5000 char.** Terlalu sedikit untuk AI generation.
7. **`extractInfoFromText` sangat sederhana.** Heuristic bisa ditingkatkan.

**Catatan:** Task 03 sudah merencanakan OCR dasar dengan `tesseract.js`. Task ini **superset** dari task 03 — menambah DOC handling via LibreOffice, image preprocessing dengan Sharp, PDF scanned fallback, dan restrukturisasi modul.

---

## Pendekatan

### Library baru yang dibutuhkan

| Package | Alasan | Size |
|---|---|---|
| `tesseract.js` | OCR engine (WASM, no native dep) | ~3MB + ~15MB lang data |
| `sharp` | Image preprocessing untuk OCR | Native, ~3MB |
| `pdfjs-dist` | Render PDF halaman ke gambar untuk OCR | ~2MB |

**Tidak perlu install LibreOffice** — di Windows, kita bisa pakai **PowerShell COM automation** (sudah ada pola di `main.ts` untuk konversi DOC/PPT ke PDF). Ini lebih ringan dan konsisten dengan Windows-only approach project ini.

### Dependency strategy

- `sharp` → image preprocessing (grayscale, normalize, sharpen, resize)
- `tesseract.js` → OCR engine
- `pdfjs-dist` → render PDF pages to canvas untuk OCR fallback
- PowerShell COM → DOC ke DOCX conversion (sudah tersedia di Windows)

---

## File yang Dimodifikasi/Dibuat

| File | Status | Keterangan |
|---|---|---|
| `package.json` | Modify | Tambah dependencies |
| `electron/parser.ts` | **Rewrite** | Router + orchestrator |
| `electron/parser/pdf-parser.ts` | **Baru** | PDF text + scanned fallback |
| `electron/parser/office-parser.ts` | **Baru** | DOC/DOCX via mammoth + PowerShell |
| `electron/parser/spreadsheet-parser.ts` | **Baru** | XLS/XLSX multi-sheet |
| `electron/parser/presentation-parser.ts` | **Baru** | PPT/PPTX via officeparser |
| `electron/parser/image-ocr.ts` | **Baru** | Image preprocessing + tesseract OCR |
| `electron/parser/types.ts` | **Baru** | Shared types |
| `electron/parser/utils.ts` | **Baru** | extractInfoFromText + helpers |

### Struktur target

```
electron/
├── parser.ts              ← Router (parseDocument)
├── parser/
│   ├── types.ts           ← ParsedData, ParserResult
│   ├── utils.ts           ← extractInfoFromText, normalizeExt
│   ├── pdf-parser.ts      ← PDF text + scanned fallback
│   ├── office-parser.ts   ← DOC/DOCX
│   ├── spreadsheet-parser.ts ← XLS/XLSX multi-sheet
│   ├── presentation-parser.ts ← PPT/PPTX
│   └── image-ocr.ts       ← Image preprocessing + OCR
├── main.ts                ← Tidak berubah (import tetap dari parser.ts)
└── preload.ts
```

---

## Detail Per Modul

### 1. `parser/types.ts` — Shared Types

```ts
export interface ParsedData {
  name: string
  description: string
  date: string
  rawText: string
}

export interface ParserResult {
  text: string
  metadata?: Record<string, any>
}

export type SupportedExtension =
  | 'pdf' | 'doc' | 'docx'
  | 'xls' | 'xlsx'
  | 'ppt' | 'pptx'
  | 'jpg' | 'jpeg' | 'png'
  | 'bmp' | 'tiff' | 'tif'
  | 'webp' | 'gif'
```

### 2. `parser/utils.ts` — Extract Info + Helpers

- `normalizeExt(filePath, fileType?)` — normalisasi ekstensi dari path atau argumen
- `extractInfoFromText(text)` — heuristic name/description/date (existing logic, bisa ditingkatkan)
- `IMAGE_EXTS`, `OFFICE_EXTS`, `SPREADSHEET_EXTS`, `PRESENTATION_EXTS` — constants

### 3. `parser/pdf-parser.ts` — PDF dengan Scanned Fallback

**Alur:**
```
PDF → pdf-parse (text extraction)
  ↓
text.length >= 50? → return text
  ↓ (fallback)
pdfjs-dist → render halaman ke canvas
  ↓
sharp → preprocess setiap gambar halaman
  ↓
tesseract.js → OCR → return text
```

**Catatan:** `pdfjs-dist` di Node.js butuh canvas polyfill. Alternatif: gunakan `tesseract.js` langsung pada file PDF (v5 support PDF recognition). Atau render via `pdfjs-dist` + `canvas` npm package.

**Pilihan pragmatic:** Untuk Electron, `tesseract.js` v5 bisa langsung handle PDF. Jadi cukup:
1. `pdf-parse` → text extraction
2. Jika text < 50 chars → `Tesseract.recognize(filePath, 'ind+eng')` langsung

### 4. `parser/office-parser.ts` — DOC/DOCX

**Alur:**
```
DOCX → mammoth.extractRawText() → return text
  ↓
DOC → PowerShell COM:
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Open($filePath)
  $doc.SaveAs($outputPath, 16)  # 16 = wdFormatXMLDocument
  $doc.Close()
  $word.Quit()
  ↓
mammoth.extractRawText({ path: $outputPath }) → return text
  ↓
Hapus file temporary DOCX
```

**Kenapa PowerShell COM:** Project ini sudah Windows-only dan menggunakan PowerShell COM di `main.ts` untuk konversi DOC/PPT ke PDF. Kita ikuti pola yang sama.

### 5. `parser/spreadsheet-parser.ts` — XLS/XLSX Multi-Sheet

**Perubahan dari current:** Baca **semua sheet**, bukan hanya sheet pertama.

```ts
const sheetTexts: string[] = []
for (const sheetName of workbook.SheetNames) {
  const ws = workbook.Sheets[sheetName]
  if (!ws) continue
  const txt = xlsx.utils.sheet_to_txt(ws)
  sheetTexts.push(`=== SHEET: ${sheetName} ===\n${txt}`)
}
text = sheetTexts.join('\n\n')
```

### 6. `parser/presentation-parser.ts` — PPT/PPTX

Pakai `officeparser` seperti sekarang, tapi dibungkus rapi.

### 7. `parser/image-ocr.ts` — Image Preprocessing + OCR

**Alur preprocessing:**
```
Image
  → sharp: rotate (auto-orient from EXIF)
  → sharp: resize (width 2500px, tanpa enlargemen kecil)
  → sharp: grayscale
  → sharp: normalize (contrast enhancement)
  → sharp: sharpen
  → sharp: png() → buffer
  → tesseract.js: recognize(buffer, 'ind+eng')
  → return text
```

**Kenapa `sharp`:** Tesseract hasilnya jauh lebih baik dengan preprocessing yang proper. Sharp cepat dan reliable di Electron.

### 8. `parser.ts` — Router (ParseDocument)

```ts
export async function parseDocument(filePath: string, fileType?: string): Promise<ParsedData> {
  const ext = normalizeExt(filePath, fileType)
  let text = ''

  try {
    switch (ext) {
      case 'pdf':   text = await parsePdf(filePath); break
      case 'doc':
      case 'docx':  text = await parseOffice(ext, filePath); break
      case 'xls':
      case 'xlsx':  text = await parseSpreadsheet(filePath); break
      case 'ppt':
      case 'pptx':  text = await parsePresentation(filePath); break
      case 'jpg': case 'jpeg': case 'png':
      case 'bmp': case 'tiff': case 'tif':
      case 'webp': case 'gif':
                   text = await ocrImage(filePath); break
      default:      text = '' // Unknown format
    }
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error)
  }

  const info = extractInfoFromText(text)
  return { ...info, rawText: text.substring(0, 8000) }
}
```

**Perubahan signifikan:**
- `fileType` jadi optional (di-infer dari path)
- `rawText` limit naik dari 5000 → 8000
- Delegasi ke modul terpisah

---

## Interface / Kontrak

### `parseDocument()` — Tidak berubah

```ts
// Signature tetap sama, tapi fileType jadi optional
parseDocument(filePath: string, fileType?: string): Promise<ParsedData>
```

### IPC — Tidak berubah

- `parse-file` di `main.ts` memanggil `parseDocument(path, type)` → return `ParsedData`
- `get-file-text` di `main.ts` memanggil `parseDocument(path, type)` → return rawText

**Tidak ada perubahan di `main.ts` atau `App.vue`.**

---

## Error Handling

| Error Type | Strategi |
|---|---|
| File tidak ada | Throw error, catch di parseDocument, return empty |
| Format tidak didukung | `text = ''`, return `ParsedData` dengan rawText kosong |
| OCR gagal | Log warning, return `text = ''` |
| DOC conversion gagal | Log error, return `text = ''` (DOC lama mungkin corrupt) |
| Library import error | Fatal — app tidak bisa jalan |

**Prinsip:** Parser tidak boleh crash aplikasi. Semua error di-catch dan return data kosong.

---

## Testing

### Manual Testing Checklist

| # | Test Case | Expected |
|---|---|---|
| 1 | PDF text-based | rawText terisi, name/description/date ter-extract |
| 2 | PDF scanned (image) | rawText terisi via OCR fallback |
| 3 | DOCX modern | rawText terisi via mammoth |
| 4 | DOC lama | rawText terisi via PowerShell COM → mammoth |
| 5 | XLSX single sheet | rawText terisi |
| 6 | XLSX multi sheet | Semua sheet ter-extract |
| 7 | PPTX | rawText terisi via officeparser |
| 8 | JPG gambar | rawText terisi via OCR |
| 9 | PNG screenshot | rawText terisi via OCR |
| 10 | File corrupt/error | rawText kosong, tidak crash |
| 11 | File tidak ditemukan | rawText kosong, tidak crash |
| 12 | Ekstensi tidak dikenal | rawText kosong, tidak crash |

### Verification Command

```bash
npm run build
```

TypeScript strict mode (`vue-tsc --noEmit`) + Vite build + Electron builder.

---

## Implementation Order

### Phase 1: Infrastructure (tanpa breaking changes)

1. Install dependencies: `npm install tesseract.js sharp pdfjs-dist`
2. Buat `electron/parser/types.ts`
3. Buat `electron/parser/utils.ts` (pindahkan `extractInfoFromText` + tambah helpers)
4. Rewrite `electron/parser.ts` sebagai router

### Phase 2: Individual Parsers

5. Buat `electron/parser/spreadsheet-parser.ts` (upgrade: multi-sheet)
6. Buat `electron/parser/presentation-parser.ts` (wrap existing)
7. Buat `electron/parser/office-parser.ts` (mammoth + PowerShell COM untuk DOC)
8. Buat `electron/parser/pdf-parser.ts` (pdf-parse + OCR fallback)
9. Buat `electron/parser/image-ocr.ts` (sharp preprocessing + tesseract)

### Phase 3: Integration & Verification

10. Update `electron/parser.ts` untuk import dari modul-modul baru
11. Verifikasi IPC tetap jalan (`main.ts` tidak perlu ubah)
12. `npm run build` — pasti clean

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `sharp` butuh native compilation di Electron | Electron-builder sudah handle native deps. Test build sebelum commit. |
| `pdfjs-dist` butuh canvas polyfill di Node.js | Gunakan approach sederhana: `tesseract.js` v5 bisa handle PDF langsung tanpa render per halaman. |
| PowerShell COM butuh Word terinstall | Project ini sudah assume Windows + Word tersedia (lihat konversi DOC/PPT di main.ts). |
| `tesseract.js` download lang data pertama kali (~15MB) | Pertama kali OCR akan agak lambat. Bisa di-cache di folder temp. |
| File DOC sangat lama corrupt | Catch error, return empty text. |

---

## Keterkaitan dengan Task Lain

- **Task 03** (Universal File Text Extraction) — Task ini **superset**. Task 03 hanya OCR dasar, task ini menambah DOC handling, image preprocessing, dan restrukturisasi.
- **Task 01** (AI Settings) — AI generation membutuhkan `rawText` yang baik. Task ini memastikan `rawText` terisi untuk semua format.
- **Task 02** (Fix RawText) — Fix bug rawText tidak loading. Task ini memastikan rawText tersedia dari semua sumber.

---

## Referensi

- `electron/parser.ts` saat ini: 78 baris, single function
- `electron/main.ts` line 161-174: IPC `parse-file` handler
- `electron/main.ts` line 880-894: IPC `get-file-text` handler
- `electron/main.ts` PowerShell COM patterns (DOC/PPT → PDF conversion)
- `doc/dokumentasi_teknis.md`: Arsitektur parsing saat ini
