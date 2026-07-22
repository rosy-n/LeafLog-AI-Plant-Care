"""S3 presigned URL 생성 — 비공개 버킷의 media_asset을 앱이 임시로 읽도록 서명 URL 발급.

자격증명은 boto3 기본 체인(환경변수 AWS_ACCESS_KEY_ID/SECRET, ~/.aws, IAM 역할)에서 로드된다.
버킷 소유 계정에서 s3:GetObject 권한이 있는 자격증명이어야 서명 URL이 실제로 열린다.
"""
from __future__ import annotations

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from .config import settings

_client = None


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