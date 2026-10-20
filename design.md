# Design Specification — Notes Dashboard untuk Windows

## 1. Tujuan dan sumber acuan

Dokumen ini menerjemahkan screenshot referensi berukuran **1504 × 1128 px** menjadi spesifikasi UI yang dapat diimplementasikan. Screenshot adalah acuan visual utama. Jangan mengganti komposisi dengan dashboard template lain, menambahkan dekorasi yang tidak ada, atau mengubah karakter antarmuka menjadi gaya SaaS generik.

Aplikasi adalah dashboard produktivitas untuk mengelola **projects, notes, tasks, dan recent activity**. Nama produk belum ditentukan; gunakan nama kerja **Notes** pada metadata aplikasi, tetapi jangan menampilkan logo atau wordmark baru yang tidak terdapat pada referensi.

Semua label di UI utama tetap menggunakan bahasa Inggris agar sesuai dengan screenshot. Isi contoh, tanggal, susunan elemen, warna aksen, bentuk kartu, dan hierarki harus mengikuti spesifikasi ini.

## 2. Analisis screenshot

### 2.1 Komposisi keseluruhan

- Kanvas penuh menggunakan latar pastel dengan gradien diagonal: merah muda/lilac di kiri atas, biru pucat di kanan atas, dan lavender di bagian bawah.
- Sebuah panel aplikasi putih pucat diletakkan di tengah secara horizontal dan sedikit di atas titik tengah vertikal.
- Pada ukuran acuan, panel kira-kira membentang dari `x=70` sampai `x=1338`, dan `y=121` sampai `y=930`. Perkiraan ukuran panel adalah **1268 × 809 px**.
- Panel mempunyai garis tepi sangat tipis, sudut hampir siku tetapi sedikit membulat, serta bayangan lembut. Jangan menggunakan bayangan hitam pekat.
- Panel terbagi menjadi sidebar putih di sisi kiri dengan lebar sekitar **210 px**, serta area konten utama yang mengisi sisa lebar.
- Tidak ada browser chrome, URL bar, tab, atau title bar di dalam desain aplikasi. Pada build Electron, gunakan frameless/custom title bar hanya bila dapat dilakukan tanpa mengganggu tampilan acuan; kontrol jendela Windows tetap harus tersedia dan mudah diakses.

### 2.2 Sidebar kiri

Sidebar menggunakan latar putih murni dan garis pemisah tipis di sisi kanan. Kontennya berurutan dari atas:

1. **Profil pengguna**: avatar bulat kecil bernuansa monokrom di kiri; nama `Nick Woods` berwarna navy; email `nick.woods@gmail.com` di bawah nama dengan warna abu-abu.
2. **Tombol New Project**: tombol ungu penuh, hampir selebar sidebar, ikon plus di kiri teks, sudut membulat sekitar 5 px, tinggi kurang lebih 35 px.
3. **Search**: ikon kaca pembesar dan teks `Search`, tanpa bidang input besar yang terlihat pada keadaan default.
4. **Navigasi utama**:
   - `Home`, aktif dengan latar lavender sangat muda dan radius kecil.
   - `Notes`.
   - `Tasks`.
5. Garis pemisah horizontal.
6. **Projects**: ikon folder di kiri, label di tengah, chevron di kanan yang dapat membuka/menutup daftar proyek.
7. Daftar proyek berisi titik warna kecil dan label yang dipotong dengan ellipsis jika terlalu panjang:
   - `Workshop planning...` — ungu.
   - `Design exploration` — hijau.
   - `Users’ feedback` — oranye.
   - `Plans for future and...` — kuning.
   - `Testing results` — magenta.
8. Di bagian bawah, kelompok tautan kecil dengan ikon outline: `Support`, `What's new`, dan `Privacy Policy`.
9. Sebuah handle bundar kecil di perbatasan sidebar dan area utama, sekitar bagian atas sidebar, menampilkan chevron ganda untuk menyembunyikan atau membuka sidebar.

