/*
 * LeafLog 토양 수분 센서
 *
 * 하드웨어: ESP32-S3-DevKitC-1 (N16R8) + DFRobot SEN0308 (방수 정전용량식)
 * 배선:     VCC -> 3V3,  GND -> GND,  Signal -> GPIO4 (ADC1_CH3)
 *
 * 왜 GPIO4 인가
 *   ADC2(GPIO11~20)는 WiFi 를 켜면 쓸 수 없어 ADC1(GPIO1~10)에서 골라야 한다.
 *   그중 GPIO3 은 스트래핑 핀, GPIO19/20 은 네이티브 USB 라 제외하고,
 *   N16R8 은 옥타 PSRAM 이 GPIO33~37 을 점유한다.
 *
 * 이 펌웨어는 raw 전압(mV)만 보낸다. 수분 %는 서버(app/soil.py)가 환산한다 —
 * 보정값은 흙 종류와 꽂은 깊이에 따라 다시 잡게 되는데, 기기가 %를 계산해
 * 보내면 보정을 바꿀 때마다 펌웨어를 다시 구워야 하고 과거 데이터도 못 살린다.
 *
 * 보정은 서버에 넣는다:
 *   PATCH /api/soil-sensors/{sensor_id}/calibration  { "dry_mv": ..., "wet_mv": ... }
 */

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <esp_mac.h>
#include <time.h>

#include "secrets.h"

// ---------------------------------------------------------------------------
// 설정
// ---------------------------------------------------------------------------

static const int SOIL_PIN = 4;         // ADC1_CH3
static const int SAMPLE_COUNT = 16;    // 한 번 잴 때 평균낼 횟수 (ADC 노이즈가 크다)
static const int SAMPLE_GAP_MS = 10;

static const char *API_HOST = "3.35.252.177";
static const char *API_PATH = "/api/soil-readings";

// 서버가 응답으로 알려주는 값으로 갱신된다. 첫 전송 전까지의 기본값.
static uint32_t reportIntervalSec = 600;

// 시리얼 출력용 어림 보정값. 판정의 기준이 아니다 — 서버의 센서별 보정값이 단일
// 출처이고, 이건 눈으로 동작을 확인할 때만 쓴다 (app/soil.py 의 기본값과 같다).
static const int DISPLAY_DRY_MV = 2200;
static const int DISPLAY_WET_MV = 1280;

/*
 * TLS 검증 스위치.
 *
 * 1 = 아래 루트 인증서로 서버를 검증한다 (권장).
 * 0 = 검증 없이 암호화만 한다.
 *
 * 현재 서버 인증서는 도메인이 아니라 IP(3.35.252.177)에 발급된 것이라,
 * ESP32 의 mbedtls 가 IP SAN 을 호스트명 매칭에 쓰지 못해 검증이 실패할 수 있다.
 * 핸드셰이크가 -0x2700 류 오류로 막히면 0 으로 바꾼다. 그때는 같은 WiFi 에 있는
 * 공격자가 DEVICE_TOKEN 을 가로챌 수 있다 — 그 토큰으로 할 수 있는 일은 이 센서
 * 한 대의 측정값을 위조해 올리는 것뿐이지만, 도메인을 붙이면 1 로 되돌릴 수 있다.
 */
#define VERIFY_TLS 1

// ISRG Root X2 — Let's Encrypt 의 ECDSA 루트. 서버 체인이
// leaf <- YE2 <- Root YE <- ISRG Root X2 라서 이것이 신뢰 앵커다.
// 서버 인증서는 7일짜리 단기 인증서로 4시간마다 자동 갱신되지만,
// 루트는 2040년까지 유효하므로 이 값은 그대로 두면 된다.
static const char ISRG_ROOT_X2[] PROGMEM = R"CERT(-----BEGIN CERTIFICATE-----
MIICGzCCAaGgAwIBAgIQQdKd0XLq7qeAwSxs6S+HUjAKBggqhkjOPQQDAzBPMQsw
CQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFyY2gg
R3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMjAeFw0yMDA5MDQwMDAwMDBaFw00
MDA5MTcxNjAwMDBaME8xCzAJBgNVBAYTAlVTMSkwJwYDVQQKEyBJbnRlcm5ldCBT
ZWN1cml0eSBSZXNlYXJjaCBHcm91cDEVMBMGA1UEAxMMSVNSRyBSb290IFgyMHYw
EAYHKoZIzj0CAQYFK4EEACIDYgAEzZvVn4CDCuwJSvMWSj5cz3es3mcFDR0HttwW
+1qLFNvicWDEukWVEYmO6gbf9yoWHKS5xcUy4APgHoIYOIvXRdgKam7mAHf7AlF9
ItgKbppbd9/w+kHsOdx1ymgHDB/qo0IwQDAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0T
AQH/BAUwAwEB/zAdBgNVHQ4EFgQUfEKWrt5LSDv6kviejM9ti6lyN5UwCgYIKoZI
zj0EAwMDaAAwZQIwe3lORlCEwkSHRhtFcP9Ymd70/aTSVaYgLXTWNLxBo1BfASdW
tL4ndQavEi51mI38AjEAi/V3bNTIZargCyzuFJ0nN6T5U6VR5CmD1/iQMVtCnwr1
/q4AaOeMSQ+2b1tbFfLn
-----END CERTIFICATE-----
)CERT";

