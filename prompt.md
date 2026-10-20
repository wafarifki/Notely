# Prompt Implementasi — Notes Desktop App untuk Windows

Kamu adalah senior desktop application engineer, product designer, dan QA engineer. Bangun aplikasi desktop produktivitas bernama **Notes** dengan antarmuka dan komposisi dashboard yang **semirip mungkin dengan screenshot referensi** yang diberikan pengguna.

Baca file `design.md` sampai tuntas sebelum menulis kode. File itu adalah spesifikasi visual dan fungsional utama. Gunakan screenshot asli yang dilampirkan dalam workspace sebagai sumber kebenaran visual. Jangan membuat desain baru berdasarkan selera sendiri, jangan mengubahnya menjadi template dashboard modern generik, dan jangan menghilangkan detail kecil yang membentuk tampilan referensi.

## Tujuan utama

Hasil akhir harus berupa aplikasi desktop Windows yang dapat dijalankan tanpa browser dan dapat dibuild menjadi:

- Installer Windows x64 (`.exe`) menggunakan NSIS.
- Portable executable Windows x64 (`.exe`) jika target portable didukung dengan stabil.

Aplikasi harus memiliki dashboard seperti screenshot dan fungsi CRUD nyata untuk projects, notes, dan tasks. Jangan berhenti pada mockup statis.

## Teknologi dan arsitektur

Gunakan stack desktop web yang matang dan mudah dipelihara:

- Electron untuk runtime desktop.
- React + TypeScript untuk UI.
- Vite untuk development server dan bundling renderer.
- CSS Modules atau CSS terstruktur dengan design tokens agar pixel tuning mudah dilakukan.
- Lucide React untuk ikon outline yang konsisten.
- IndexedDB dengan Dexie untuk penyimpanan lokal persisten tanpa backend dan tanpa ketergantungan native database yang menyulitkan build Windows.
- Electron Builder untuk packaging NSIS dan portable.
- Vitest dan React Testing Library untuk pengujian unit/integrasi yang paling penting.

Gunakan rilis dependency yang kompatibel satu sama lain. Lock versi dependency melalui lockfile. Jangan menambahkan backend, autentikasi cloud, telemetri, API berbayar, atau koneksi internet yang tidak dibutuhkan. Aplikasi harus tetap dapat bekerja offline.

Struktur kode yang disarankan:

- `src/main/` untuk Electron main process dan lifecycle aplikasi.
- `src/preload/` untuk API bridge yang sempit dan aman bila dibutuhkan.
- `src/renderer/` untuk React UI, pages, components, hooks, styles, dan state.
- `src/renderer/db/` untuk schema serta repository Dexie.
- `src/renderer/features/projects/`.
- `src/renderer/features/notes/`.
- `src/renderer/features/tasks/`.
- `src/renderer/features/activity/`.
- `src/renderer/features/search/`.
- `src/renderer/features/settings/`.
- `assets/` untuk ikon aplikasi dan avatar lokal.
- `tests/` untuk test yang relevan.

Struktur dapat disesuaikan bila ada alasan teknis yang jelas, tetapi pisahkan UI, data access, dan aturan bisnis. Jangan menaruh seluruh aplikasi di satu file besar.

## Aturan implementasi

1. Gunakan `design.md` untuk semua keputusan tampilan. Utamakan kecocokan visual di viewport referensi **1504 × 1128 px**.
2. Buat layout responsif untuk desktop kecil dan mobile tanpa mengorbankan desain desktop utama.
3. Semua elemen yang terlihat interaktif harus benar-benar bekerja. Hindari tombol dummy, tautan `#`, `alert()` sebagai pengganti UI, data yang hanya disimpan di state sementara, dan placeholder yang mengaku sebagai fitur selesai.
4. Semua data disimpan lokal dan persisten; setelah aplikasi direstart, data pengguna tetap ada.
5. Gunakan data seed awal yang mereproduksi contoh di screenshot. Seed hanya dijalankan ketika database lokal masih kosong. Jangan menimpa data pengguna pada startup berikutnya.
6. Sediakan tindakan untuk memulihkan data demo secara eksplisit, dengan konfirmasi agar data pengguna tidak hilang tanpa sengaja.
7. Gunakan teks UI bahasa Inggris seperti screenshot. Dokumentasi developer boleh berbahasa Indonesia atau Inggris.
8. Buat transisi yang halus dan tenang, bukan animasi mencolok. Hormati `prefers-reduced-motion`.
9. Jangan memakai URL gambar eksternal. Semua avatar dan ikon aplikasi harus lokal agar tampil konsisten saat offline.
10. Hindari komentar di dalam source code. Gunakan nama variabel, tipe, dan struktur fungsi yang jelas sebagai dokumentasi kode.
11. Terapkan indentasi **4 spasi** secara konsisten pada source code.
12. Jangan menyatakan build berhasil sebelum benar-benar menjalankan build dan memeriksa file hasilnya. Jika environment bukan Windows, gunakan workflow CI `windows-latest` untuk menghasilkan dan memverifikasi build Windows.

