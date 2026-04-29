# YOLO Lab Test Cases

Jalankan semua test dari folder `app`:

```sh
bun test
```

Jalankan test Python dari root project:

```sh
python3 -m unittest discover -s tests/python
```

## Cakupan

- Server core: path resolver, path safety, parser YAML/CSV, formatter command, discovery file, pilihan folder frame, dan preference JSON.
- Labeler: daftar frame, simpan/baca label YOLO, validasi class dan ukuran image, parse error label, checkpoint, delete frame, dan aktivasi folder frame.
- Footage dataset: preview command ekstraksi frame, snapshot library kosong, import video valid, skip file non-video, dan nama upload unik/aman.
- YOLO tester: validasi payload runner, preview command offline, artifact JSON/CSV/MP4, dan diagnosa MP4 tidak playable.
- YOLO training: preview command prepare-train, class names, workspace summary, run summary, metrics CSV, weights, dan preview artifacts.
- Autolabel: validasi config model/threshold, command target frame deduplikatif, mode overwrite, dan flag duplicate suppression.
- API routes: config labeler, labels API, preferences API, checkpoint, delete frame, autolabel selection error, runner preview/status, browse file project, method error, frame serving, dan artifact guard.
- Frontend shared helpers: grouping artifact, path utility, class join, clamp, file size label, dan `fetchJson`.
- Python train CLI: konversi box YOLO, duplicate suppression, model source resolver, target image resolver, dataset prepare, split train/val, empty label, dan validasi label.
- Python edge core: env parser, visitor key, embedding key, dan fallback centroid tracker.

Test sengaja tidak menjalankan proses YOLO/training sungguhan agar cepat dan deterministik. Validasi proses berat dicakup lewat command builder, payload normalizer, dan endpoint start/preview/status.