Sidebar memiliki tinggi penuh terhadap panel aplikasi. Profil, tombol proyek, dan navigasi mengikuti alur vertikal; tautan support diletakkan di bagian bawah menggunakan layout flex agar tidak naik ke tengah saat layar tinggi.

### 2.3 Area konten utama

- Latar konten adalah putih kebiruan yang sangat pucat, berbeda tipis dari sidebar.
- Padding awal konten kurang lebih 28–30 px.
- Judul sambutan `Welcome back, Nick!` berada di bagian paling atas, menggunakan font sans-serif modern, ukuran sekitar 21 px, berat regular/medium, warna navy.
- Setelah judul, konten disusun dalam dua kolom besar:
  - **Kolom kiri** berisi `My projects` dan `My notes`.
  - **Kolom kanan** berisi `My tasks` dan `Recent activity`.
- Setiap judul bagian diawali ikon outline tipis berwarna abu-abu kebiruan. Judul bagian memakai ukuran sekitar 16 px dan warna secondary text.
- Jarak antarbagian cukup lega. Gunakan whitespace seperti screenshot, jangan memadatkan kartu atau memperbesar heading.

### 2.4 Bagian My projects

Judul `My projects` menggunakan ikon folder outline. Di bawahnya terdapat kisi-kisi kartu proyek bergaya map/folder:

- Tiga kolom pada desktop.
- Setiap kartu berwarna putih, garis tepi `#DEE2EB`, sudut sekitar 8–10 px, tinggi sekitar 141 px.
- Bagian atas kartu memiliki bentuk tab folder kecil: bagian garis atas menonjol sedikit dan memiliki transisi diagonal sebelum menyambung ke badan kartu.
- Setiap kartu memiliki titik warna kecil di kiri judul.
- Judul navy, sekitar 13 px; teks boleh turun ke baris kedua atau ketiga sesuai panjang.
- Tanggal berada di kiri bawah, teks sekunder sekitar 10–11 px: `27th April, 2021`.
- Tombol menu `…` berada di kanan bawah.
- Contoh isi dan urutan visual:
  1. `Workshop planning and ideas` — titik ungu.
  2. `Design exploration` — titik hijau.
  3. `Users’ feedback` — titik oranye.
  4. `Plans for future and other directions, ideas for improvement` — titik kuning.
  5. `Testing results` — titik magenta.
  6. `Design exploration` — titik cyan.
- Screenshot memperlihatkan satu kartu `Users’ feedback` dalam keadaan terangkat di atas slot drop bergaris diagonal. Pertahankan detail drag-and-drop ini sebagai state visual pada dashboard desktop awal agar komposisi mendekati screenshot. Slot drop memakai outline putus-putus ungu dan pola diagonal lavender yang sangat transparan. Kartu yang terangkat mempunyai shadow lebih kuat daripada kartu biasa.
- Kondisi visual tersebut tetap harus didukung interaksi nyata: kartu dapat dipindahkan dengan drag-and-drop, urutan tersimpan, dan placeholder hanya terlihat saat drag aktif atau sebagai detail visual dashboard acuan. Jangan sampai overlay dekoratif menghalangi klik atau membuat kartu tidak bisa digunakan.

### 2.5 Bagian My tasks

Judul `My tasks` memakai ikon check-circle outline. Di bawahnya terdapat satu panel putih berbatas tipis, radius sekitar 9 px, dengan lima item vertikal:

1. Checkbox kosong, `Work on the plan`, keterangan `3 hours left`, bintang ungu terisi.
2. Checkbox ungu tercentang, `Collect feedback`, keterangan `1 hour overdue`, bintang outline abu-abu.
3. Checkbox kosong, `Analyse test results`, keterangan `16 hours left`, bintang outline.
4. Checkbox kosong, `Conclusion`, keterangan `1 day left`, bintang outline.
5. Checkbox kosong, `Sort all ideas`, keterangan `1 day left`, bintang outline.

