"""S3 presigned URL 생성 — 비공개 버킷의 media_asset을 앱이 임시로 읽도록 서명 URL 발급.

자격증명은 boto3 기본 체인(환경변수 AWS_ACCESS_KEY_ID/SECRET, ~/.aws, IAM 역할)에서 로드된다.
버킷 소유 계정에서 s3:GetObject 권한이 있는 자격증명이어야 서명 URL이 실제로 열린다.
"""
from __future__ import annotations

from urllib.parse import urlparse

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


def bucket_from_url(url: str | None) -> str | None:
    """업로드 URL에서 버킷 이름 추출 — media_asset.bucket_name 에 남겨 둘 값.

    가상 호스팅 스타일(https://{bucket}.s3[.{region}].amazonaws.com/{key})만 알아본다.
    CDN 도메인이나 path-style URL 이면 None → 기본 버킷(S3_BUCKET)의 객체로 본다.
    """
    host = urlparse(url or "").hostname or ""
    if not host.endswith(".amazonaws.com"):
        return None
    head, sep, _ = host.partition(".s3.")
    if not sep:
        head, sep, _ = host.partition(".s3-")
    if not sep:
        # https://s3.{region}.amazonaws.com/{bucket}/{key} 는 경로에 버킷이 있어 여기서 못 읽는다
        return None
    return head or None


def presigned_get_url(object_key: str | None, bucket: str | None = None) -> str | None:
    """object_key에 대한 presigned GET URL.
    presign 비활성(S3_PRESIGN=false)/버킷 미설정/키 없음/서명 실패 시 None → 호출부가 file_url로 fallback.

    bucket 은 media_asset.bucket_name — 객체가 어느 버킷에 있는지다. 비어 있으면
    기본 버킷(S3_BUCKET)으로 본다. 자산마다 버킷이 다를 수 있어서 받는다:
    엉뚱한 버킷 이름으로 서명하면 URL 은 만들어지지만 열 때 403 이 난다."""
    target = bucket or settings.s3_bucket
    if not settings.s3_presign_enabled or not target or not object_key:
        return None
    try:
        return _s3().generate_presigned_url(
            "get_object",
            Params={"Bucket": target, "Key": object_key},
            ExpiresIn=settings.s3_presign_expire,
        )
    except (BotoCoreError, ClientError):
        return None