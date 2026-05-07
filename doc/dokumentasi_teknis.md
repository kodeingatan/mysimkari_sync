# Dokumentasi Teknis: MySimkari Sync App

## Arsitektur Aplikasi
Aplikasi ini dibangun menggunakan framework **Electron** dengan frontend **Vue 3** dan **Tailwind CSS**.

- **Frontend**: Vue 3 (Vite), TypeScript, Tailwind CSS.
- **Backend (Main Process)**: Node.js (Electron Main), Better-SQLite3.
- **Komunikasi**: Electron IPC (Inter-Process Communication).

## Struktur Data (SQLite)
Database disimpan secara lokal menggunakan `better-sqlite3`.

### Tabel `documents`
Menyimpan informasi tentang file yang ditemukan dan statusnya.
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `path` | TEXT (PK) | Path absolut file |
| `name` | TEXT | Nama asli file |
| `type` | TEXT | Ekstensi file |
| `size` | INTEGER | Ukuran file |
| `parsed_name` | TEXT | Hasil ekstraksi nama kegiatan |
| `parsed_desc` | TEXT | Hasil ekstraksi deskripsi |
| `parsed_date` | TEXT | Hasil ekstraksi tanggal |
| `status` | TEXT | Status (`unprocessed`, `ready`, `synced`) |

### Tabel `settings`
Menyimpan konfigurasi dan sesi login.
| Kolom | Tipe | Deskripsi |
|-------|------|-----------|
| `key` | TEXT (PK) | Kunci pengaturan (e.g., `session`, `uniqueuserid`) |
| `value` | TEXT | Nilai pengaturan (JSON string untuk cookies) |

## Mekanisme Parsing Dokumen
Parsing dilakukan di `electron/parser.ts` menggunakan library berikut:
- **PDF**: `pdf-parse`
- **Word**: `mammoth`
- **Excel**: `xlsx`
- **PowerPoint**: `officeparser`

Algoritma ekstraksi menggunakan heuristik sederhana berbasis baris teks dan regex untuk tanggal.

## Integrasi MySimkari
Integrasi dilakukan dengan mensimulasikan interaksi browser:
1. **Login**: Menggunakan `BrowserWindow` modal dengan partisi sesi khusus (`persist:mysimkari`) untuk menangkap cookie setelah login berhasil.
2. **Scraping**: Mengambil opsi form (Tipe, Kategori, Indikator) dari halaman dashboard pegawai menggunakan `fetch` dan Regex.
3. **Sinkronisasi**:
   - Mengambil CSRF Token dari halaman dashboard.
   - Mengirim request `POST` multipart/form-data ke endpoint `/ekinerja/simpankinerja/indikator/new`.
   - Menyertakan cookie dan header CSRF yang valid.

## Integrasi Sistem (Windows Only)
Beberapa fitur menggunakan PowerShell scripts melalui `child_process.exec`:
- **Konversi Office ke PDF**: Memanfaatkan COM Objects dari Microsoft Office (Word, Excel, PowerPoint) untuk ekspor format PDF.
- **Kompresi PDF**: Menggunakan Microsoft Word sebagai mesin perantara ekspor fixed format.
- **Open With**: Menggunakan registry Windows untuk mendapatkan daftar aplikasi terkait ekstensi file.