// ---------------------------------------------------------------------------
// 오프라인 버퍼
//
// WiFi 가 끊겨도 흙은 계속 마르므로 측정은 멈추지 않고 링버퍼에 쌓아둔다.
// 상한은 API 의 배치 상한과 같은 288건(10분 주기로 이틀치). 그보다 오래
// 끊기면 가장 오래된 것부터 버린다 — 최근 값이 물주기 판단에 더 중요하다.
//
// 전원이 나가면 버퍼도 사라진다. USB 로 상시 급전하는 전제라 NVS 에 쓰지
// 않는다 (10분마다 플래시에 쓰면 수명이 빨리 닳는다).
// ---------------------------------------------------------------------------

struct Reading {
  time_t measured_at;  // 0 = 시각을 못 믿는 상태. 서버가 수신 시각으로 채운다.
  int16_t raw_mv;
};

static const size_t BUFFER_SIZE = 288;
static const size_t BATCH_MAX = 100;  // 한 요청에 담을 최대 건수 (메모리 여유용)

static Reading buffer[BUFFER_SIZE];
static size_t bufferHead = 0;   // 다음에 쓸 자리
static size_t bufferCount = 0;  // 아직 못 보낸 건수

static char deviceKey[18];  // "44:1B:F6:FF:07:60"
static bool timeSynced = false;
static bool authRejected = false;  // 401 을 받으면 무한 재시도하지 않는다

// ---------------------------------------------------------------------------

static void initDeviceKey() {
  uint8_t mac[6];
  // eFuse 의 기본 MAC. 펌웨어를 다시 구워도 바뀌지 않아서 soil_sensor.device_key
  // 로 그대로 쓴다 — 기기를 재등록할 필요가 없다.
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  snprintf(deviceKey, sizeof(deviceKey), "%02X:%02X:%02X:%02X:%02X:%02X",
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
}

static int readSoilMv() {
  long sum = 0;
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    // analogRead 가 아니라 이것을 쓴다. ESP32-S3 의 ADC 는 개체 편차가 커서
    // 칩에 구워진 eFuse 보정값을 적용해야 기기끼리 값이 맞는다.
    sum += analogReadMilliVolts(SOIL_PIN);
    delay(SAMPLE_GAP_MS);
  }
  return (int)(sum / SAMPLE_COUNT);
}

static int displayPercent(int mv) {
  long pct = (long)(mv - DISPLAY_DRY_MV) * 100 / (DISPLAY_WET_MV - DISPLAY_DRY_MV);
  return pct < 0 ? 0 : (pct > 100 ? 100 : (int)pct);
}

static void bufferPush(time_t ts, int raw_mv) {
  buffer[bufferHead] = {ts, (int16_t)raw_mv};
  bufferHead = (bufferHead + 1) % BUFFER_SIZE;
  if (bufferCount < BUFFER_SIZE) {
    bufferCount++;
  } else {
    Serial.println("[buf] 가득 참 — 가장 오래된 값을 버린다");
  }
}

static size_t bufferOldestIndex() {
  return (bufferHead + BUFFER_SIZE - bufferCount) % BUFFER_SIZE;
}

static void bufferDropOldest(size_t count) {
  bufferCount -= (count > bufferCount) ? bufferCount : count;
}

// ---------------------------------------------------------------------------

static bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;

  Serial.print("[wifi] 연결 중");
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[wifi] 실패 — 다음 주기에 다시 시도한다");
    return false;
  }
  Serial.print("[wifi] 연결됨 ");
  Serial.println(WiFi.localIP());
  return true;
}

static bool syncTime() {
  // UTC 로 맞춘다. 한국 시간 변환은 서버(app/korea_time.py)가 한다.
  configTime(0, 0, "pool.ntp.org", "time.google.com");

  unsigned long started = millis();
  while (millis() - started < 15000) {
    time_t now = time(nullptr);
    if (now > 1735689600) {  // 2025-01-01 이후면 맞춰진 것으로 본다
      struct tm t;
      gmtime_r(&now, &t);
      char buf[32];
      strftime(buf, sizeof(buf), "%Y-%m-%d %H:%M:%S UTC", &t);
      Serial.print("[ntp] ");
      Serial.println(buf);
      return true;
    }
    delay(500);
  }
  // 실패해도 측정은 계속한다. measured_at 을 비워 보내면 서버가 수신 시각으로
  // 채우고, 묶음이면 전송 주기만큼 거슬러 올라가며 서로 다른 시각을 준다.
  Serial.println("[ntp] 실패 — 측정 시각은 서버가 채운다");
  return false;
}

