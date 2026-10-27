import copy
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("repair", Path(__file__).parents[1] / "scripts/repair-native-crop-geometry.py")
repair = importlib.util.module_from_spec(spec)
spec.loader.exec_module(repair)


def fixture():
    crop = {"page": 1, "x": 0, "y": .1, "w": 1, "h": .7}
    original = {"pdfHash": "same-pdf", "sourceSha256": "same-bytes", "prefix": "G8-T12", "level": "b",
        "pageCount": 1, "questionCount": 1, "exerciseCount": 1, "exercisePageCount": 1,
        "questions": [{"q": 1, "page": 1, "parts": ["ג"]}], "nativeExportUrl": "/trusted/source.json",
        "exercises": [{"id": "G8-T12-B-Q01ג", "q": 1, "part": "ג", "nativeItemId": "q1c",
            "text": "keep exact task", "prompt": "keep selected part", "requiresVision": True,
            "pin": {"page": 1, "x": .8, "y": .9}, "crop": dict(crop, y=.85, h=.1), "crops": [dict(crop, y=.85, h=.1)]}]}
    measured = copy.deepcopy(original)
    measured.update(mappingValidation="native item labels and question IDs checked", issues=[])
    measured["exercises"][0].update(text="builder placeholder", nativeItemId="do not copy",
        pin={"page": 1, "x": .8, "y": .6}, crop=crop, crops=[crop])
    return original, measured


class GeometryRepair(unittest.TestCase):
    def test_preserves_native_content_and_identity_without_mutating_inputs(self):
        original, measured = fixture()
        snapshot = copy.deepcopy(original)
        result = repair.geometry_only(original, measured)
        self.assertEqual(original, snapshot)
        self.assertEqual(result["exercises"][0]["text"], "keep exact task")
        self.assertEqual(result["exercises"][0]["nativeItemId"], "q1c")
        self.assertEqual(result["exercises"][0]["pin"]["y"], .6)
        self.assertTrue(result["exercises"][0]["requiresVision"])
        self.assertEqual(result["nativeExportUrl"], original["nativeExportUrl"])

    def test_rejects_different_pdf_and_incomplete_parser_mapping(self):
        for field, value in [("sourceSha256", "different-bytes"), ("issues", ["missing part"]),
                             ("mappingValidation", "incomplete"), ("pdfHash", "different-pdf")]:
            original, measured = fixture()
            measured[field] = value
            with self.assertRaises(ValueError):
                repair.geometry_only(original, measured)

    def test_rejects_missing_duplicate_or_changed_exercise(self):
        for mutation in [lambda m: m["exercises"].clear(),
                         lambda m: m["exercises"].append(copy.deepcopy(m["exercises"][0])),
                         lambda m: m["exercises"][0].update(part="ב"),
                         lambda m: m["exercises"][0].update(id="other")]:
            original, measured = fixture()
            mutation(measured)
            with self.assertRaises(ValueError):
                repair.geometry_only(original, measured)

    def test_rejects_invalid_bounds_and_pin_outside_question(self):
        for pin_y, crop_h in [(.9, .7), (.6, 2)]:
            original, measured = fixture()
            measured["exercises"][0]["pin"]["y"] = pin_y
            measured["exercises"][0]["crops"][0]["h"] = crop_h
            with self.assertRaises(ValueError):
                repair.geometry_only(original, measured)


if __name__ == "__main__":
    unittest.main()
