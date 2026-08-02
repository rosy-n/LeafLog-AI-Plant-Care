# 날씨/대기질 연동 — 구현 계획

## Context

식물 케어 앱에 날씨·대기질 정보를 (1) 홈 화면 아이콘, (2) 페르소나 대화 컨텍스트, (3) 새 데이터 화면의 그래프 세 곳에 연동한다. 대기질은 에어코리아(KHAI 4등급), 날씨는 기상청 초단기예보(맑음/흐림/비/눈 4분류 + 기온·습도 실수치)로 확정했고, 조회 기준 위치는 사용자가 동네를 수동 검색/선택하는 방식으로 확정했다. 위치 입력은 **회원가입 흐름(닉네임 다음 단계)** 에서 한 번 받아 계속 재사용하는 구조로 확정했다.

**탐색 중 발견한, 계획을 완전히 재구성한 사실 3가지:**

1. **`docs/database-schema.sql`에 이미 필요한 테이블이 설계돼 있다.** `weather_log`(462번 줄, `user_id/plant_id/location_name/observed_at/temperature_c/humidity_pct/pm10/pm25/weather_status/air_quality_status/source_api/raw_data` — 정확히 이 기능에 필요한 스냅샷 테이블)과 `user_setting`(25번 줄, `default_location VARCHAR(255)` — "서울 마포구" 형태의 위치 필드 포함). 새로 설계할 필요 없이 이 스펙을 그대로 구현하면 된다.
2. **`apps/api/app/persona_chat.py`에 날씨/대기질 스캐폴딩이 이미 있는데 미연결 상태다.** `WeatherAirQuality` dataclass(99-102줄), 프롬프트에 주입하는 `build_weather_air_quality_context()`(164-173줄)와 답변 규칙까지 이미 완성돼 있음. `main.py`의 `persona_chat_reply`(635줄)가 `weather_air_quality=None`으로 하드코딩만 돼 있어서, 실제로 값을 채워 넣는 연결부만 만들면 된다. 프롬프트 텍스트는 이미 리뷰된 상태로 간주하고 건드리지 않는다.
3. **`apps/mobile/app/`(Expo Router)과 `App.js`+`src/screens/`(구식 React Navigation)가 공존하지만, 실제 실행되는 건 후자다.** `package.json`의 `"main"`이 `expo-router/entry`가 아니고, `index.js`가 `./App`(`App.tsx`→`App.js`)을 import한다. 최근 페르소나챗 연동(`cf96dee`)과 아이콘 추가(`f6e7539`)도 전부 `App.js`/`src/screens/*`에서 일어났다. `app/add-plant/*`는 죽은 코드가 아니라 — `src/screens/AddPlantNavigator.jsx`가 그 컴포넌트들을 직접 import해서 React Navigation Stack으로 감싸고, `src/hooks/useAddPlantRouter.ts`가 `expo-router`의 `useRouter`/`useLocalSearchParams`를 흉내내는 shim으로 다리를 놓는 구조다. 이번 기능도 이 패턴을 따라 **실제 동작하는 `App.js`/`src/screens/` 쪽에 만든다.**
   - `src/screens/HomeScreen.jsx`(82-94줄)에 날씨/대기질 아이콘 UI가 **이미 자리 잡고 있다** — 지금은 `snow_icon.png` 고정 + 정적 `AirIcon()` 컴포넌트, `onPress` 없음. 여기에 실데이터만 연결하면 된다.
   - `src/screens/SensorDataScreen.jsx`는 `App.js`에 `"SensorData"`라는 이름으로 **이미 Stack.Screen 등록까지 돼 있다**(App.js 275줄). 목데이터 기반의 완성된 `react-native-svg` 라인차트(`LineChart`/`StatCard`)를 갖고 있음 — 다만 `HomeScreen.jsx`의 `HOME_MENU_ITEMS`(24-27줄)에는 진입 항목이 없어서 지금은 도달 불가능한 화면이다.
   - `assets/icons/`에 `sunny_icon.png`/`cloudy_icon.png`/`rainy_icon.png`/`snow_icon.png`가 이미 커밋되어 있다(`f6e7539`) — 날씨 아이콘 4종 모두 새로 준비할 필요 없음.
   - `SettingsScreen.tsx`에 이미 "알림" 섹션(`SectionLabel`/`RowDivider` 패턴, 252줄~)이 있어, 이후 지역을 바꾸고 싶을 때를 위한 Row를 자연스럽게 추가할 수 있다(다만 최초 설정은 회원가입 흐름에서 받음 — 아래 참고).