Detail visual:

- Panel kira-kira 338 × 296 px pada ukuran acuan.
- Setiap item memiliki checkbox di kiri, judul dan keterangan di tengah, serta bintang favorit di kanan.
- Judul task menggunakan navy sekitar 13 px; keterangan sekitar 10–11 px dengan warna secondary.
- Checkbox aktif memiliki latar ungu, sudut kecil, dan tanda centang putih.
- Bintang favorit terpilih berwarna ungu; keadaan tidak terpilih berbentuk outline abu-abu.
- Spasi vertikal konsisten. Tidak perlu divider gelap antar-item.

### 2.6 Bagian My notes

Judul `My notes` menggunakan ikon dokumen outline. Daftar notes memakai kisi dua kolom di desktop, dengan kartu persegi panjang yang lebih tinggi daripada kartu proyek.

- Panel putih, border tipis `#DEE2EB`, radius sekitar 9 px.
- Padding kartu sekitar 16–18 px.
- Tanggal di kiri atas: `27th April, 2021`, ukuran 10–11 px, warna abu-abu.
- Menu `…` berada di kanan atas.
- Judul note navy sekitar 13–14 px, dengan tinggi mengikuti jumlah baris.
- Isi ringkas berwarna secondary text sekitar 12 px, line-height lega, dipotong dengan ellipsis setelah beberapa baris.
- Tags ditampilkan sebagai chip kecil di bagian bawah kartu. Chip memakai latar pastel berbeda-beda, teks kecil, dan sudut 5 px.

Konten acuan yang terlihat:

1. Judul `Plans for future and other directions, what needs to be done`; ringkasan diawali `A Design Direction unifies everyone and adds meaning to web design. It’s a combination of art...`.
2. Judul `Design challenges`; ringkasan diawali `What Is A Design Challenge? Design challenges are exercises or competitions that designers can do to boost creativity, create positive habits, and learn new methods for...`; tags `Workshops`, `Design challenges`, `Work in progress`.
3. Kartu `How to conduct a user interview that could improve your product?`, dengan ringkasan yang dimulai `You cannot understand good design if you do not understand people; design is made for people. User interviews are a tool that can help you get this understanding...`; tags `Needs to be done` dan `Questions`.
4. Kartu `Note B - Dribbble strategy` terlihat pada baris bawah.

Screenshot memperlihatkan kartu note tentang user interview mengambang di atas grid, keluar melewati tepi bawah panel aplikasi dan menimpa sebagian kartu lain. Sebuah slot drop bergaris diagonal terlihat dekat baris bawah. Untuk mode desktop awal, reproduksi layering ini sebagai keadaan drag visual yang halus: satu kartu elevated, shadow lembut, placeholder bergaris. Kartu harus tetap benar-benar interaktif; setelah pengguna melakukan drag atau menyelesaikan aksi, tata letak kembali stabil dan tidak meninggalkan overlap yang menghambat konten. Pada layar kecil, matikan overlap visual dan susun kartu sebagai grid/list normal agar tidak terpotong.

### 2.7 Bagian Recent activity

Judul `Recent activity` menggunakan ikon jam outline. Panel berukuran sekitar 338 × 297 px, putih dengan border tipis dan sudut 9 px. Panel berisi lima baris aktivitas; setiap baris memiliki avatar bulat kecil di kiri, nama orang dan deskripsi aktivitas di tengah, serta tanggal rata kanan.

Konten acuan:

1. `Maya Hayes` — `Design challenges`.
2. `Cassie Melendez` — `Note B - Dribbble strategy`.
3. `Ronny Schultz` — `Note B - Dribbble strategy`.
4. `Amanda Finnegan` — `Meeting planning`.
5. `Rob Houghton` — `Plans for future and other...`.

