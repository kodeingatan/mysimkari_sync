# Dokumentasi Proyek: MySimkari Sync App

## Deskripsi Singkat
MySimkari Sync App adalah aplikasi desktop yang dirancang untuk mempermudah pegawai Kejaksaan dalam menginput data kinerja ke platform `mysimkari.kejaksaan.go.id`. Aplikasi ini secara otomatis membaca file dokumen (PDF, Word, Excel, PPT), mengidentifikasi informasi penting seperti nama kegiatan dan deskripsi, lalu menyinkronkannya ke sistem MySimkari.

## Fitur Utama
- **Pembaca Dokumen Multi-Format**: Mendukung pembacaan konten dari file PDF, DOC/DOCX, XLS/XLSX, dan PPT/PPTX.
- **Tree View Folder**: Menampilkan struktur folder dan file secara hierarkis untuk navigasi yang mudah.
- **Identifikasi Otomatis**: Mengekstrak nama kegiatan, deskripsi, dan tanggal dari dokumen menggunakan algoritma parsing.
- **Integrasi MySimkari**: Sinkronisasi data langsung ke website MySimkari melalui mekanisme web scraping dan session management.
- **Manajemen Sesi**: Fitur login manual melalui browser internal untuk mengambil cookie sesi secara aman.
- **Penyimpanan Lokal**: Menggunakan SQLite untuk menyimpan status sinkronisasi dan data yang telah diproses.
- **Tools Tambahan**: Fitur kompresi PDF dan konversi dokumen (Office to PDF) menggunakan integrasi Windows COM.

## Alur Penggunaan (Flow)
1. **Pilih Folder**: Pengguna memilih folder kerja yang berisi dokumen-dokumen kegiatan.
2. **Navigasi File**: File ditampilkan dalam bentuk tree. Klik pada file untuk melihat detail identifikasi.
3. **Identifikasi & Verifikasi**: Aplikasi akan memproses file dan menampilkan modal berisi Nama Kegiatan, Deskripsi, dan Tanggal. Pengguna dapat mengoreksi data jika diperlukan.
4. **Login MySimkari**: Jika belum login, aplikasi akan membuka jendela browser untuk login manual ke MySimkari.
5. **Sinkronisasi**: Klik tombol "Save & Sync" untuk mengirim data ke website.
6. **Status Berhasil**: Item file yang telah berhasil disinkronkan akan ditandai dengan indikator warna hijau.

## Persyaratan Sistem
- Sistem Operasi: Windows (Direkomendasikan untuk fitur konversi Office).
- Microsoft Office: Dibutuhkan untuk fitur konversi dokumen ke PDF.
- Koneksi Internet: Dibutuhkan untuk sinkronisasi ke MySimkari.
