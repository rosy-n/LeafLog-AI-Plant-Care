"""꾸미기 아이템 이미지(ITEM_IMAGE) media_asset 을 등록하고 item 에 연결.

S3 에 이미지를 업로드한 뒤 그 URL을 이 스크립트로 아이템에 연결하면
GET /api/items 가 그 URL을 돌려주고 앱이 번들 이미지 대신 원격 이미지로 그린다.
연결하지 않은 아이템은 앱이 item_key 로 번들 이미지를 쓴다(그대로 동작).

slot 은 아이템 하나에 있는 이미지 2종을 가리킨다:
  card    목록 카드 이미지 — 액세서리 아이콘 / 배경 미리보기   → item.asset_id
  sprite  그 액세서리를 착용한 캐릭터 이미지 (배경은 없음)     → item.sprite_asset_id

실행:
  cd apps/api
  ./.venv/Scripts/python.exe scripts/set-item-image.py <item_key> <card|sprite> <s3_url> [checksum]

예:
  ./.venv/Scripts/python.exe scripts/set-item-image.py level1 card "https://leaflog-dev-054422645032-ap-northeast-2-an.s3.ap-northeast-2.amazonaws.com/leaflog/item-images/level1/card.png"

URL 은 만료되지 않는 것을 넣는다. 아이템 이미지는 사용자 데이터가 아니라 앱 리소스라
leaflog/item-images/* 프리픽스만 공개 읽기로 열어 두고(정책: s3-item-images-public-policy.json)
쿼리스트링 없는 위 형태의 URL 을 쓴다. 사용자 사진/캐릭터(leaflog/user-images/*)는 비공개 그대로다.

콘솔에서 만든 presigned URL(?X-Amz-... 붙은 것)을 넣어도 동작하지만 최대 12시간이면
만료되고, 그 뒤에는 앱이 번들 이미지로 되돌아간다 — 임시 확인용으로만 쓸 것.
"""
import sys
from pathlib import Path
from urllib.parse import unquote, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal
from app.models import Item, MediaAsset
from app.storage import bucket_from_url

SLOTS = {"card": "asset_id", "sprite": "sprite_asset_id"}


def main() -> None:
    if len(sys.argv) < 4 or sys.argv[2] not in SLOTS:
        print("사용법: set-item-image.py <item_key> <card|sprite> <s3_url> [checksum]")
        raise SystemExit(1)

    item_key, slot, url = sys.argv[1], sys.argv[2], sys.argv[3]
    checksum = sys.argv[4] if len(sys.argv) > 4 else ""
    column = SLOTS[slot]

    db = SessionLocal()
    try:
        item = db.query(Item).filter_by(item_key=item_key).one_or_none()
        if item is None:
            keys = [row.item_key for row in db.query(Item).order_by(Item.item_id)]
            print(f"item_key={item_key!r} 없음. 등록된 키: {keys}")
            raise SystemExit(1)
        if slot == "sprite" and item.item_type != "ACCESSORY":
            print(f"{item_key} 는 {item.item_type} 이라 sprite 가 없다 (card 만 등록)")
            raise SystemExit(1)

        # object_key 는 실제 S3 URL 경로에서 추출 (백엔드 _object_key_from_url 과 같은 규칙)
        object_key = unquote(urlparse(url).path).lstrip("/")
        # 버킷을 함께 남긴다 — 나중에 S3_PRESIGN=true 로 켤 때 자산마다 맞는 버킷으로 서명해야 한다
        bucket_name = bucket_from_url(url)

        # media_asset.object_key 는 UNIQUE — 같은 객체를 다시 올리면 URL 만 갱신한다
        asset = db.query(MediaAsset).filter_by(object_key=object_key).one_or_none()
        if asset is None:
            # 아이템 이미지는 특정 사용자/개체 것이 아니라 공용이라 user_id/plant_id 는 비운다
            asset = MediaAsset(
                object_key=object_key,
                file_url=url,
                bucket_name=bucket_name,
                asset_type="ITEM_IMAGE",
                checksum=checksum or None,
            )
            db.add(asset)
        else:
            asset.file_url = url
            asset.bucket_name = bucket_name
            asset.asset_type = "ITEM_IMAGE"
            if checksum:
                asset.checksum = checksum
        db.flush()

        setattr(item, column, asset.asset_id)
        db.commit()

        print("등록 완료:")
        print(f"  item       = {item.item_key} ({item.item_name}, {item.item_type})")
        print(f"  slot       = {slot} → item.{column} = {asset.asset_id}")
        print(f"  object_key = {object_key}")
        print(f"  bucket     = {bucket_name or '(기본 버킷 S3_BUCKET 으로 간주)'}")
        print(f"  file_url   = {url}")
        print("앱에서 꾸미기 탭을 다시 열면 이 이미지로 표시됩니다.")
    finally:
        db.close()


if __name__ == "__main__":
    main()