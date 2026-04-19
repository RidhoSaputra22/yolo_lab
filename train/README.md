# Training YOLO dari Footage

Folder `train/` sekarang punya script CLI untuk:

- ekstrak frame dari video di `train/footage`
- buat pseudo-label awal memakai model YOLO yang sudah ada
- koreksi label manual lewat interface lokal sederhana
- susun dataset YOLO (`images/train`, `images/val`, `labels/train`, `labels/val`)
- jalankan training dengan `ultralytics`

Script utamanya ada di `train/yolo_train.py`.

## Catatan penting

Training object detection yang bagus tetap butuh label yang benar. Jadi alur yang paling aman adalah:

1. ekstrak frame
2. auto-label untuk bootstrap
3. rapikan/correct label manual
4. build dataset
5. training

Subcommand `pipeline` disediakan untuk jalur cepat, tapi hasilnya tetap bergantung pada kualitas pseudo-label.

## Jalankan dengan environment edge

Pastikan dependency Python dari `edge/requirements.txt` sudah ter-install.

Contoh di Linux/macOS:

```bash
edge/.venv/bin/python train/yolo_train.py --help
```

Kalau belum punya virtualenv khusus, bisa pakai Python environment yang sudah meng-install:

```bash
pip install -r edge/requirements.txt
```

## Contoh per langkah

Ekstrak 1 frame tiap 15 frame:

```bash
edge/.venv/bin/python train/yolo_train.py extract --sample-every 15
```

Buat pseudo-label `person` dari frame yang sudah diekstrak:

```bash
edge/.venv/bin/python train/yolo_train.py autolabel \
  --model edge/yolo26x.pt \
  --conf 0.35 \
  --imgsz 960
```

Buka interface labeling manual untuk review/correct box hasil auto-label:

```bash
./yolo_lab/run_console.sh
```

Lalu buka URL yang tampil di terminal, biasanya `http://127.0.0.1:8765`.

Fitur ringkas interface ini:

- baca frame dari `train/frames/`
- baca dan tulis label YOLO langsung ke `train/labels/`
- drag untuk membuat box baru
- drag isi/sudut box untuk move dan resize
- `Ctrl+Z` untuk undo perubahan terakhir
- simpan label kosong untuk frame tanpa objek

Susun dataset train/val:

```bash
edge/.venv/bin/python train/yolo_train.py prepare \
  --class-name person \
  --val-ratio 0.2
```

Training model:

```bash
edge/.venv/bin/python train/yolo_train.py train \
  --model edge/yolov5nu.pt \
  --epochs 50 \
  --imgsz 960 \
  --batch 8
```

## Jalur cepat dari footage sampai training

```bash
edge/.venv/bin/python train/yolo_train.py pipeline \
  --autolabel-model edge/yolo26x.pt \
  --train-model edge/yolov5nu.pt \
  --sample-every 15 \
  --conf 0.35 \
  --imgsz 960 \
  --epochs 50 \
  --batch 8
```

Kalau mau preset yang lebih aman untuk mesin CPU di project ini, pakai wrapper:

```bash
bash train/run_cpu_training.sh
```

Preset ini memakai:

- `autolabel-model edge/yolo26x.pt`
- `train-model edge/yolov5nu.pt`
- `sample-every 60`
- `max-frames-per-video 50`
- `imgsz 640`
- `epochs 10`
- `batch 4`
- `workers 0`
- `device cpu`

## Struktur output

Setelah dijalankan, folder yang dipakai adalah:

- `train/frames/` untuk hasil ekstraksi frame
- `train/labels/` untuk label YOLO per frame
- `train/dataset/` untuk dataset siap train
- `train/runs/` untuk hasil training Ultralytics
- `train/manual_labeler/` untuk tool interface anotasi manual

`train/dataset/data.yaml` akan dibuat otomatis dan dipakai oleh subcommand `train`.