Setiap baris menampilkan tanggal `27th April, 2021` di sisi kanan. Nama memakai navy sekitar 12–13 px; deskripsi dan tanggal memakai secondary text sekitar 10 px. Avatar merupakan potongan ilustrasi/portrait kecil berbentuk lingkaran. Gunakan aset lokal yang konsisten dan ringan, bukan gambar dari URL eksternal yang dapat hilang. Bila aset portrait tidak tersedia, gunakan avatar ilustratif yang dibuat lokal, bukan lingkaran berwarna kosong.

## 3. Sistem visual

### 3.1 Token warna

Gunakan token berikut sebagai titik awal. Warna akhir boleh disetel sangat tipis berdasarkan screenshot, tetapi jangan menggeser karakter palet.

| Token | Nilai | Penggunaan |
|---|---|---|
| `--canvas-pink` | `#E9CFE3` | Area kiri atas background |
| `--canvas-blue` | `#C9D8EB` | Area kanan atas background |
| `--canvas-lavender` | `#DCCCF0` | Area bawah background |
| `--surface` | `#FFFFFF` | Sidebar, kartu, panel |
| `--main-surface` | `#F7F8FC` | Area konten utama |
| `--text-primary` | `#17143D` | Judul, label utama |
| `--text-secondary` | `#777D92` | Subjudul, tanggal, isi ringkas |
| `--line` | `#DEE2EB` | Border kartu dan pemisah |
| `--accent-purple` | `#974FD0` | Tombol utama, checkbox aktif, bintang aktif |
| `--accent-purple-soft` | `#F3EAFB` | Navigasi aktif dan chip ungu |
| `--accent-green` | `#1BA879` | Titik proyek hijau |
| `--accent-orange` | `#F5824D` | Titik proyek oranye |
| `--accent-yellow` | `#FFD43B` | Titik proyek kuning |
| `--accent-pink` | `#E94EB5` | Titik proyek magenta |
| `--accent-cyan` | `#36B9D9` | Titik proyek cyan |

Background halaman berupa gradien besar dan lembut dengan transisi halus, misalnya kombinasi linear/radial gradients; hindari gradien neon, kontras tinggi, atau pola dekoratif tambahan.

### 3.2 Tipografi

- Gunakan **Inter** sebagai font utama jika dibundel secara lokal dan lisensinya sesuai. Alternatif lokal: `Segoe UI`.
- Gunakan bobot regular/medium. Hindari font display atau font tebal berlebihan.
- Hirarki desktop:
  - Welcome heading: 20–22 px, weight 500.
  - Section heading: 15–17 px, weight 400.
  - Card/task/note title: 12.5–14 px, weight 500.
  - Note excerpt: 11.5–12.5 px, weight 400.
  - Date, metadata, tags: 9.5–11 px.
- Gunakan line-height sekitar 1.35 untuk judul dan 1.5 untuk ringkasan.
- Jangan menggunakan huruf kapital semua atau font-size besar ala landing page.

### 3.3 Bentuk, border, dan elevation

- Radius panel dan kartu: 8–10 px.
- Radius tombol utama: 5–6 px.
- Border 1 px dan warna lembut. Hindari border hitam.
- Shadow panel aplikasi: lembut dan menyebar, opacity rendah.
- Kartu normal hampir datar; kartu yang sedang di-drag mempunyai elevation lebih jelas.
- Ikon memakai outline tipis dengan gaya seragam. Gunakan satu library ikon line seperti Lucide; ukuran sidebar 14–16 px dan judul bagian 16 px.
- Jangan menggunakan emoji untuk menggantikan ikon navigasi.

## 4. Grid dan ukuran acuan

Pengukuran screenshot bersifat perkiraan visual untuk menjaga proporsi. Prioritas implementasi adalah komposisi yang sangat dekat saat viewport berada di **1504 × 1128 px**.

