# 도메인 없는 테스트 HTTPS

기존 EC2 공인 IPv4에 Let's Encrypt 인증서를 발급하는 구성. 도메인·로드밸런서·추가 서버 구매 없이 사용한다. 도메인을 사용하는 Caddy 구성과는 선택 관계이며, 같은 서버의 80·443 포트에 두 웹서버를 동시에 실행하지 않는다.

## 비용과 권한

- IAM 권한 설정 자체는 추가 요금이 없다. 현재 학교 PC의 SQS 인증은 기관 담당자가 발급해야 한다. EC2 역할을 학교에 복사하지 않는다.
- Let's Encrypt 인증서는 무료다. 발급 시 약관 동의가 필요하다.
- EC2·RDS·S3·SQS·공인 IPv4·통신 사용료는 별도다. 학교 지원금이나 크레딧이 어디까지 적용되는지는 계정 담당자에게 확인한다.
- 이 구성은 고정 IP를 새로 구매하거나 연결하지 않는다. EC2 중지 후 시작 등으로 공인 IP가 바뀌면 인증서와 모바일 API 주소도 다시 설정해야 한다.
- 80·443은 외부에서 접근 가능해야 한다. 8000·5432·6333·학교 AI 포트는 인터넷에 개방하지 않는다.

## 구성 파일

| 파일 | 역할 |
|---|---|
| `nginx-acme.conf.template` | 인증서 발급 전 설정. HTTP 인증 확인 경로만 제공하고 API는 전달하지 않는다. |
| `nginx-api.conf.template` | 발급 후 설정. HTTPS로만 API를 전달하고 문서·이미지 실험실·로컬 파일 경로는 차단한다. |
| `leaflog-certbot-renew.service` | 인증서 갱신 작업 |
| `leaflog-certbot-renew.timer` | 4시간 간격으로 갱신 필요 여부 확인 |
| `reload-nginx.sh` | 갱신 후 설정 검증과 Nginx 재적용 |

템플릿의 `__PUBLIC_IP__`를 실제 공인 IPv4로 바꾼다. 실제 값을 채운 설정과 인증서 개인키는 저장소에 넣지 않는다. 인증서 이름은 `leaflog-api-ip`로 고정한다.

현재 테스트 서버의 설치 경로:

- Nginx 설정: `/etc/nginx/conf.d/leaflog.conf`
- Certbot: `/opt/leaflog-certbot/bin/certbot`
- 인증 확인 폴더: `/var/www/leaflog-acme`
- 인증서: `/etc/letsencrypt/live/leaflog-api-ip/`
- 갱신 후 실행 파일: `/usr/local/sbin/leaflog-reload-https`
- API: `leaflog-api-rehearsal`, `127.0.0.1:8000`

파일이 존재하는 것과 HTTPS 검증이 끝난 것은 별개다. 실제 적용 상태는 비공개 운영 기록을 확인한다. 인증서 발급 전에 갱신 타이머만 켜놓고 완료로 처리하지 않는다.

## 완료 기준

1. Certbot 5.4 이상에서 IP 인증서 시험 발급을 통과한다.
2. 운영 인증서를 발급하고 Nginx 설정을 검증한 뒤 재적용한다.
3. 외부에서 인증서 검증을 켠 채 `https://<공인 IP>/health`가 200인지 확인한다. `-k`로 인증서 검증을 끄지 않는다.
4. 비로그인 식물 목록 접근은 401, `/docs`·`/image-lab`·HTTP API 접근은 404인지 확인한다.
5. 아래 갱신 모의 실행과 타이머 상태를 확인한다.

```bash
sudo /opt/leaflog-certbot/bin/certbot renew --dry-run --run-deploy-hooks --no-random-sleep-on-renew
systemctl is-active leaflog-certbot-renew.timer
systemctl list-timers leaflog-certbot-renew.timer
sudo openssl x509 -in /etc/letsencrypt/live/leaflog-api-ip/fullchain.pem -noout -dates
```

IP 인증서 유효기간은 6일이다. 타이머의 실행 성공뿐 아니라 실제 만료일이 연장되는지 점검한다. 갱신 실패는 `journalctl -u leaflog-certbot-renew`로 확인하고, 만료 전에 해결한다. 현재 연락용 이메일은 등록하지 않으므로 이메일 경고가 온다고 가정하지 않는다.

HTTPS가 완료돼도 학교 SQS 인증·학교 연결·생성 설정 전환이 끝나기 전에는 새 캐릭터 생성이 가능하지 않다. 기존 학교 GPU 요청과 겹치지 않도록 전환 시간을 정한 뒤 실제 후보 3개 생성과 폰 테스트를 수행한다.

## 복구

HTTPS 설정을 적용하기 전 Nginx 설정을 백업한다. 문법 검증이나 접속 확인에 실패하면 백업을 복원하고 `nginx -t` 통과 후 `systemctl reload nginx`를 실행한다. 인증서 발급 전 설정으로 돌아가면 외부 API는 차단되고 내부 API는 유지된다. DB·이미지·학교 서비스는 되돌리지 않는다.

참고: [Let's Encrypt IP 인증서](https://letsencrypt.org/2026/03/11/shorter-certs-certbot.html), [IAM 요금](https://aws.amazon.com/iam/faqs/), [AWS 공인 IPv4 요금](https://aws.amazon.com/vpc/pricing/).
