"""S3 presigned URL 생성 — 비공개 버킷의 media_asset을 앱이 임시로 읽도록 서명 URL 발급.

자격증명은 boto3 기본 체인(환경변수 AWS_ACCESS_KEY_ID/SECRET, ~/.aws, IAM 역할)에서 로드된다.
버킷 소유 계정에서 s3:GetObject 권한이 있는 자격증명이어야 서명 URL이 실제로 열린다.

S3_BUCKET이 없는 개발 환경(학교 랩 PC 등)을 위해 로컬 디스크 폴백(save_local_file)도
함께 제공한다 — main.py가 upload_bytes() 실패 시 이걸로 넘어간다.
"""
from __future__ import annotations

from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from .config import settings

_client = None

# app/static/uploads/ — main.py가 이 경로를 "/static/uploads"로 그대로 서빙한다.
# uploads/는 루트 .gitignore에 이미 등록돼 있어 커밋되지 않는다.
LOCAL_UPLOAD_DIR = Path(__file__).resolve().parent / "static" / "uploads"


def _s3():
    global _client
    if _client is None:
        # ap-northeast-2(서울) 등은 SigV4 필수 + 지역 엔드포인트 명시
        # (글로벌 엔드포인트로 서명하면 리다이렉트 시 서명 불일치 403 위험)
        _client = boto3.client(
            "s3",
            region_name=settings.s3_region,
            endpoint_url=f"https://s3.{settings.s3_region}.amazonaws.com",
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
    return _client


def presigned_get_url(object_key: str | None) -> str | None:
    """object_key에 대한 presigned GET URL.
    presign 비활성(S3_PRESIGN=false)/버킷 미설정/키 없음/서명 실패 시 None → 호출부가 file_url로 fallback."""
    if not settings.s3_presign_enabled or not settings.s3_bucket or not object_key:
        return None
    try:
        return _s3().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": object_key},
            ExpiresIn=settings.s3_presign_expire,
        )
    except (BotoCoreError, ClientError):
        return None


def upload_bytes(data: bytes, object_key: str, content_type: str) -> str | None:
    """object_key로 바이트를 S3에 직접 올린다 (진단 사진처럼 클라이언트가 아니라
    백엔드가 이미 들고 있는 바이트를 저장해야 하는 경우 전용 — 다른 업로드는 여전히
    클라이언트가 S3에 먼저 올리고 URL만 넘기는 방식을 쓴다).

    버킷 미설정/업로드 실패 시 None → 호출부는 media_asset을 만들지 않고 조용히 건너뛴다
    (사진 저장 실패가 진단 응답 자체를 막으면 안 된다).
    """
    if not settings.s3_bucket:
        return None
    try:
        _s3().put_object(
            Bucket=settings.s3_bucket,
            Key=object_key,
            Body=data,
            ContentType=content_type,
        )
    except (BotoCoreError, ClientError):
        return None
    return f"https://{settings.s3_bucket}.s3.{settings.s3_region}.amazonaws.com/{object_key}"


def save_local_file(data: bytes, object_key: str) -> str | None:
    """S3_BUCKET 미설정 시 upload_bytes() 대신 쓰는 로컬 디스크 폴백.

    object_key(예: "diagnosis/5/abc123.jpg")를 LOCAL_UPLOAD_DIR 아래 그대로의
    구조로 저장한다. 절대 URL이 아니라 "/static/uploads/{object_key}" 형태의
    경로만 반환한다 — 호출부(main.py)가 요청이 들어온 호스트(request.base_url)와
    합쳐야 휴대폰에서도 실제로 접근 가능한 URL이 된다(로컬호스트를 하드코딩하면
    같은 Wi-Fi의 휴대폰에서는 못 연다).
    """
    try:
        target = LOCAL_UPLOAD_DIR / object_key
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    except OSError:
        return None
    return f"/static/uploads/{object_key}"