## 브랜치

`feature/plant-registration`(HEAD `3a6dd74`, persona-chat·develop 이미 병합됨)에서 새 브랜치 `feature/weather-air-quality`를 판다. `feature/mobile-home-dashboard`는 Expo Router 이전의 완전히 다른 파일 구조라 병합 불가 — 참고하지 않는다.

## Backend (`apps/api/`)

### 신규 파일
- **`apps/api/app/region_data.py`** — 시/군/구 단위 정적 참조 데이터(`{name, lat, lng, kma_nx, kma_ny}`, ~250개). `find_region(name)`(정확 매칭), `search_regions(query)`(부분 매칭, 상위 20개). 위경도 원본 데이터는 공개 행정구역 좌표 데이터셋에서 한 번 가져와 파일에 박아넣는다.
- **`apps/api/app/weather.py`** — 기상청 초단기예보(getUltraSrtFcst) 클라이언트.
  - `latlon_to_grid()`: region_data에서 nx/ny를 미리 계산해두면 불필요 — nx/ny를 region_data에 직접 저장하는 쪽을 권장.
  - `select_base_datetime(now)`: 초단기예보는 매시 45분 발표 — 그 전이면 이전 시각으로 롤백(자정 넘어가는 경우 포함).
  - `fetch_ultra_short_forecast(nx, ny) -> KmaForecast`: `sky`, `pty`, `temperature_c`(T1H), `humidity_pct`(REH) 반환. 실패 시 `WeatherFetchError` — `persona_chat.py`의 `RuntimeError` 패턴(464-490줄)과 동일한 스타일.
  - `classify_weather(sky, pty)`: SKY 1→맑음, 3/4→흐림, PTY 1/4/5/6→비, 3/7→눈. **PTY 2("비 또는 눈")는 모호 — `temperature_c <= 0`이면 눈, 아니면 비로 폴백.**
  - 인메모리 TTL 캐시(nx,ny 키, ~10-15분) — 홈 화면·페르소나챗·데이터탭이 짧은 시간 내 중복 호출해도 기상청 API는 매시간만 갱신되므로 낭비 방지.
- **`apps/api/app/air_quality.py`** — 에어코리아 클라이언트.
  - `nearest_station(lat, lon)`: `getMsrstnList`(측정소 목록)를 한 번 받아 인메모리 캐시, 최근접 측정소명 계산.
  - `fetch_realtime_measurements(station_name) -> list[AirQualityRecord]`: `getMsrstnAcctoRltmMesureDnsty` 호출, 최근 ~24시간 시간별 레코드(`measured_at, khai_grade, khai_value, pm10_value, pm25_value`) 반환.
  - `classify_air_quality(khai_grade)`: `khaiGrade`가 이미 1~4라 직접 매핑.
  - 동일한 TTL 캐시 패턴, `AirQualityFetchError`.
- **`apps/api/app/environment.py`** — 오케스트레이션, 모바일 라우트와 persona-chat 컨텍스트 빌더가 공용으로 사용.
  - `CurrentEnvironment` dataclass: `weather_status, air_quality_status, temperature_c, humidity_pct, pm10_value, pm25_value, khai_value, observed_at`.
  - `get_current_environment(region)`: weather.py + air_quality.py 호출·조합.
  - `record_snapshot(db, user_id, location_name, current)`: `weather_log`에 insert — 사용자의 최신 row가 55분 이상 지났을 때만 (스케줄러 없이 문서의 "3시간마다" 취지를 앱 사용 패턴으로 근사).
  - `backfill_air_quality_history(db, user_id, location_name, station_name)`: 사용자의 **첫** 조회 시(기존 weather_log row 없음), 에어코리아가 한 번에 주는 ~24시간 데이터를 일괄 insert — 대기질 그래프는 첫날부터 바로 채워짐.

