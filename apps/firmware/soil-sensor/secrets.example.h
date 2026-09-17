// 이 파일을 secrets.h 로 복사해서 값을 채운다. secrets.h 는 커밋하지 않는다.
//
//   cp secrets.example.h secrets.h
//
// DEVICE_TOKEN 은 센서를 등록할 때 딱 한 번 응답으로 나온다.
//   POST /api/plants/{plant_id}/soil-sensor
//   { "device_key": "44:1B:F6:FF:07:60", "device_label": "거실 몬스테라" }
// 서버에는 bcrypt 해시만 남아 다시 볼 수 없다. 잃어버리면 같은 요청을 다시 보내
// 새로 발급받으면 된다 (기존 토큰은 그때 무효가 된다).

#pragma once

#define WIFI_SSID     "여기에 WiFi 이름"
#define WIFI_PASSWORD "여기에 WiFi 비밀번호"

#define DEVICE_TOKEN  "여기에 등록 응답의 device_token"