| Elemen | Ukuran/perilaku target |
|---|---|
| App frame | Maksimum sekitar 1268 × 809 px pada ukuran acuan |
| Sidebar | Sekitar 210 px, tidak ikut mengecil sebelum breakpoint tablet |
| Main content | Sisa lebar setelah sidebar |
| Padding main | 28–30 px |
| Kolom dashboard | Kiri sekitar 63%, kanan sekitar 34%, gap sekitar 28–32 px |
| Project grid | 3 kolom, gap 12 px, kartu tinggi sekitar 141 px |
| Tasks panel | Sekitar 338 px lebar, tinggi sekitar 296 px |
| Notes grid | 2 kolom, gap sekitar 14–16 px |
| Recent activity panel | Lebar serupa panel Tasks, tinggi sekitar 297 px |

Jadikan halaman utama memiliki scrolling internal yang halus. Sidebar tetap memenuhi tinggi panel dan item bagian bawah berada di bawah. Jangan sampai keseluruhan halaman desktop memaksa browser-like scroll pada body luar.

## 5. Interaksi dan behavior

### 5.1 Navigasi

- `Home` membuka dashboard seperti screenshot.
- `Notes` membuka halaman notes lengkap dengan pencarian, filter proyek/tag, sort, dan create note.
- `Tasks` membuka daftar tasks dengan filter status/prioritas/tanggal dan form tambah/edit.
- `Projects` dapat di-expand/collapse.
- Item proyek membuka detail proyek berisi notes dan tasks proyek tersebut.
- Tombol back/home, menu popover, dialog, tombol tutup, dan sidebar collapse harus berfungsi nyata.

### 5.2 Projects

- Tambah, edit nama/deskripsi, ubah warna indikator, arsipkan, dan hapus proyek.
- Setiap proyek dapat berisi banyak notes dan tasks.
- Menu `…` membuka menu tindakan yang sesuai.
- Drag-and-drop untuk menyusun ulang proyek harus bekerja dengan mouse; dukungan keyboard atau tombol pindah ke atas/bawah menjadi fallback.
- Hapus proyek harus meminta konfirmasi dan menjelaskan apakah notes/tasks terkait akan dipindahkan ke area tanpa proyek atau ikut dihapus. Jangan kehilangan data secara diam-diam.

### 5.3 Notes

- Buat note, edit judul dan isi, pilih proyek, tambah/hapus tags, tandai favorite/pinned, serta hapus dengan konfirmasi.
- Simpan perubahan otomatis setelah jeda input singkat dan tampilkan status kecil `Saving…`, `Saved`, atau `Unable to save` tanpa mengganggu layout.
- Editor mendukung teks biasa, paragraf, daftar, dan shortcut keyboard dasar. Markdown dapat digunakan bila pengalaman edit tetap sederhana dan tampilan kartu dashboard tetap sesuai screenshot.
- Search memfilter berdasarkan judul, isi, nama proyek, dan tag.
- Notes dapat diurutkan berdasarkan updated time, created time, dan title.
- Menu kartu memiliki tindakan edit, pin/favorite, pindah proyek, dan delete.

### 5.4 Tasks

- Tambah, edit, tandai selesai/belum selesai, favoritkan, ubah prioritas, atur due date, dan hapus.
- Checkbox di dashboard mengubah state task secara langsung tanpa reload.
- Perhitungan label waktu menggunakan due date secara dinamis, termasuk `overdue`, `hours left`, dan `day left`; seed data harus memberi hasil mendekati label screenshot.
- Filter task: all, active, completed, overdue, favorite.
- Perubahan task tercatat di recent activity.

### 5.5 Search dan recent activity

- Search pada sidebar membuka input/panel pencarian yang nyata dan memfilter notes, tasks, dan projects.
- Recent activity terbentuk dari aksi pengguna, menyimpan waktu aktivitas, nama actor, dan ringkasan aksi. Seed data harus memuat lima item seperti screenshot.
- Data aktivitas tidak boleh diklaim berasal dari pengguna sungguhan. Isi contoh adalah data demo lokal.