static String isoUtc(time_t ts) {
  struct tm t;
  gmtime_r(&ts, &t);
  char buf[32];
  // 'Z' 대신 +00:00 로 적는다. 서버의 datetime.fromisoformat 이 확실히 받는다.
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%S+00:00", &t);
  return String(buf);
}

static String buildPayload(size_t count) {
  String body;
  body.reserve(count * 64 + 32);
  body = "{\"readings\":[";

  size_t index = bufferOldestIndex();
  for (size_t i = 0; i < count; i++) {
    const Reading &r = buffer[(index + i) % BUFFER_SIZE];
    if (i) body += ",";
    body += "{\"raw_mv\":";
    body += r.raw_mv;
    if (r.measured_at > 0) {
      body += ",\"measured_at\":\"";
      body += isoUtc(r.measured_at);
      body += "\"";
    }
    body += "}";
  }
  body += "]}";
  return body;
}

// 응답에서 report_interval_sec 을 꺼낸다. 서버가 전송 주기를 조절할 수 있게
// 하려는 것이라, 못 찾으면 기존 값을 유지하고 넘어간다.
static void applyReportInterval(const String &body) {
  const char *key = "\"report_interval_sec\":";
  int at = body.indexOf(key);
  if (at < 0) return;
  long value = body.substring(at + strlen(key)).toInt();
  if (value >= 60 && (uint32_t)value != reportIntervalSec) {
    Serial.printf("[api] 전송 주기 %u -> %ld초\n", reportIntervalSec, value);
    reportIntervalSec = (uint32_t)value;
  }
}

static bool sendBatch(size_t count) {
  WiFiClientSecure tls;
#if VERIFY_TLS
  tls.setCACert(ISRG_ROOT_X2);
#else
  tls.setInsecure();
#endif

  HTTPClient http;
  String url = String("https://") + API_HOST + API_PATH;
  if (!http.begin(tls, url)) {
    Serial.println("[api] begin 실패");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Key", deviceKey);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.setTimeout(15000);

  int status = http.POST(buildPayload(count));
  String body = (status > 0) ? http.getString() : String();
  http.end();

  if (status == 200) {
    applyReportInterval(body);
    Serial.printf("[api] %u건 전송 성공 %s\n", (unsigned)count, body.c_str());
    return true;
  }

  if (status == 401) {
    // 토큰이 틀렸거나 기기가 지워졌다. 계속 두드려도 같은 답이라 멈춘다.
    authRejected = true;
    Serial.println("[api] 401 — DEVICE_TOKEN 을 다시 발급받아야 한다");
  } else if (status > 0) {
    Serial.printf("[api] HTTP %d %s\n", status, body.c_str());
  } else {
    Serial.printf("[api] 연결 실패 (%d) %s\n", status, HTTPClient::errorToString(status).c_str());
  }
  return false;
}

// 버퍼가 빌 때까지 보낸다. 한 번이라도 실패하면 남은 건 다음 주기로 미룬다.
static void flushBuffer() {
  if (bufferCount == 0 || authRejected) return;
  if (!ensureWifi()) return;
  if (!timeSynced) timeSynced = syncTime();

  while (bufferCount > 0 && !authRejected) {
    size_t count = (bufferCount < BATCH_MAX) ? bufferCount : BATCH_MAX;
    if (!sendBatch(count)) {
      Serial.printf("[buf] %u건 보관 — 다음 주기에 다시 시도\n", (unsigned)bufferCount);
      return;
    }
    bufferDropOldest(count);
  }
}

// ---------------------------------------------------------------------------

void setup() {
  Serial.begin(115200);
  delay(1000);

  analogReadResolution(12);
  analogSetPinAttenuation(SOIL_PIN, ADC_11db);  // 0~3.1V

  initDeviceKey();
  Serial.println();
  Serial.printf("LeafLog 토양 수분 센서\n  device_key: %s\n", deviceKey);

  if (ensureWifi()) timeSynced = syncTime();
}

void loop() {
  static unsigned long lastSample = 0;
  unsigned long now = millis();

  // 첫 바퀴에 바로 한 번 재고, 그다음부터 주기를 지킨다.
  if (lastSample != 0 && now - lastSample < reportIntervalSec * 1000UL) {
    delay(1000);
    return;
  }
  lastSample = now;

  int mv = readSoilMv();
  time_t ts = timeSynced ? time(nullptr) : 0;
  bufferPush(ts, mv);

  Serial.printf("[read] %dmV  (참고 %d%%)  대기 %u건\n",
                mv, displayPercent(mv), (unsigned)bufferCount);

  flushBuffer();
}
