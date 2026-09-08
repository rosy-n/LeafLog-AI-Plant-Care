import {
  ActivityIndicator,
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useAddPlantRouter';

import { getSpecies, type SpeciesDetail } from '../../src/api';
import { useAddPlantFlow } from '../../src/AddPlantFlowContext';
import { styles } from './styles/plant-detail.styles';

export default function PlantDetailScreen() {
  const router = useRouter();
  const { updateDraft } = useAddPlantFlow();
  const { speciesId, commonNameKo, scientificName } = useLocalSearchParams<{
    speciesId: string;
    commonNameKo: string;
    scientificName?: string;
  }>();

  const [detail, setDetail] = useState<SpeciesDetail | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!speciesId) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    getSpecies(Number(speciesId))
      .then((species) => {
        if (!cancelled) setDetail(species);
      })
      .catch((e: any) => {
        // 상세를 못 읽어도 검색 단계에서 받은 이름으로 계속 진행할 수 있게 한다
        if (!cancelled) {
          Alert.alert('알림', e.message ?? '식물 정보를 불러오지 못했어요.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [speciesId]);

  // 대표 이미지 — Wikimedia Commons 사진 최대 4장(image_urls). 없으면 빈 슬롯.
  const images = detail?.image_urls?.length
    ? detail.image_urls.slice(0, 4)
    : detail?.image_url
      ? [detail.image_url]
      : [];

  const goToIndex = (index: number) => {
    const clamped = Math.max(0, Math.min(images.length - 1, index));
    scrollRef.current?.scrollTo({ x: clamped * pageWidth, animated: true });
    setPhotoIndex(clamped);
  };

  const handleSlideScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    setPhotoIndex(Math.round(e.nativeEvent.contentOffset.x / pageWidth));
  };

  const handleConfirm = () => {
    updateDraft({
      speciesId: speciesId ? Number(speciesId) : null,
      commonNameKo: detail?.common_name_ko ?? commonNameKo ?? '',
      scientificName: detail?.scientific_name ?? scientificName ?? null,
      speciesImageUrl: detail?.image_url ?? null,
    });
    router.push({
      pathname: '/add-plant/info',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>식물 정보를 불러오는 중...</Text>
      </View>
    );
  }

  const totalPhotos = images.length;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>이 식물이 맞나요?</Text>

      {/* 사진 슬라이드 — 좌우로 스와이프하거나 화살표로 넘긴다 */}
      <View style={styles.imageRow}>
        <TouchableOpacity
          style={[styles.navBtn, photoIndex === 0 && styles.navBtnHidden]}
          onPress={() => goToIndex(photoIndex - 1)}
          disabled={photoIndex === 0}
        >
          <Text style={styles.navBtnText}>{'<'}</Text>
        </TouchableOpacity>

        <View
          style={styles.plantImage}
          onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
        >
          {totalPhotos > 0 && pageWidth > 0 && (
            <ScrollView
              ref={scrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleSlideScrollEnd}
            >
              {images.map((uri, i) => (
                <Image
                  key={i}
                  source={{ uri }}
                  style={{ width: pageWidth, height: pageWidth }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          )}
        </View>

        <TouchableOpacity
          style={[styles.navBtn, photoIndex >= totalPhotos - 1 && styles.navBtnHidden]}
          onPress={() => goToIndex(photoIndex + 1)}
          disabled={photoIndex >= totalPhotos - 1}
        >
          <Text style={styles.navBtnText}>{'>'}</Text>
        </TouchableOpacity>
      </View>

      {totalPhotos > 1 && (
        <Text style={styles.photoCounter}>
          {photoIndex + 1} / {totalPhotos}
        </Text>
      )}

      {/* Plant info */}
      <Text style={styles.plantName}>{detail?.common_name_ko ?? commonNameKo}</Text>
      {detail?.scientific_name ?? scientificName ? (
        <Text style={styles.scientificName}>
          {detail?.scientific_name ?? scientificName}
        </Text>
      ) : null}

      <View style={styles.spacer} />

      {/* Buttons */}
      <View style={styles.rowBtns}>
        <TouchableOpacity
          style={[styles.btn, styles.outlineBtn]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineBtnText}>아니요</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn]}
          onPress={handleConfirm}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>네</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
