import io
import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from PIL import Image
from qdrant_client.http import models as qmodels

from app import diagnosis

HOUSE = "house-col"
CROP = "crop-col"


def image_bytes():
    output = io.BytesIO()
    Image.new("RGB", (8, 8), (10, 120, 60)).save(output, format="PNG")
    return output.getvalue()


def house_point(point_id, score, species, part="잎", cause="과습"):
    return SimpleNamespace(
        id=point_id,
        score=score,
        payload={
            "plant_species": species, "plant_part": part, "suspected_cause": cause,
            "symptom_group": None, "file_name": f"h{point_id}.jpg", "source_url": None,
        },
    )


def crop_point(score, species, part="잎", cause="흰가루병"):
    return SimpleNamespace(
        id=str(uuid.uuid4()),
        score=score,
        payload={
            "plant_species": species, "plant_part": part, "suspected_cause": cause,
            "symptom_group": None, "file_name": "c.jpg", "source_url": None, "domain": "crop",
        },
    )


class FakeQdrant:
    """query_points의 필터(종/부위/제외 ID)와 score_threshold를 실제로 해석하는 가짜 클라이언트."""

    def __init__(self, collections, failing=()):
        self.collections = collections
        self.failing = set(failing)

    def _matches(self, point, query_filter):
        if query_filter is None:
            return True
        for cond in query_filter.must or []:
            value = point.payload.get(cond.key)
            if isinstance(cond.match, qmodels.MatchAny):
                if value not in cond.match.any:
                    return False
            elif value != cond.match.value:
                return False
        for cond in query_filter.must_not or []:
            if isinstance(cond, qmodels.HasIdCondition):
                if point.id in cond.has_id:
                    return False
            else:  # FieldCondition (예: 사용자 종 제외)
                value = point.payload.get(cond.key)
                excluded = value in cond.match.any if isinstance(cond.match, qmodels.MatchAny) else value == cond.match.value
                if excluded:
                    return False
        return True

    def query_points(self, *, collection_name, query, limit, score_threshold, query_filter):
        if collection_name in self.failing:
            raise RuntimeError("collection unavailable")
        points = [
            p for p in self.collections[collection_name]
            if p.score >= score_threshold and self._matches(p, query_filter)
        ]
        points.sort(key=lambda p: p.score, reverse=True)
        return SimpleNamespace(points=points[:limit])