### 5.6 Data lokal dan pengaturan

- Semua data tetap ada setelah aplikasi ditutup dan dibuka kembali.
- Sediakan export dan import data JSON yang tervalidasi, serta pilihan reset data demo dengan konfirmasi.
- Sediakan Settings sederhana untuk nama tampilan pengguna dan preferensi tampilan bila implementasi membutuhkannya; jangan memperkenalkan halaman pengaturan besar pada dashboard awal.
- Aplikasi harus dapat dipakai offline dan tidak mengirim data ke server.

## 6. Responsivitas

### Desktop lebar — 1200 px ke atas

- Pertahankan shell terpusat dengan sidebar penuh.
- Gunakan dua kolom utama dan susunan kartu pada bagian 2.
- Komposisi paling dekat dengan screenshot pada 1504 × 1128 px.
- Efek floating/drop-zone dapat ditampilkan pada initial dashboard desktop untuk mencocokkan screenshot.

### Desktop kecil/tablet — 800 sampai 1199 px

- Kurangi margin luar dan padding konten.
- Sidebar dapat menyusut menjadi mode ikon atau tetap memiliki lebar minimal 190 px, tergantung ruang.
- Kolom dashboard menjadi lebih fleksibel; panel Tasks tidak boleh mendorong konten keluar viewport.
- Jangan mempertahankan overlap dekoratif jika membuat teks terpotong.

### Mobile — di bawah 800 px

- App frame memenuhi viewport tanpa ruang gradien besar di sekitarnya.
- Sidebar berubah menjadi drawer yang dibuka melalui tombol menu.
- Sections disusun vertikal: `My projects`, `My tasks`, `My notes`, lalu `Recent activity`.
- Project grid turun menjadi 1–2 kolom sesuai lebar layar; notes menjadi satu kolom pada layar sempit.
- Nonaktifkan kartu floating yang melewati batas panel dan semua dekorasi drag state awal.
- Kontrol tetap cukup besar untuk sentuhan dan tidak ada horizontal overflow.

## 7. Aksesibilitas dan detail kualitas

- Semua tombol ikon mempunyai accessible name/tooltip.
- Focus keyboard terlihat dengan outline lembut berwarna ungu.
- Dialog mengunci fokus, dapat ditutup dengan Escape, dan mengembalikan fokus setelah ditutup.
- Checkbox, tombol, dan item navigasi mendukung keyboard.
- Informasi status tidak hanya dibedakan dengan warna; sediakan teks/label.
- Gunakan `prefers-reduced-motion` untuk mengurangi animasi.
- Animasi pendek dan halus: 120–220 ms untuk hover, menu, dan perubahan state. Hindari animasi berlebihan atau parallax.
- Semua state kosong, error, loading, dan konfirmasi harus mempunyai desain yang sesuai dengan bahasa visual screenshot.

## 8. Kriteria visual selesai

Implementasi dianggap sesuai apabila:

- Pada viewport 1504 × 1128 px, panel aplikasi, sidebar, judul, dua kolom dashboard, kartu folder, panel task, kisi notes, recent activity, warna pastel, border, dan spacing sangat dekat dengan acuan.
- Screenshot dashboard pertama menampilkan data contoh dengan judul, urutan, status checkbox, bintang, tag, tanggal, dan nama aktivitas yang disebut dalam dokumen ini.
- Kartu floating dan slot drop tampak seperti state drag-and-drop pada screenshot, tetapi tidak merusak interaksi.
- Tidak ada teks yang menumpuk secara tidak sengaja, overflow horizontal, kontrol dekoratif yang tidak bisa diklik, atau tombol tanpa aksi.
- Notes, projects, tasks, search, menu tindakan, autosave, serta import/export benar-benar berfungsi dan datanya persisten setelah restart.
- Aplikasi dapat di-build menjadi installer Windows x64 dan portable `.exe`.
