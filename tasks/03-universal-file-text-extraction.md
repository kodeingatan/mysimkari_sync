# 03 - Universal File Text Extraction (OCR + Multi-format)

## Masalah

`rawText` hanya terisi untuk PDF (text-based), DOCX, XLSX, PPTX. File gambar (JPG, PNG, dst) dan PDF scanned/image-based menghasilkan `rawText` kosong.

**Root cause:** `parseDocument` di `parser.ts` tidak handle format gambar, dan `pdf-parse` tidak bisa extract text dari PDF yang berisi gambar (scanned).

---

## Solusi

Tambahkan **`tesseract.js`** sebagai OCR engine untuk:
1. File gambar (jpg, jpeg, png, bmp, tiff, webp) -> OCR langsung
2. PDF text-based -> `pdf-parse` (seperti sekarang)
3. PDF scanned/image-based -> fallback ke `tesseract.js` OCR jika `pdf-parse` menghasilkan text terlalu sedikit
4. File lain yang tidak dikenal -> coba OCR sebagai fallback

**`tesseract.js`** mendukung:
- OCR gambar langsung (JPG, PNG, BMP, TIFF, WebP)
- OCR halaman PDF via canvas rendering (pdfjs-dist + canvas)
- Bahasa Indonesia + English
- Berjalan di Node.js/Electron tanpa native dependency

---

## File yang Dimodifikasi

| File | Perubahan |
|---|---|
| `package.json` | Tambah dependency `tesseract.js` |
| `electron/parser.ts` | Tambah image OCR, PDF fallback OCR, expand supported formats |

---

## Langkah Implementasi

### Langkah 1: Install `tesseract.js`

```bash
npm install tesseract.js
```

### Langkah 2: Rewrite `parser.ts`

**File:** `electron/parser.ts`

#### Struktur baru:

```ts
import Tesseract from 'tesseract.js'

// Supported image extensions
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'bmp', 'tiff', 'tif', 'webp', 'gif']
const OFFICE_EXTS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

export async function parseDocument(filePath: string, fileType: string): Promise<ParsedData> {
  const ext = fileType.toLowerCase()
  let text = ''

  try {
    if (ext === 'pdf') {
      text = await parsePdf(filePath)
    } else if (OFFICE_EXTS.includes(ext)) {
      text = await parseOffice(ext, filePath)
    } else if (IMAGE_EXTS.includes(ext)) {
      text = await ocrImage(filePath)
    } else {
      // Fallback: coba OCR (mungkin file gambar tanpa ekstensi yang benar)
      text = await ocrImage(filePath)
    }
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error)
  }

  const info = extractInfoFromText(text)
  return { ...info, rawText: text.substring(0, 8000) }
}
```

#### `parsePdf()` - PDF dengan fallback OCR:

```ts
async function parsePdf(filePath: string): Promise<string> {
  // 1. Coba pdf-parse dulu (untuk text-based PDF)
  const pdfBuffer = fs.readFileSync(filePath)
  const pdfData = await pdfParse(pdfBuffer)
  const text = pdfData.text || ''

  // 2. Jika text terlalu sedikit (< 50 chars), kemungkinan scanned PDF -> OCR
  if (text.trim().length < 50) {
    console.log('PDF has minimal text, attempting OCR...')
    return await ocrPdf(filePath)
  }

  return text
}
```

#### `ocrPdf()` - OCR halaman PDF:

```ts
async function ocrPdf(filePath: string): Promise<string> {
  // Gunakan tesseract.js dengan PDF support
  // tesseract.js v5+ bisa handle PDF langsung via recognize()
  const result = await Tesseract.recognize(filePath, 'ind+eng', {
    logger: () => {}
  })
  return result.data.text || ''
}
```

#### `ocrImage()` - OCR gambar:

```ts
async function ocrImage(filePath: string): Promise<string> {
  const result = await Tesseract.recognize(filePath, 'ind+eng', {
    logger: () => {}
  })
  return result.data.text || ''
}
```

#### `parseOffice()` - Office docs (existing logic):

```ts
async function parseOffice(ext: string, filePath: string): Promise<string> {
  switch (ext) {
    case 'doc':
    case 'docx': {
      const result = await mammoth.extractRawText({ path: filePath })
      return result.value
    }
    case 'xls':
    case 'xlsx': {
      const workbook = xlsx.readFile(filePath)
      const firstSheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[firstSheetName]
      return xlsx.utils.sheet_to_txt(worksheet)
    }
    case 'ppt':
    case 'pptx': {
      return await new Promise((resolve, reject) => {
        officeParser.parseOffice(filePath, (data: any, err: any) => {
          if (err) return reject(err)
          resolve(String(data) || '')
        })
      })
    }
    default:
      return ''
  }
}
```

### Langkah 3: Update `rawText` limit

**File:** `electron/parser.ts`

Ubah limit dari `5000` ke `8000` karakter agar AI punya lebih banyak konteks:

```ts
return { ...info, rawText: text.substring(0, 8000) }
```

---

## Format yang Didukung Setelah Perubahan

| Kategori | Ekstensi | Metode |
|---|---|---|
| PDF text-based | `.pdf` | `pdf-parse` |
| PDF scanned | `.pdf` | `tesseract.js` OCR (fallback) |
| Word | `.doc`, `.docx` | `mammoth` |
| Excel | `.xls`, `.xlsx` | `xlsx` |
| PowerPoint | `.ppt`, `.pptx` | `officeparser` |
| Gambar | `.jpg`, `.jpeg`, `.png`, `.bmp`, `.tiff`, `.tif`, `.webp`, `.gif` | `tesseract.js` OCR |
| Lainnya | (apa saja) | `tesseract.js` OCR (fallback) |

---

## Catatan Teknis

- **`tesseract.js` v5** berjalan di Node.js tanpa native dependency (WASM-based)
- OCR Bahasa Indonesia (`ind`) + English (`eng`) sebagai default
- Pertama kali run, Tesseract akan download language data (~15MB) ke folder temp
- `logger: () => {}` suppress verbose output
- Limit rawText dinaikkan dari 5000 ke 8000 agar AI punya lebih banyak konteks untuk generate
- `pdf-parse` tetap digunakan untuk text-based PDF (lebih cepat dari OCR)
