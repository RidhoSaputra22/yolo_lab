import os
import sys
import types
import unittest
from pathlib import Path

import numpy as np

PROJECT_DIR = Path(__file__).resolve().parents[2]
if str(PROJECT_DIR) not in sys.path:
    sys.path.insert(0, str(PROJECT_DIR))

dotenv = types.ModuleType("dotenv")
dotenv.load_dotenv = lambda *args, **kwargs: None
sys.modules.setdefault("dotenv", dotenv)

REQUIRED_ENV = {
    "EDGE_MODE": "offline",
    "EDGE_CAMERA_ID": "7",
    "EDGE_POST_INTERVAL_SECONDS": "5",
    "EDGE_CONFIG_REFRESH_SECONDS": "30",
    "EDGE_STREAM_HOST": "127.0.0.1",
    "EDGE_STREAM_PORT": "8090",
    "EDGE_STREAM_JPEG_QUALITY": "80",
    "EDGE_STREAM_ALLOW_ORIGIN": "*",
    "YOLOV5_CONF": "0.25",
    "YOLOV5_IOU": "0.45",
    "YOLOV5_IMG_SIZE": "640",
    "YOLOV5_DEVICE": "cpu",
    "YOLOV5_WEIGHTS": "edge/fake.pt",
    "TRACK_MAX_DISAPPEARED": "2",
    "TRACK_MAX_DISTANCE": "80",
    "TRACK_CONFIRM_FRAMES": "1",
    "FACE_RECOGNITION_ENABLED": "false",
    "INSIGHTFACE_MODEL_NAME": "buffalo_l",
    "INSIGHTFACE_DET_SIZE": "640",
    "INSIGHTFACE_PROVIDERS": "CPUExecutionProvider",
    "EMPLOYEE_MATCH_THRESHOLD": "0.45",
    "EMPLOYEE_REGISTRY_REFRESH_SECONDS": "60",
    "FACE_RECHECK_SECONDS": "2",
    "FACE_UNKNOWN_TIMEOUT": "5",
    "BACKEND_URL": "http://localhost",
    "EDGE_AUTH_USERNAME": "user",
    "EDGE_AUTH_PASSWORD": "pass",
}
for key, value in REQUIRED_ENV.items():
    os.environ.setdefault(key, value)

from edge.core import api_client, config
from edge.core.tracker import CentroidTrackerFallback


class EdgeConfigAndApiTest(unittest.TestCase):
    def test_config_env_helpers_parse_values_and_report_required_errors(self):
        os.environ["UNIT_INT"] = "12"
        os.environ["UNIT_FLOAT"] = "0.75"
        os.environ["UNIT_BOOL"] = "yes"
        os.environ["UNIT_BAD_INT"] = "abc"

        self.assertEqual(config.env_int("UNIT_INT", 1), 12)
        self.assertEqual(config.env_float("UNIT_FLOAT", 0.1), 0.75)
        self.assertTrue(config.env_bool("UNIT_BOOL"))
        self.assertEqual(config.env_int("UNIT_BAD_INT", 9), 9)
        with self.assertRaisesRegex(RuntimeError, "Missing required environment variable"):
            config.env_required("UNIT_MISSING_REQUIRED")

    def test_visitor_keys_are_deterministic_and_embedding_keys_ignore_scale(self):
        fallback = api_client.generate_visitor_key(7, 11, "2026-04-30")
        self.assertEqual(len(fallback), 32)
        self.assertEqual(
            api_client.generate_visitor_key_from_embedding(None, 7, 11, "2026-04-30"),
            fallback,
        )

        embedding = np.array([1.0, 2.0, 3.0], dtype=np.float32)
        scaled_embedding = embedding * 4
        self.assertEqual(
            api_client.generate_visitor_key_from_embedding(embedding, 7, 11, "2026-04-30"),
            api_client.generate_visitor_key_from_embedding(scaled_embedding, 7, 99, "2026-04-30"),
        )


class CentroidTrackerFallbackTest(unittest.TestCase):
    def test_tracker_keeps_nearby_identity_and_drops_stale_tracks(self):
        tracker = CentroidTrackerFallback(max_disappeared=1, max_distance=25)

        first = tracker.update([(0, 0, 10, 10), (100, 100, 110, 110)])
        self.assertEqual(set(first.keys()), {1, 2})
        self.assertEqual(first[1].centroid, (5.0, 5.0))

        second = tracker.update([(2, 0, 12, 10)])
        self.assertEqual(set(second.keys()), {1, 2})
        self.assertEqual(second[1].centroid, (7.0, 5.0))
        self.assertEqual(second[2].disappeared, 1)

        third = tracker.update([])
        self.assertEqual(set(third.keys()), {1})
        self.assertEqual(third[1].disappeared, 1)

    def test_tracker_creates_new_track_for_far_detection(self):
        tracker = CentroidTrackerFallback(max_disappeared=2, max_distance=10)
        tracker.update([(0, 0, 10, 10)])
        tracks = tracker.update([(100, 100, 110, 110)])

        self.assertEqual(set(tracks.keys()), {1, 2})
        self.assertEqual(tracks[1].disappeared, 1)
        self.assertEqual(tracks[2].centroid, (105.0, 105.0))


if __name__ == "__main__":
    unittest.main()
