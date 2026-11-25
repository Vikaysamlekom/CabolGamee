# CABOL – Cabut Bool (3D Funny Casual Game)

Game browser komedi kasual 3D berbasis Three.js, React, TypeScript, dan Tailwind CSS.

## Cara Menjalankan di Komputer Lokal

1. Pastikan **Node.js** (v18+) sudah terpasang.
2. Ekstrak file ZIP ini ke sebuah folder.
3. Buka terminal di folder tersebut, lalu jalankan:

```bash
npm install
npm run dev
```

4. Buka `http://localhost:3000` di browser.

## Multiplayer Online

Pilih **MULTIPLAYER** dari menu utama, lalu buat room dan bagikan kodenya kepada satu teman. Teman dapat memasukkan kode tersebut untuk bergabung. Host memilih level dan memulai pertandingan; kedua pemain berlomba di arena masing-masing dengan skor lawan yang diperbarui langsung.

Saat pengembangan, jalankan `npm run dev`; server Socket.IO terpasang pada server Vite. Untuk menjalankan versi produksi pada satu server Node.js:

```bash
npm run build
npm start
```

Server produksi harus dapat menerima koneksi WebSocket. Hosting frontend statis saja tidak menjalankan server pertandingan.

## Kontrol Game

- **Desktop**: `WASD` atau Tombol Panah untuk bergerak, `Spasi` untuk **CABUT**, `ESC` untuk **Pause**.
- **Mobile**: Virtual Joystick di kiri bawah dan tombol **CABUT!** di kanan bawah.