### 수정 파일
- **`apps/api/app/models.py`**: `docs/database-schema.sql`을 따라 `UserSetting`(`user_setting`), `WeatherLog`(`weather_log`) SQLAlchemy 모델 추가.
  - `UserSetting`은 이번 기능 범위만: `setting_id, user_id(FK app_user, unique, CASCADE), default_location, created_at, updated_at`. `home_background_item_id`(Item 모델 없음)·`push_enabled`/`care_alert_enabled`/`weather_alert_enabled`(알림 기능 범위, 이번 스코프 아님)는 제외.
  - `WeatherLog`는 문서 스펙 그대로. `plant_id`는 이번 기능에서 항상 NULL(날씨는 유저/위치 단위지 식물 단위 아님 — `Plant.location_name`은 실내 위치 enum이라 별개).
  - **둘 다 새 테이블이라 `Base.metadata.create_all()`(main.py 152줄)이 다음 서버 기동 시 자동 생성한다 — 기존 테이블에 컬럼 추가가 아니므로 수동 `ALTER TABLE` 불필요.**
- **`apps/api/app/config.py`**: `KMA_API_KEY`, `AIRKOREA_API_KEY` 추가.
- **`apps/api/.env.example`**: 위 두 키 추가 — 백엔드 쪽 첫 외부 API 키.
- **`apps/api/app/schemas.py`**: `RegionOption`, `CurrentEnvironmentResponse`, `WeatherHistoryPoint`, `AirQualityHistoryPoint`, `EnvironmentHistoryResponse`, `UserSettingRead`, `UserSettingUpdate` 추가 — 기존 `CareSummary`/`PersonaChatResponse` 스타일 그대로.
- **`apps/api/app/main.py`**:
  - `_persona_weather_air_quality(current_user, db) -> persona_chat.WeatherAirQuality | None` 추가 — `_persona_watering_schedule`(135-147줄)와 동일 패턴: `UserSetting` 조회 → `region_data.find_region` → `environment.get_current_environment` → `WeatherAirQuality`로 매핑. **외부 API 실패/네트워크 예외는 반드시 잡아서 `None` 반환** — persona-chat이 날씨 API 장애 때문에 죽으면 안 됨(prompt는 이미 `None`을 "등록되지 않음"으로 우아하게 처리, 167-168줄).
  - `persona_chat_reply`(628줄 부근)에서 `watering_schedule` 옆에 `weather_air_quality = _persona_weather_air_quality(...)` 계산 추가, 635줄의 `weather_air_quality=None` 하드코딩을 이 변수로 교체.
  - 새 라우트(기존 `Depends(get_current_user)`/`Depends(get_db)`/`HTTPException` 컨벤션 따름):
    - `GET /api/regions?q=` → `list[RegionOption]`
    - `GET /api/settings` / `PATCH /api/settings` → `UserSettingRead` (get-or-default / upsert, `default_location`은 `region_data.find_region`로 검증 후 저장)
    - `GET /api/environment/current` → `CurrentEnvironmentResponse`. `default_location` 미설정이면 400(모바일은 이걸 보고 지역 설정 화면으로 유도). 성공 시 `record_snapshot` + (첫 조회면) `backfill_air_quality_history` 호출. 외부 API 실패는 `HTTPException(502)`(643-644줄 기존 패턴과 동일).
    - `GET /api/environment/history?days=7` → `EnvironmentHistoryResponse`(weather_points, air_quality_points — 둘 다 `weather_log`에서 조회, 각각 non-null 필드 기준으로 필터).

## Mobile (`apps/mobile/`)

### API 클라이언트 — `src/api.ts`에 추가 (신규 `services/` 파일 아님)
`services/`(`plantnet.ts`, `nongsaro.ts`)는 서드파티에 **직접** 붙는 호출 전용(`docs/api-integration.md`의 "모든 API 호출은 services/에서만" 규칙은 서드파티 대상). 이 기능은 우리 백엔드를 거치므로, persona chat·plants와 같은 위치인 `src/api.ts`의 `request<T>()` 헬퍼를 그대로 사용: