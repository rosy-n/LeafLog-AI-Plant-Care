"""테스트용 — 특정 개체(plant)의 캐릭터 이미지(CHARACTER_IMAGE) media_asset을 등록.

S3에 이미지를 수동 업로드한 뒤, 그 public URL을 이 스크립트로 개체에 연결하면
앱 조회 API가 해당 URL을 돌려주고 앱이 원격 이미지로 렌더한다.

실행:
  cd apps/api
  ./.venv/Scripts/python.exe scripts/set-character.py <plant_id> <s3_url> [checksum]

예:
  ./.venv/Scripts/python.exe scripts/set-character.py 9 https://my-bucket.s3.ap-northeast-2.amazonaws.com/plant/9/character/abc123.png
"""
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import MediaAsset, Plant
from app.storage import bucket_from_url


def main() -> None:
    if len(sys.argv) < 3:
        print("사용법: set-character.py <plant_id> <s3_url> [checksum]")
        raise SystemExit(1)

    plant_id = int(sys.argv[1])
    url = sys.argv[2]
    checksum = sys.argv[3] if len(sys.argv) > 3 else ""

    db = SessionLocal()
    try:
        plant = db.get(Plant, plant_id)
        if plant is None:
            print(f"plant_id={plant_id} 없음")
            raise SystemExit(1)

        # object_key는 업로드된 실제 S3 URL 경로에서 추출 (백엔드 create_plant와 동일 규칙)
        object_key = unquote(urlparse(url).path).lstrip("/")

        asset = MediaAsset(
            user_id=plant.user_id,
            plant_id=plant_id,
            object_key=object_key,
            file_url=url,
            # 자산마다 버킷이 다를 수 있어 함께 남긴다 (S3_PRESIGN=true 일 때 서명 대상)
            bucket_name=bucket_from_url(url),
            asset_type="CHARACTER_IMAGE",
            checksum=checksum or None,
        )
        db.add(asset)
        db.commit()
        db.refresh(asset)
        print("등록 완료:")
        print(f"  asset_id   = {asset.asset_id}")
        print(f"  plant_id   = {plant_id} (nickname={plant.nickname!r})")
        print(f"  object_key = {object_key}")
        print(f"  file_url   = {url}")
        print("앱에서 정원을 새로고침하면 이 개체가 위 URL 이미지로 표시됩니다.")
    finally:
        db.close()


if __name__ == "__main__":
    main()