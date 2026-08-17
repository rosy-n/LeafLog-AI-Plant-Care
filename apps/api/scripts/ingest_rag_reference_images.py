"""Qdrant(leaflog-diagnosis)에 이미 인덱싱된 RAG 레퍼런스 이미지 200장을 media_asset에 적재.

왜 필요한가: search_similar_cases()가 돌려주는 유사 사례에는 원본 이미지 파일이 어디에도
연결돼 있지 않다 — ai/diagnosis/images/(심볼릭 링크, 리포 밖)에만 존재하고 프로덕션 API
서버가 읽을 수 있는 곳(S3/로컬 정적 서빙)엔 한 번도 올라간 적이 없다. 이 스크립트가 그 간극을
메운다: Qdrant 포인트(id=image_id, payload.file_name)를 훑어서 원본을 찾고, JPEG로 정규화해
업로드한 뒤 media_asset(asset_type=RAG_REFERENCE_IMAGE)으로 등록한다. 이후 main.py의
_rag_reference_image_urls()가 image_id → object_key(f"rag-reference/{image_id}.jpg")로
정확히 한 행을 찾아 온다.

멱등성: 이미 등록된 object_key는 다시 올리지 않고 건너뛴다 — 몇 번을 실행해도 안전하다.

실행 (반드시 --dry-run으로 먼저 확인할 것 — 실제 DB에 쓰는 스크립트다):
  cd apps/api
  python scripts/ingest_rag_reference_images.py --dry-run
  python scripts/ingest_rag_reference_images.py --base-url http://<api-호스트>:8000

S3_BUCKET이 .env에 설정돼 있으면 S3로 올라가고, 없으면(학교 랩 PC 등) 로컬 디스크
(app/static/uploads/rag-reference/)로 폴백한다 — main.py의 진단 사진 업로드와 동일한 로직.
로컬 폴백일 때는 --base-url로 실제 접근 가능한 API 호스트를 넘겨야 한다(기본값 없음).
"""
from __future__ import annotations

import argparse
import hashlib
import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image  # noqa: E402
from qdrant_client import QdrantClient  # noqa: E402
from sqlalchemy import select  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models import MediaAsset  # noqa: E402
from app.storage import save_local_file, upload_bytes  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_IMAGES_DIR = REPO_ROOT / "ai" / "diagnosis" / "images"
JPEG_QUALITY = 88


def _object_key(image_id: int) -> str:
    return f"rag-reference/{image_id}.jpg"


def _to_jpeg_bytes(path: Path) -> tuple[bytes, int, int]:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        width, height = rgb.size
        buffer = io.BytesIO()
        rgb.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        return buffer.getvalue(), width, height


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--collection", default=settings.qdrant_collection, help="Qdrant 컬렉션명")
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR, help="원본 이미지 디렉터리")
    parser.add_argument(
        "--base-url",
        default=None,
        help="S3 미설정 시(로컬 폴백) 앱이 접근할 API 호스트, 예: http://100.70.205.63:8000 "
        "(S3_BUCKET 설정돼 있으면 필요 없음)",
    )
    parser.add_argument("--dry-run", action="store_true", help="실제로 업로드/DB 반영하지 않고 계획만 출력")
    args = parser.parse_args()

    if not settings.s3_bucket and not args.base_url and not args.dry_run:
        parser.error("S3_BUCKET이 없으면 --base-url이 필요합니다 (로컬 저장 파일에 접근할 호스트).")

    client = QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None)
    db = SessionLocal()

    try:
        existing_keys = {
            row.object_key
            for row in db.execute(
                select(MediaAsset.object_key).where(MediaAsset.asset_type == "RAG_REFERENCE_IMAGE")
            )
        }

        uploaded = skipped = missing_file = failed = 0
        offset = None
        while True:
            points, offset = client.scroll(
                collection_name=args.collection, limit=64, offset=offset, with_payload=True
            )
            if not points:
                break

            for point in points:
                image_id = int(point.id)
                object_key = _object_key(image_id)

                if object_key in existing_keys:
                    skipped += 1
                    continue

                file_name = (point.payload or {}).get("file_name")
                if not file_name:
                    print(f"[건너뜀] image_id={image_id}: payload에 file_name 없음")
                    missing_file += 1
                    continue

                source_path = args.images_dir / file_name
                if not source_path.exists():
                    print(f"[건너뜀] image_id={image_id}: 원본 파일 없음 ({source_path})")
                    missing_file += 1
                    continue

                if args.dry_run:
                    print(f"[dry-run] image_id={image_id} file_name={file_name} -> {object_key}")
                    uploaded += 1
                    continue

                jpeg_bytes, width, height = _to_jpeg_bytes(source_path)

                file_url = upload_bytes(jpeg_bytes, object_key, "image/jpeg")
                bucket_name = settings.s3_bucket or None
                if file_url is None:
                    local_path = save_local_file(jpeg_bytes, object_key)
                    if local_path is not None:
                        file_url = args.base_url.rstrip("/") + local_path
                        bucket_name = None

                if file_url is None:
                    print(f"[실패] image_id={image_id}: 업로드 실패(S3/로컬 모두)")
                    failed += 1
                    continue

                db.add(
                    MediaAsset(
                        user_id=None,
                        plant_id=None,
                        bucket_name=bucket_name,
                        object_key=object_key,
                        file_url=file_url,
                        asset_type="RAG_REFERENCE_IMAGE",
                        mime_type="image/jpeg",
                        file_size=len(jpeg_bytes),
                        width=width,
                        height=height,
                        checksum=hashlib.sha256(jpeg_bytes).hexdigest(),
                    )
                )
                existing_keys.add(object_key)
                uploaded += 1

            if offset is None:
                break

        if not args.dry_run:
            db.commit()

        print(
            f"\n완료: 업로드 {uploaded}건, 이미 있음 {skipped}건, "
            f"원본 없음 {missing_file}건, 실패 {failed}건"
            + (" (dry-run — DB에는 반영 안 됨)" if args.dry_run else "")
        )
    finally:
        db.close()


if __name__ == "__main__":
    main()
