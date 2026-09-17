"""토양 수분 센서 — 환산(app/soil.py)과 엔드포인트(app/main.py).

임시 sqlite 에 붙여 돌린다. app.main 을 import 해도 엔진은 실제로 연결하지
않으므로(연결은 지연 생성) 운영 DB 를 건드리지 않고, get_db 를 갈아끼워
모든 조회가 임시 파일로만 간다.
"""

import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import sessionmaker

from app import soil
from app.database import Base, get_db
from app.korea_time import KOREA_TIMEZONE
from app.main import app
from app.models import AppUser, Plant, SoilReading, SoilSensor
from app.security import create_access_token, hash_password

DEVICE_KEY = "3C:84:27:AB:CD:EF"

# 같은 센서·같은 화분인데도 잴 때마다 흔들린 실측 2회분.
DRY_1, WET_1 = 2145, 1370
DRY_2, WET_2 = 2060, 1320


class SoilConversionTests(unittest.TestCase):
    """환산은 보정값의 방향(젖을 때 전압이 오르는지 내리는지)에 의존하지 않아야 한다."""

    def test_calibration_points_map_to_0_and_100(self):
        self.assertEqual(soil.moisture_percent(DRY_2, DRY_2, WET_2), 0)
        self.assertEqual(soil.moisture_percent(WET_2, DRY_2, WET_2), 100)

    def test_direction_does_not_matter(self):
        """젖을 때 전압이 오르는 센서로 바꿔도 같은 % 가 나와야 한다."""
        falling = soil.moisture_percent(1700, 2060, 1320)  # SEN0308 (젖으면 내려감)
        rising = soil.moisture_percent(1680, 1320, 2060)  # 방향이 반대인 센서
        self.assertEqual(falling, rising)

    def test_outside_calibration_range_is_not_clamped(self):
        """보정할 때보다 더 마르면 음수 — '다시 보정할 때가 됐다' 는 신호라 살려 둔다."""
        self.assertLess(soil.moisture_percent(2300, DRY_2, WET_2), 0)
        self.assertEqual(soil.display_percent(2300, DRY_2, WET_2), 0)

    def test_status_bands(self):
        self.assertEqual(soil.status_for(2300, DRY_2, WET_2), "CHECK")
        self.assertEqual(soil.status_for(WET_2, DRY_2, WET_2), "WET")
        self.assertTrue(soil.needs_water(DRY_2, DRY_2, WET_2))
        self.assertFalse(soil.needs_water(WET_2, DRY_2, WET_2))

    def test_check_is_not_a_watering_signal(self):
        """센서가 빠진 것은 물 줄 일이 아니라 사람이 확인할 일이다."""
        self.assertFalse(soil.needs_water(2300, DRY_2, WET_2))

    def test_zero_span_falls_back_to_defaults(self):
        """두 보정값이 같으면 0 으로 나누는 대신 기본값을 쓴다."""
        self.assertEqual(
            soil.moisture_percent(1700, 1500, 1500),
            soil.moisture_percent(1700, None, None),
        )


class SoilSensorApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.TemporaryDirectory()
        db_file = Path(cls._tmp.name) / "soil.db"
        cls.engine = create_engine(
            f"sqlite:///{db_file.as_posix()}", connect_args={"check_same_thread": False}
        )
        cls.Session = sessionmaker(bind=cls.engine, autocommit=False, autoflush=False)
        Base.metadata.create_all(bind=cls.engine)

        def override_get_db():
            db = cls.Session()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.pop(get_db, None)
        cls.engine.dispose()
        cls._tmp.cleanup()

    def setUp(self):
        with self.Session() as db:
            for table in (SoilReading, SoilSensor, Plant, AppUser):
                db.execute(delete(table))
            user = AppUser(
                email="sensor@test.io",
                password_hash=hash_password("pw12345678"),
                nickname="테스터",
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            plant = Plant(user_id=user.user_id, nickname="몬스테라")
            db.add(plant)
            db.commit()
            db.refresh(plant)
            self.user_id, self.plant_id = user.user_id, plant.plant_id

        self.jwt = {"Authorization": f"Bearer {create_access_token(str(self.user_id))}"}
        self.now = datetime.now(timezone.utc)

    # -- 도우미 ---------------------------------------------------------

    def register(self, plant_id=None):
        response = self.client.post(
            f"/api/plants/{plant_id or self.plant_id}/soil-sensor",
            headers=self.jwt,
            json={"device_key": DEVICE_KEY, "device_label": "거실"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        return body["sensor_id"], {
            "X-Device-Key": DEVICE_KEY,
            "Authorization": f"Bearer {body['device_token']}",
        }

    def calibrate(self, sensor_id, dry_mv, wet_mv):
        return self.client.patch(
            f"/api/soil-sensors/{sensor_id}/calibration",
            headers=self.jwt,
            json={"dry_mv": dry_mv, "wet_mv": wet_mv},
        )

    def send(self, device_headers, readings):
        return self.client.post(
            "/api/soil-readings", headers=device_headers, json={"readings": readings}
        )

    # -- 인증 -----------------------------------------------------------

    def test_device_token_required(self):
        self.register()
        self.assertEqual(self.send({}, [{"raw_mv": 1800}]).status_code, 401)
        wrong = {"X-Device-Key": DEVICE_KEY, "Authorization": "Bearer nope"}
        self.assertEqual(self.send(wrong, [{"raw_mv": 1800}]).status_code, 401)

    def test_other_user_cannot_touch_my_sensor(self):
        sensor_id, _ = self.register()
        with self.Session() as db:
            other = AppUser(
                email="other@test.io",
                password_hash=hash_password("pw12345678"),
                nickname="남",
            )
            db.add(other)
            db.commit()
            db.refresh(other)
            token = create_access_token(str(other.user_id))

        headers = {"Authorization": f"Bearer {token}"}
        self.assertEqual(
            self.client.get(f"/api/plants/{self.plant_id}/soil", headers=headers).status_code, 404
        )
        response = self.client.patch(
            f"/api/soil-sensors/{sensor_id}/calibration",
            headers=headers,
            json={"dry_mv": DRY_2, "wet_mv": WET_2},
        )
        self.assertEqual(response.status_code, 404)

    # -- 보정 -----------------------------------------------------------

    def test_calibration_rejects_equal_endpoints(self):
        sensor_id, _ = self.register()
        self.assertEqual(self.calibrate(sensor_id, 1500, 1500).status_code, 422)

    def test_calibration_rejects_values_outside_adc_range(self):
        sensor_id, _ = self.register()
        self.assertEqual(self.calibrate(sensor_id, soil.ADC_MAX_MV + 1, WET_2).status_code, 422)

    # -- 측정값 수집 ------------------------------------------------------

    def test_batch_insert_and_resend_is_deduplicated(self):
        """응답을 못 받은 기기가 같은 묶음을 다시 보내도 두 번 쌓이지 않는다."""
        _, device = self.register()
        readings = [
            {"raw_mv": 1400, "measured_at": (self.now - timedelta(hours=3)).isoformat()},
            {"raw_mv": 1750, "measured_at": (self.now - timedelta(hours=2)).isoformat()},
            {"raw_mv": 2040, "measured_at": (self.now - timedelta(hours=1)).isoformat()},
        ]
        first = self.send(device, readings).json()
        self.assertEqual((first["accepted"], first["duplicated"]), (3, 0))

        again = self.send(device, readings).json()
        self.assertEqual((again["accepted"], again["duplicated"]), (0, 3))

    def test_broken_device_clock_does_not_lose_readings(self):
        """NTP 가 안 맞아 시각이 없거나 말이 안 돼도 측정값 자체는 멀쩡하므로 버리지 않는다.

        묶음 전체에 같은 시각을 주면 서로 중복으로 걸려 한 건만 남기 때문에,
        전송 주기만큼 거슬러 올라가며 서로 다른 시각을 준다.
        """
        _, device = self.register()

        no_time = self.send(device, [{"raw_mv": 1500}, {"raw_mv": 1510}, {"raw_mv": 1520}])
        self.assertEqual(no_time.json()["accepted"], 3)

        epoch = self.send(device, [{"raw_mv": 1530, "measured_at": "1970-01-01T00:00:00+00:00"}])
        self.assertEqual(epoch.json()["accepted"], 1)

        future = self.send(
            device, [{"raw_mv": 1540, "measured_at": (self.now + timedelta(days=1)).isoformat()}]
        )
        self.assertEqual(future.json()["accepted"], 1)

        with self.Session() as db:
            stored = db.scalars(select(SoilReading.measured_at)).all()
        self.assertTrue(all(moment.year >= 2024 for moment in stored), stored)

    # -- 조회 -----------------------------------------------------------

    def test_status_uses_calibration_snapshot_not_current(self):
        """재보정이 과거 기록의 % 를 바꾸면 안 된다 — 이 설계의 핵심."""
        sensor_id, device = self.register()
        self.calibrate(sensor_id, DRY_1, WET_1)
        self.send(device, [{"raw_mv": 1700, "measured_at": (self.now - timedelta(hours=1)).isoformat()}])

        before = self.client.get(f"/api/plants/{self.plant_id}/soil", headers=self.jwt).json()

        # 흙이 마르는 정도·꽂은 깊이가 달라져 보정을 다시 잡는다.
        self.calibrate(sensor_id, DRY_2, WET_2)
        after = self.client.get(f"/api/plants/{self.plant_id}/soil", headers=self.jwt).json()

        self.assertEqual(before["moisture_pct"], after["moisture_pct"])
        # 새 보정으로 계산했다면 다른 값이 나왔어야 한다 (그래야 이 검사가 의미 있다).
        self.assertNotEqual(
            soil.display_percent(1700, DRY_1, WET_1), soil.display_percent(1700, DRY_2, WET_2)
        )

    def test_status_404_before_any_reading(self):
        self.register()
        response = self.client.get(f"/api/plants/{self.plant_id}/soil", headers=self.jwt)
        self.assertEqual(response.status_code, 404)

    def history(self, period):
        return self.client.get(
            f"/api/plants/{self.plant_id}/soil/history?period={period}", headers=self.jwt
        ).json()

    def test_history_day_returns_each_reading(self):
        """period=day 는 기상청 시간별 계열과 같은 축이라 원본을 그대로 준다."""
        _, device = self.register()
        # 지금 시각은 어떤 시간대에 돌려도 '한국 날짜의 오늘' 안에 있다.
        self.send(device, [{"raw_mv": 1700, "measured_at": self.now.isoformat()}])

        points = self.history("day")
        self.assertEqual(len(points), 1, points)
        self.assertIn("T", points[0]["observed_at"])  # 날짜가 아니라 시각
        self.assertEqual(points[0]["raw_mv"], 1700)

    def test_timestamps_are_korea_time(self):
        """앱은 기온·습도와 같은 x축에 겹쳐 그린다. 그쪽이 시간대 표기 없는
        한국 시각이라, UTC 로 내보내면 선이 9시간 밀린다."""
        _, device = self.register()
        self.send(device, [{"raw_mv": 1700, "measured_at": self.now.isoformat()}])

        expected = self.now.astimezone(KOREA_TIMEZONE).replace(tzinfo=None)

        point = self.history("day")[0]["observed_at"]
        self.assertEqual(datetime.fromisoformat(point).hour, expected.hour, point)

        current = self.client.get(
            f"/api/plants/{self.plant_id}/soil", headers=self.jwt
        ).json()["measured_at"]
        self.assertEqual(datetime.fromisoformat(current).hour, expected.hour, current)
        # 시간대 표기가 붙으면 앱의 new Date() 가 다르게 읽는다
        self.assertNotIn("+", current)
        self.assertFalse(current.endswith("Z"))

    def test_history_week_averages_per_day(self):
        """period=week 는 하루 평균. 날짜 경계는 한국 기준으로 센다."""
        sensor_id, device = self.register()
        self.calibrate(sensor_id, DRY_2, WET_2)

        # 이틀 전 2건, 사흘 전 1건 — 둘 다 '어제까지 7일' 안에 확실히 들어간다.
        two = self.now - timedelta(days=2)
        three = self.now - timedelta(days=3)
        self.send(device, [
            {"raw_mv": 1600, "measured_at": two.isoformat()},
            {"raw_mv": 1800, "measured_at": (two + timedelta(hours=1)).isoformat()},
            {"raw_mv": 2000, "measured_at": three.isoformat()},
        ])

        points = self.history("week")
        self.assertEqual(len(points), 2, points)
        self.assertNotIn("T", points[0]["observed_at"])  # 시각이 아니라 날짜
        self.assertEqual([p["observed_at"] for p in points],
                         sorted(p["observed_at"] for p in points))

        # 사흘 전이 먼저, 이틀 전은 1600/1800 의 평균
        self.assertEqual(points[0]["raw_mv"], 2000)
        self.assertEqual(points[1]["raw_mv"], 1700)

    def test_history_week_excludes_today(self):
        """ASOS 일자료가 전일까지만 나와서 날씨 선은 오늘이 없다. 축을 맞춘다."""
        _, device = self.register()
        self.send(device, [{"raw_mv": 1700, "measured_at": self.now.isoformat()}])
        self.assertEqual(self.history("week"), [])

    def test_history_rejects_unknown_period(self):
        response = self.client.get(
            f"/api/plants/{self.plant_id}/soil/history?period=year", headers=self.jwt
        )
        self.assertEqual(response.status_code, 422)

    # -- 기기 이동 --------------------------------------------------------

    def test_moving_sensor_clears_calibration_but_keeps_history(self):
        sensor_id, device = self.register()
        self.calibrate(sensor_id, DRY_2, WET_2)
        self.send(device, [{"raw_mv": 1700, "measured_at": (self.now - timedelta(hours=1)).isoformat()}])

        with self.Session() as db:
            second = Plant(user_id=self.user_id, nickname="스투키")
            db.add(second)
            db.commit()
            db.refresh(second)
            second_id = second.plant_id

        self.register(plant_id=second_id)

        moved = self.client.get(f"/api/plants/{second_id}/soil-sensor", headers=self.jwt).json()
        self.assertFalse(moved["is_calibrated"])
        self.assertIsNone(moved["dry_mv"])

        # 옛 화분의 기록은 그 화분 것으로 남는다.
        kept = self.client.get(f"/api/plants/{self.plant_id}/soil", headers=self.jwt)
        self.assertEqual(kept.status_code, 200)
        self.assertEqual(kept.json()["raw_mv"], 1700)


if __name__ == "__main__":
    unittest.main()
