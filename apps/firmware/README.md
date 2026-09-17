# 펌웨어

화분에 꽂아두는 센서 기기 코드. 앱·백엔드와 달리 기기에 직접 구워 올린다.

```
apps/firmware/
└── soil-sensor/          토양 수분 센서 (ESP32-S3 + DFRobot SEN0308)
    ├── soil-sensor.ino
    ├── secrets.example.h  ← 복사해서 secrets.h 를 만든다 (secrets.h 는 커밋 안 함)
    └── README.md
```

## soil-sensor

10분에 한 번 흙의 전압을 재서 `POST /api/soil-readings` 로 올린다.
수분 %는 기기가 계산하지 않는다 — 보정값이 화분마다 다르고 계속 바뀌기 때문에
raw 전압만 보내고 환산은 서버(`apps/api/app/soil.py`)가 한다.

### 배선

| SEN0308 | 선 색 | ESP32-S3 DevKitC-1 |
|---|---|---|
| VCC | 빨강 | `3V3` |
| GND | 검정 | `GND` |
| Signal | 파랑 | `GPIO4` (ADC1_CH3) |

ADC2(GPIO11~20)는 WiFi 를 켜면 쓸 수 없고, GPIO3(스트래핑) · GPIO19/20(USB) ·
GPIO33~37(N16R8 의 옥타 PSRAM)도 피해야 해서 ADC1 의 GPIO4 를 쓴다.

### Arduino IDE 설정 (N16R8)

- Board: **ESP32S3 Dev Module**
- Flash Size: **16MB (128Mb)**
- PSRAM: **OPI PSRAM** ← 안 맞추면 부팅이 이상해진다
- USB CDC On Boot: `UART` 포트로 구우면 Disabled, `USB` 포트면 Enabled

보드에 USB-C 가 두 개다. 처음에는 `UART` 라고 적힌 쪽이 말썽이 적다.

### 등록 순서

1. 기기를 한 번 구워 시리얼에 찍히는 `device_key`(eFuse MAC)를 받아둔다.
2. 앱 계정으로 센서를 등록하고 `device_token` 을 받는다. **응답에 한 번만 나온다.**

   ```bash
   TOKEN=$(curl -s -X POST https://<API>/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"...","password":"..."}' | python -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

   curl -s -X POST https://<API>/api/plants/<화분id>/soil-sensor \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"device_key":"44:1B:F6:FF:07:60","device_label":"거실 몬스테라"}'
   ```

3. `secrets.example.h` 를 `secrets.h` 로 복사해 WiFi 와 `device_token` 을 채우고 다시 굽는다.
4. 보정값을 서버에 넣는다. 마른 흙 / 물 준 직후 흙에서 잰 mV 다.

   ```bash
   curl -s -X PATCH https://<API>/api/soil-sensors/<sensor_id>/calibration \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"dry_mv":2060,"wet_mv":1320}'
   ```

보정값은 같은 센서·같은 화분이어도 잴 때마다 흔들린다(실측 2145→2060, 1370→1320).
값이 이상해지면 다시 재서 이 요청만 다시 보내면 된다 — 과거 기록의 %는 측정 당시
스냅샷으로 계산되므로 바뀌지 않는다.

### 알아둘 것

- **오프라인 버퍼**: WiFi 가 끊겨도 측정은 계속하고 최대 288건(이틀치)을 들고 있다가
  복구되면 몰아 보낸다. 전원이 나가면 버퍼는 사라진다 — 상시 급전 전제다.
- **NTP 실패**: 시각을 못 맞추면 `measured_at` 을 비워 보내고 서버가 수신 시각으로
  채운다. 측정값을 버리지 않는다.
- **TLS**: 서버 인증서가 도메인이 아니라 IP 에 발급된 것이라, ESP32 의 mbedtls 가
  IP SAN 을 호스트명 매칭에 쓰지 못해 검증이 실패할 수 있다. 그럴 때만
  `.ino` 의 `VERIFY_TLS` 를 `0` 으로 내린다 (암호화는 유지, 서버 신원 확인만 생략).
  도메인을 붙이면 `1` 로 되돌린다.