## UI yang harus dibuat

### App shell dan backdrop

- Buat backdrop gradien pastel pink/lilac, biru pucat, dan lavender seperti screenshot.
- Panel aplikasi berada di tengah secara horizontal, sedikit di atas titik tengah vertikal, dengan lebar dan tinggi maksimum yang mendekati 1268 × 809 px pada viewport referensi.
- Sidebar kiri putih sekitar 210 px. Area konten utama berwarna putih kebiruan sangat pucat.
- Gunakan border tipis, radius kecil, shadow lembut, font sans-serif modern, dan teks navy. Jangan menambahkan logo besar atau elemen yang tidak ada di screenshot.
- Pada aplikasi Windows, sediakan kontrol minimize, maximize/restore, dan close. Jika memakai custom title bar, buat tombol drag region dan perilaku jendela yang benar; kontrol jendela tidak boleh bertumpuk dengan dashboard. Jangan biarkan frame native mengubah komposisi dashboard secara tak terkendali.

### Sidebar

Reproduksi urutan dan hierarki berikut: profil `Nick Woods` dengan email `nick.woods@gmail.com`, tombol ungu `New Project`, `Search`, nav `Home`, `Notes`, `Tasks`, bagian `Projects` yang dapat expand/collapse, lima proyek contoh dengan dot warna, kemudian `Support`, `What's new`, dan `Privacy Policy` di bagian bawah. Sertakan handle untuk collapse/expand sidebar.

### Dashboard Home

Bagian paling atas menampilkan `Welcome back, Nick!`.

Buat layout dua kolom:

- Kolom kiri: `My projects` dan `My notes`.
- Kolom kanan: `My tasks` dan `Recent activity`.

Samakan proporsi, grid, jarak, ukuran kartu, warna, font, border, ikon, shadow, posisi tanggal, posisi menu tiga titik, checkbox, bintang, tag, dan avatar dengan `design.md`.

Reproduksi pula keadaan visual screenshot: satu project card yang terangkat di atas drop zone bergaris diagonal dan satu note card yang mengambang di atas notes grid. Efek tersebut adalah state drag-and-drop bergaya screenshot. Implementasikan drag-and-drop sebenarnya sehingga pengguna dapat menyusun ulang proyek, notes, dan task yang mendukung pengurutan. Placeholder visual tidak boleh menghalangi klik atau membuat tata letak rusak. Pada layar kecil, nonaktifkan overlap demonstratif dan gunakan layout normal.

### Data seed awal

Buat seed data lokal berikut, dengan tanggal yang konsisten sehingga label due date task masuk akal:

**Projects**

1. `Workshop planning and ideas`, warna ungu.
2. `Design exploration`, warna hijau.
3. `Users’ feedback`, warna oranye.
4. `Plans for future and other directions, ideas for improvement`, warna kuning.
5. `Testing results`, warna magenta.
6. Kartu kedua berjudul `Design exploration`, warna cyan, bila diperlukan untuk mencocokkan jumlah kartu yang terlihat pada screenshot. Pastikan ID record berbeda agar tidak menjadi data duplikat secara tidak sengaja.

**Tasks**

1. `Work on the plan` — `3 hours left`, belum selesai, favorit aktif.
2. `Collect feedback` — `1 hour overdue`, selesai, favorit nonaktif.
3. `Analyse test results` — `16 hours left`, belum selesai, favorit nonaktif.
4. `Conclusion` — `1 day left`, belum selesai, favorit nonaktif.
5. `Sort all ideas` — `1 day left`, belum selesai, favorit nonaktif.

**Notes**

- `Plans for future and other directions, what needs to be done`, dengan ringkasan: `A Design Direction unifies everyone and adds meaning to web design. It’s a combination of art and strategy that helps shape a product.`
- `Design challenges`, dengan ringkasan: `What Is A Design Challenge? Design challenges are exercises or competitions that designers can do to boost creativity, create positive habits, and learn new methods for solving design problems.` serta tag `Workshops`, `Design challenges`, `Work in progress`.
- `How to conduct a user interview that could improve your product?`, dengan ringkasan: `You cannot understand good design if you do not understand people; design is made for people. User interviews are a tool that can help you get this understanding.` serta tag `Needs to be done`, `Questions`.
- `Note B - Dribbble strategy`.

**Recent activity**

1. `Maya Hayes` — `Design challenges`.
2. `Cassie Melendez` — `Note B - Dribbble strategy`.
3. `Ronny Schultz` — `Note B - Dribbble strategy`.
4. `Amanda Finnegan` — `Meeting planning`.
5. `Rob Houghton` — `Plans for future and other...`.

Gunakan tanggal awal `27th April, 2021` pada data demo yang ditampilkan agar komposisi dan isi visual sesuai referensi. Untuk aktivitas baru setelah aplikasi dipakai, gunakan waktu aktual lokal dan formatting yang masuk akal. Tampilkan lima proyek/kartu pertama dan susunan notes/task secara tepat sesuai spesifikasi desain.

## Fitur fungsional wajib

### 1. Projects

- Buat project baru dari tombol `New Project` melalui modal/panel yang konsisten dengan desain.
- Ubah nama project, deskripsi bila digunakan, dan warna indikator.
- Buka project untuk melihat notes dan tasks terkait.
- Urutkan project menggunakan drag-and-drop dan simpan urutannya.
- Arsipkan atau hapus project melalui menu `…`.
- Sebelum menghapus, tampilkan konfirmasi dan pilihan untuk memindahkan notes/tasks terkait ke `Unassigned` atau menghapus data terkait secara eksplisit.
- Sidebar project list dan kartu dashboard harus membaca sumber data yang sama dan langsung mengikuti perubahan.

### 2. Notes

- Buat, baca, edit, dan hapus notes.
- Editor mempunyai judul dan isi, mendukung paragraf, daftar, dan shortcut dasar.
- Autosave sesudah jeda input singkat. Tampilkan status `Saving…`, `Saved`, atau pesan error yang jelas.
- Tambahkan, hapus, dan kelola tag.
- Kaitkan note ke project atau pilih `Unassigned`.
- Pin/favorite note, ubah urutan, dan filter berdasarkan project atau tag.
- Menu kartu mempunyai aksi nyata: edit, pin/unpin, favorite/unfavorite, move to project, delete.
- Search memfilter judul, isi, project, serta tags.
- Tampilkan state kosong yang rapi jika pengguna belum memiliki notes.

### 3. Tasks

- Buat, edit, dan hapus task.
- Checkbox pada dashboard berfungsi tanpa reload dan menyimpan perubahan.
- Atur due date dan hitung teks `overdue`, `hours left`, atau `day left` secara dinamis berdasarkan waktu lokal.
- Atur prioritas/favorite yang terlihat menggunakan bintang pada dashboard.
- Filter all, active, completed, overdue, dan favorite.
- Ubah task dari dashboard dan halaman Tasks dengan data yang sinkron.
- Catat perubahan task ke Recent activity.

### 4. Search dan navigation

- Search membuka pencarian yang dapat digunakan dengan keyboard dan mouse.
- Tampilkan hasil gabungan projects, notes, dan tasks dalam kelompok yang jelas.
- Klik hasil untuk membuka item tersebut.
- Navigation `Home`, `Notes`, `Tasks`, project list, dan sidebar collapse harus mengubah halaman/state dengan benar.
- `Support`, `What's new`, dan `Privacy Policy` membuka halaman atau panel lokal yang bermakna. Bila konten final belum tersedia, sediakan panel informasi yang layak, bukan tautan mati.

### 5. Recent activity

- Simpan aktivitas lokal saat notes/projects/tasks dibuat, diedit, diselesaikan, dipindahkan, atau dihapus.
- Tampilkan actor, ringkasan item, dan waktu.
- Seed lima item demo seperti screenshot hanya pada instalasi/database awal.
- Klik aktivitas membuka entitas terkait jika masih ada.

### 6. Data management dan settings

- Database IndexedDB memakai schema/versioning yang jelas.
- Buat repository/data service untuk operasi CRUD; komponen UI tidak mengakses database secara acak.
- Tangani error database dan validasi form tanpa kehilangan input pengguna.
- Tambahkan export data ke JSON dan import JSON dengan validasi schema, preview ringkas, serta konfirmasi sebelum merge/replace.
- Sediakan `Restore demo data` atau `Reset local data` dengan dialog konfirmasi.
- Sediakan pengaturan nama tampilan dan preferensi dasar bila diperlukan.
- Tidak ada data yang diunggah ke server. Tampilkan pesan error yang jelas jika penyimpanan gagal.

## Windows, packaging, dan aplikasi desktop

- Atur `appId`, `productName`, ikon `.ico`, versi aplikasi, dan arsitektur `x64`.
- Siapkan script yang jelas, setidaknya:
  - `npm run dev`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `npm run dist:win`
  - `npm run dist:portable`
- Installer NSIS harus memasang aplikasi dengan benar, membuat shortcut Start Menu, mendukung uninstall, dan tidak menaruh data pengguna di direktori instalasi.
- Simpan data pengguna pada lokasi user data Electron yang sesuai, bukan di dalam folder program.
- Aktifkan `contextIsolation`, matikan `nodeIntegration` di renderer, dan gunakan sandbox/default security settings Electron yang tepat. Jangan mengekspos filesystem atau API Node secara langsung ke renderer.
- Jangan menggunakan native modules kecuali benar-benar diperlukan. Bila ada, pastikan proses rebuild cocok dengan Electron dan target Windows.
- Tambahkan GitHub Actions workflow pada `.github/workflows/build-windows.yml` yang berjalan di `windows-latest`, memasang Node versi LTS yang sesuai, menjalankan install dari lockfile, lint, tests, build, dan menghasilkan installer plus portable `.exe` sebagai artifact.
- Pastikan jalur asset benar saat development dan saat aplikasi sudah dipaketkan. Hindari path absolut milik mesin developer.
- Atur single-instance behavior atau tangani beberapa instance dengan wajar.

## Pengujian dan verifikasi

Jangan menganggap pekerjaan selesai hanya karena halaman utama muncul. Implementasikan test setidaknya untuk:

- Seed hanya dijalankan pada database kosong.
- CRUD project, note, dan task.
- Perubahan checkbox task disimpan.
- Toggle favorite/pin disimpan.
- Pencarian memfilter nama dan isi yang benar.
- Export/import memvalidasi data dan menangani file tidak valid.
- Perubahan tetap ada setelah reload/restart context.
- Penghapusan project tidak diam-diam menghilangkan notes/tasks.

Lakukan inspeksi visual pada viewport **1504 × 1128 px** dan setidaknya satu viewport kecil. Bandingkan dengan screenshot referensi: batas panel, posisi sidebar, ukuran kolom, top alignment, warna latar, tipografi, ukuran card, jarak dan alignment teks. Perbaiki deviasi besar sebelum finalisasi.

## Output yang wajib diserahkan

1. Source code aplikasi yang lengkap dan terstruktur.
2. `design.md` untuk spesifikasi visual dan interaksi.
3. `README.md` yang berisi cara setup, cara menjalankan saat development, cara build Windows, lokasi hasil build, dan lokasi penyimpanan data pengguna.
4. Lockfile dependency.
5. Test yang relevan.
6. Workflow build Windows `.exe`.
7. Installer Windows x64 dan/atau portable `.exe` yang benar-benar dihasilkan saat environment mendukungnya, atau artifact CI yang dapat diunduh bila build dilakukan melalui GitHub Actions.

## Definition of Done

Pekerjaan hanya selesai jika semua kondisi ini terpenuhi:

- Dashboard awal sesuai screenshot secara visual, bukan sekadar mengambil inspirasi.
- Data demo, teks, urutan kartu, colors, checkboxes, star states, tags, avatars, dan hierarchy cocok dengan `design.md`.
- Projects, Notes, Tasks, Search, recent activity, modal, action menus, autosave, persistence, import, dan export bekerja.
- Tidak ada button mati, error console yang tidak ditangani, teks bertumpuk, atau layout horizontal overflow.
- Aplikasi berjalan tanpa koneksi internet setelah terpasang.
- Proses build Windows didokumentasikan dan dapat diulang.
- Hasil build `.exe` benar-benar diuji atau, bila build dilakukan lewat CI, workflow sukses dan artifact `.exe` tersedia.

Mulai dengan membaca struktur repository yang ada. Jika repository masih kosong, bootstrap proyek dari nol. Setelah itu implementasikan fase demi fase: shell dan visual dashboard, data model/seed, CRUD projects/notes/tasks, search/navigation, persistence/import/export, responsive/accessibility, test, dan packaging Windows. Jangan berhenti untuk meminta persetujuan setelah setiap fase; lanjutkan sampai semua deliverable selesai dan verifikasi yang dapat dijalankan telah dilakukan.
