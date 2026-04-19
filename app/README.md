# YOLO Lab App

Tool ini sekarang menyediakan dua tampilan lokal:

- manual labeler React untuk memberi atau mengoreksi bounding box YOLO dari frame di `train/frames/`
- YOLO tester React untuk menjalankan `yolo_lab/test/run_video_tracking.py` dari browser lokal

UI browser sekarang dirender dari source React di `yolo_lab/app/src` dan otomatis dibuild saat server Bun start.

## Jalankan

Dari root project:

```bash
./yolo_lab/run_console.sh
```

Lalu buka URL yang tampil di terminal, biasanya:

```text
http://127.0.0.1:8765
```

Alternatif langsung tanpa wrapper shell:

```bash
bun yolo_lab/app/server.js
```

Jika ingin melewati auto-build asset React saat debugging server, set env berikut:

```bash
YOLO_LAB_SKIP_REACT_BUILD=1 bun yolo_lab/app/server.js
```

Untuk tester model, buka:

```text
http://127.0.0.1:8765/tester
```

## Fitur

- membaca frame dari `train/frames`
- membaca dan menulis label YOLO di `train/labels`
- menyimpan checkpoint frame terakhir pilihan di `train/labels/.manual_labeler_checkpoint.json`
- drag untuk membuat box baru
- klik box untuk pilih, drag isi box untuk geser
- drag sudut box untuk resize
- undo perubahan terakhir dengan `Ctrl+Z`
- simpan label kosong bila frame memang tidak punya objek
- preview command runner test video
- jalankan test model YOLO dari UI lokal
- polling status proses, log runner, dan daftar artifact output terbaru
- explorer hasil test per folder output dengan preview video per run
- komponen UI diambil dari `yolo_lab/app/ui`

## Struktur UI

- shell React: `yolo_lab/app/index.html`
- source React: `yolo_lab/app/src`
- build helper: `yolo_lab/app/build-react.mjs`
- CSS app: `yolo_lab/app/src/styles.css`
- komponen UI lokal: `yolo_lab/app/ui`

## Shortcut

- `Ctrl+S`: simpan label aktif
- `Ctrl+Z`: undo perubahan terakhir
- `ArrowLeft` / `ArrowRight`: pindah frame
- `Delete` / `Backspace`: hapus box terpilih
- `Escape`: batal interaksi atau lepas seleksi
