import tempfile
import unittest
from pathlib import Path
import sys

PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

from train import yolo_train


class TrainCliUtilityTest(unittest.TestCase):
    def test_xyxy_to_yolo_line_clamps_boxes_and_skips_invalid_dimensions(self):
        self.assertEqual(
            yolo_train._xyxy_to_yolo_line((-10, 20, 50, 80), 100, 100),
            "0 0.250000 0.500000 0.500000 0.600000",
        )
        self.assertIsNone(yolo_train._xyxy_to_yolo_line((10, 10, 10, 20), 100, 100))
        self.assertIsNone(yolo_train._xyxy_to_yolo_line((10, 10, 20, 20), 0, 100))

    def test_nested_duplicate_suppression_keeps_strong_full_body_boxes(self):
        detections = [
            (0, 0, 100, 200, 0.9),
            (25, 20, 75, 100, 0.8),
            (180, 0, 260, 180, 0.7),
        ]

        filtered, suppressed = yolo_train._suppress_duplicate_person_detections(
            detections,
            containment_threshold=0.9,
        )

        self.assertEqual(suppressed, 1)
        self.assertEqual(filtered, [detections[0], detections[2]])

    def test_resolve_model_source_accepts_official_model_names_and_rejects_missing_paths(self):
        self.assertEqual(yolo_train._resolve_model_source("yolo11n.pt"), "yolo11n.pt")
        with self.assertRaisesRegex(yolo_train.CliError, "File model tidak ditemukan"):
            yolo_train._resolve_model_source("./missing-model.pt")

    def test_default_class_names_falls_back_to_person(self):
        self.assertEqual(yolo_train._default_class_names(None), ["person"])
        self.assertEqual(yolo_train._default_class_names(["", "person", "staff "]), ["person", "staff"])

    def test_resolve_target_images_selects_existing_names_and_reports_missing(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            frames_dir = Path(temp_dir)
            (frames_dir / "a.jpg").write_text("image", encoding="utf-8")
            (frames_dir / "b.png").write_text("image", encoding="utf-8")

            selected = yolo_train._resolve_target_images(frames_dir, ["../a.jpg", "b.png"])
            self.assertEqual([path.name for path in selected], ["a.jpg", "b.png"])

            with self.assertRaisesRegex(yolo_train.CliError, "Frame target tidak ditemukan"):
                yolo_train._resolve_target_images(frames_dir, ["missing.jpg"])


class PrepareDatasetTest(unittest.TestCase):
    def test_prepare_dataset_splits_images_labels_and_writes_data_yaml(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            frames_dir = root / "frames"
            labels_dir = root / "labels"
            dataset_dir = root / "dataset"
            frames_dir.mkdir()
            labels_dir.mkdir()

            for index in range(3):
                (frames_dir / f"frame-{index}.jpg").write_text("image", encoding="utf-8")
                (labels_dir / f"frame-{index}.txt").write_text(
                    "0 0.500000 0.500000 0.250000 0.250000\n",
                    encoding="utf-8",
                )

            yaml_path = yolo_train.prepare_dataset(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                dataset_dir=dataset_dir,
                class_names=["person", "staff"],
                val_ratio=0.34,
                seed=123,
                allow_empty_labels=False,
            )

            self.assertTrue(yaml_path.exists())
            self.assertIn('"person"', yaml_path.read_text(encoding="utf-8"))
            self.assertEqual(len(list((dataset_dir / "images" / "train").iterdir())), 2)
            self.assertEqual(len(list((dataset_dir / "images" / "val").iterdir())), 1)
            self.assertEqual(len(list((dataset_dir / "labels" / "train").iterdir())), 2)
            self.assertEqual(len(list((dataset_dir / "labels" / "val").iterdir())), 1)

    def test_prepare_dataset_requires_labels_unless_empty_labels_are_allowed(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            frames_dir = root / "frames"
            labels_dir = root / "labels"
            dataset_dir = root / "dataset"
            frames_dir.mkdir()
            labels_dir.mkdir()
            (frames_dir / "empty.jpg").write_text("image", encoding="utf-8")

            with self.assertRaisesRegex(yolo_train.CliError, "Masih ada label yang belum dibuat"):
                yolo_train.prepare_dataset(
                    frames_dir=frames_dir,
                    labels_dir=labels_dir,
                    dataset_dir=dataset_dir,
                    class_names=["person"],
                    val_ratio=0.2,
                    seed=42,
                    allow_empty_labels=False,
                )

            yolo_train.prepare_dataset(
                frames_dir=frames_dir,
                labels_dir=labels_dir,
                dataset_dir=dataset_dir,
                class_names=["person"],
                val_ratio=0.2,
                seed=42,
                allow_empty_labels=True,
            )
            self.assertEqual((labels_dir / "empty.txt").read_text(encoding="utf-8"), "")

    def test_prepare_dataset_rejects_invalid_label_rows(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            frames_dir = root / "frames"
            labels_dir = root / "labels"
            dataset_dir = root / "dataset"
            frames_dir.mkdir()
            labels_dir.mkdir()
            (frames_dir / "bad.jpg").write_text("image", encoding="utf-8")
            (labels_dir / "bad.txt").write_text("2 0.5 0.5 0.2 0.2\n", encoding="utf-8")

            with self.assertRaisesRegex(yolo_train.CliError, "di luar rentang"):
                yolo_train.prepare_dataset(
                    frames_dir=frames_dir,
                    labels_dir=labels_dir,
                    dataset_dir=dataset_dir,
                    class_names=["person"],
                    val_ratio=0.2,
                    seed=42,
                    allow_empty_labels=False,
                )


if __name__ == "__main__":
    unittest.main()
