"""메일 발송 — 지금은 설정 화면의 "문의하기" 하나만 쓴다.

표준 라이브러리 smtplib 로 충분해서 의존성을 늘리지 않는다.
자격증명은 .env 의 SMTP_* 로만 받는다 (코드에 하드코딩 금지).
"""

import smtplib
from email.message import EmailMessage

from .config import settings


class MailNotConfigured(RuntimeError):
    """SMTP_* / SUPPORT_EMAIL 이 비어 있어 보낼 수 없는 상태."""


class MailSendFailed(RuntimeError):
    """서버에 연결했지만 발송에 실패한 경우."""


def _sender() -> str:
    # 보내는 주소를 따로 지정하지 않으면 로그인 계정을 그대로 쓴다 —
    # 대부분의 제공자가 계정과 다른 From 을 거부한다.
    return settings.smtp_from or settings.smtp_user


def is_configured() -> bool:
    return bool(settings.smtp_host and _sender() and settings.support_email)


def send_mail(subject: str, body: str, to: str, reply_to: str | None = None) -> None:
    """메일 한 통. 실패하면 예외를 던진다 — 호출부가 사용자에게 알려야 한다."""
    if not is_configured():
        raise MailNotConfigured(
            "SMTP_HOST / SMTP_USER / SUPPORT_EMAIL 이 설정되지 않았습니다."
        )

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = _sender()
    message["To"] = to
    if reply_to:
        # 답장하면 문의한 사용자에게 바로 가도록
        message["Reply-To"] = reply_to
    message.set_content(body)

    try:
        if settings.smtp_use_ssl:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_password:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_password:
                    smtp.login(settings.smtp_user, settings.smtp_password)
                smtp.send_message(message)
    except (smtplib.SMTPException, OSError) as exc:
        raise MailSendFailed(str(exc)) from exc