class TieredSearchTests(unittest.TestCase):
    def search(self, collections, *, crop_enabled=True, crop_min=0.6, failing=(), **kwargs):
        settings = SimpleNamespace(
            app_role="standalone",
            qdrant_collection=HOUSE,
            qdrant_crop_collection=CROP if crop_enabled else "",
            qdrant_crop_min_score=crop_min,
        )
        fake = FakeQdrant(collections, failing=failing)
        with patch.object(diagnosis, "settings", settings), \
                patch.object(diagnosis, "_qdrant", return_value=fake), \
                patch.object(diagnosis, "_embed_image", return_value=[0.0]):
            kwargs.setdefault("top_k", 5)
            kwargs.setdefault("min_score", 0.75)
            return diagnosis.search_similar_cases(image_bytes(), **kwargs)

    def test_crop_disabled_keeps_part_first_behaviour(self):
        collections = {
            HOUSE: [
                house_point(1, 0.95, "몬스테라", part="줄기"),
                house_point(2, 0.90, "몬스테라", part="잎"),
                house_point(3, 0.85, "고무나무", part="잎"),
            ],
            CROP: [crop_point(0.99, "딸기")],
        }
        cases = self.search(collections, crop_enabled=False, plant_part="잎")
        self.assertEqual([c.image_id for c in cases], [2, 3, 1])
        self.assertTrue(all(c.domain == "houseplant" for c in cases))

    def test_tier_order_species_then_other_houseplant_then_weighted_crop(self):
        collections = {
            HOUSE: [
                house_point(1, 0.80, "몬스테라"),
                house_point(2, 0.99, "고무나무"),
            ],
            CROP: [
                crop_point(0.90, "딸기", cause="탄저병"),       # 0.90 * 0.65 = 0.585
                crop_point(0.80, "오이", cause="일소현상"),     # 0.80 * 0.90 = 0.72
            ],
        }
        cases = self.search(collections, plant_species="몬스테라", top_k=4)
        self.assertEqual(
            [(c.domain, c.suspected_cause) for c in cases],
            [
                ("houseplant", "과습"),      # 같은 종이 유사도가 더 낮아도 먼저
                ("houseplant", "과습"),
                ("crop", "일소현상"),        # 가중치 보정 순위가 raw 순위를 뒤집는다
                ("crop", "탄저병"),
            ],
        )
        self.assertEqual([c.image_id for c in cases[:2]], [1, 2])
        self.assertEqual(cases[2].score, 0.80)  # 응답 score는 가중치 곱하기 전 값

    def test_crop_only_fills_remaining_slots(self):
        collections = {
            HOUSE: [house_point(i, 0.9 - i / 100, "몬스테라") for i in range(1, 6)],
            CROP: [crop_point(0.99, "딸기")],
        }
        cases = self.search(collections, plant_species="몬스테라", top_k=5)
        self.assertEqual([c.domain for c in cases], ["houseplant"] * 5)

    def test_same_species_crop_is_promoted_without_discount(self):
        collections = {
            HOUSE: [house_point(1, 0.80, "몬스테라"), house_point(2, 0.95, "고무나무")],
            CROP: [crop_point(0.97, "레몬", cause="궤양병"), crop_point(0.99, "딸기")],
        }
        cases = self.search(collections, plant_species="레몬나무", top_k=4)
        # '레몬나무' -> '레몬' 변형으로 crop 레몬 사례가 1단계로 올라오고 할인(궤양병 0.5)이 없다.
        self.assertEqual(cases[0].domain, "crop")
        self.assertEqual(cases[0].plant_species, "레몬")
        self.assertEqual(cases[0].score, 0.97)
        # 다른 종 crop(딸기)은 여전히 3단계라 houseplant 뒤에 온다.
        self.assertEqual([c.domain for c in cases], ["crop", "houseplant", "houseplant", "crop"])

    def test_same_species_crop_keeps_best_one_per_cause(self):
        collections = {
            HOUSE: [house_point(i, 0.80 - i / 100, "몬스테라") for i in range(1, 6)],
            CROP: [
                crop_point(0.95, "레몬", cause="귤굴나방"),
                crop_point(0.94, "레몬", cause="귤굴나방"),   # 같은 원인 -> 가장 높은 것만 남김
                crop_point(0.93, "레몬", cause="귤굴나방"),
                crop_point(0.92, "레몬", cause="그을음병"),
                crop_point(0.91, "레몬", cause="응애벌레"),
            ],
        }
        cases = self.search(collections, plant_species="레몬나무", top_k=5)
        crop_cases = [c for c in cases if c.domain == "crop"]
        # 원인별 최고 유사도 1건씩 = 3건, 나머지 자리는 실내식물이 채운다
        self.assertEqual([(c.suspected_cause, c.score) for c in crop_cases],
                         [("귤굴나방", 0.95), ("그을음병", 0.92), ("응애벌레", 0.91)])
        self.assertEqual(len(cases) - len(crop_cases), 2)

    def test_lower_similarity_cause_is_not_crowded_out_by_dominant_cause(self):
        # 한 원인(a)이 상위 후보를 훨씬 많이 차지해도 유사도가 조금 낮은 다른 원인(b)이 살아남는다.
        collections = {
            HOUSE: [],
            CROP: [crop_point(0.99 - i / 1000, "레몬", cause="귤굴나방") for i in range(40)]
            + [crop_point(0.85, "레몬", cause="그을음병")],
        }
        cases = self.search(collections, plant_species="레몬나무", top_k=5)
        self.assertEqual({c.suspected_cause for c in cases}, {"귤굴나방", "그을음병"})

    def test_single_cause_species_gets_only_one_crop_case(self):
        # 올리브처럼 crop 원인이 하나뿐인 종은 과습 사진이어도 탄저병이 top-5를 통째로 채우면 안 된다.
        collections = {
            HOUSE: [house_point(i, 0.90 - i / 100, "로즈마리", cause="과습") for i in range(1, 6)],
            CROP: [crop_point(0.95 - i / 100, "올리브", cause="탄저병") for i in range(8)],
        }
        cases = self.search(collections, plant_species="올리브나무", top_k=5)
        self.assertEqual(sum(c.domain == "crop" for c in cases), 1)
        self.assertEqual(sum(c.domain == "houseplant" for c in cases), 4)

    def test_same_species_crop_not_reintroduced_by_third_tier(self):
        # 실내식물이 모자라도 사용자 종 crop은 상한(1단계) 이상으로 3단계에서 다시 채워지지 않는다.
        collections = {
            HOUSE: [],
            CROP: [
                crop_point(0.95, "올리브", cause="탄저병"),
                crop_point(0.94, "올리브", cause="탄저병"),
                crop_point(0.93, "올리브", cause="탄저병"),
                crop_point(0.85, "딸기", cause="흰가루병"),
            ],
        }
        cases = self.search(collections, plant_species="올리브나무", top_k=5)
        species = [c.plant_species for c in cases]
        self.assertEqual(species.count("올리브"), 1)
        self.assertEqual(species.count("딸기"), 1)

    def test_part_priority_applies_inside_each_tier(self):
        collections = {
            HOUSE: [],
            CROP: [
                crop_point(0.95, "딸기", part="열매", cause="흰가루병"),
                crop_point(0.70, "딸기", part="잎", cause="흰가루병"),
            ],
        }
        cases = self.search(collections, plant_part="잎", top_k=2, crop_min=0.6)
        self.assertEqual([c.plant_part for c in cases], ["잎", "열매"])

    def test_crop_uses_its_own_min_score(self):
        collections = {HOUSE: [], CROP: [crop_point(0.70, "딸기")]}
        self.assertEqual(len(self.search(collections, crop_min=0.6)), 1)
        self.assertEqual(len(self.search(collections, crop_min=0.8)), 0)

    def test_crop_cases_have_no_reference_image_id(self):
        collections = {HOUSE: [house_point(7, 0.9, "몬스테라")], CROP: [crop_point(0.9, "딸기")]}
        cases = self.search(collections, top_k=2)
        self.assertEqual(cases[0].image_id, 7)
        self.assertIsNone(cases[1].image_id)
        self.assertEqual(cases[1].domain, "crop")

    def test_crop_collection_failure_does_not_break_search(self):
        collections = {HOUSE: [house_point(1, 0.9, "몬스테라")], CROP: [crop_point(0.9, "딸기")]}
        with self.assertLogs(diagnosis.logger, level="WARNING"):
            cases = self.search(collections, plant_species="몬스테라", failing=[CROP])
        self.assertEqual([c.image_id for c in cases], [1])

    def test_species_variants(self):
        self.assertEqual(diagnosis._species_variants(None), [])
        self.assertEqual(diagnosis._species_variants("  "), [])
        self.assertEqual(diagnosis._species_variants("몬스테라"), ["몬스테라"])
        self.assertEqual(diagnosis._species_variants("올리브나무"), ["올리브나무", "올리브"])

    def test_format_marks_crop_cases_only(self):
        house = diagnosis.SimilarCase(0.9, "몬스테라", None, "과습", "잎", 1, "a.jpg", None)
        crop = diagnosis.SimilarCase(0.8, "딸기", None, "흰가루병", "잎", None, "b.jpg", None, domain="crop")
        lines = diagnosis._format_similar_cases([house, crop]).splitlines()
        self.assertNotIn("domain=", lines[0])
        self.assertIn("domain=crop", lines[1])


if __name__ == "__main__":
    unittest.main()
