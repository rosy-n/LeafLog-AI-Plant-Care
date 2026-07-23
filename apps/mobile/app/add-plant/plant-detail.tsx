import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useAddPlantRouter';

import { getPlantDetail, getPlantImages } from '../../services/nongsaro';
import type { NongsaroPlantDetail } from '../../types/plant';
import { styles } from './styles/plant-detail.styles';

export default function PlantDetailScreen() {
  const router = useRouter();
  const { cntntsNo, cntntsSj } = useLocalSearchParams<{
    cntntsNo: string;
    cntntsSj: string;
  }>();

  const [detail, setDetail] = useState<NongsaroPlantDetail | null>(null);
  const [images, setImages] = useState<{ url: string; thumbUrl: string }[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // allSettled: 상세 정보가 없는 식물도 기본 정보(이름)로 계속 진행
        const [detResult, imgsResult] = await Promise.allSettled([
          getPlantDetail(cntntsNo),
          getPlantImages(cntntsNo),
        ]);

        if (detResult.status === 'fulfilled') {
          setDetail(detResult.value);
        }
        // 상세 정보 없음 → detail=null 유지, UI는 cntntsSj(검색어) 표시

        if (imgsResult.status === 'fulfilled') {
          setImages(imgsResult.value);
        }
        // 이미지 없음 → 빈 슬롯으로 표시
      } catch (e: any) {
        Alert.alert('오류', e.message ?? '식물 정보를 불러오는 중 문제가 발생했어요.');
        router.back();
      } finally {
        setIsLoading(false);
      }
    })();
  }, [cntntsNo]);

  const handleConfirm = () => {
    router.push({
      pathname: '/add-plant/character',
      params: {
        cntntsNo,
        commonNameKo: detail?.commonNameKo ?? cntntsSj ?? '',
        scientificName: detail?.scientificName ?? '',
        plantDetail: JSON.stringify(detail),
        source: 'search',
      },
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

  const currentImage = images[photoIndex]?.url ?? null;
  const totalPhotos = images.length;

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>이 식물이 맞나요?</Text>

      {/* Image with prev/next */}
      <View style={styles.imageRow}>
        <TouchableOpacity
          style={[styles.navBtn, photoIndex === 0 && styles.navBtnHidden]}
          onPress={() => setPhotoIndex((p) => Math.max(0, p - 1))}
          disabled={photoIndex === 0}
        >
          <Text style={styles.navBtnText}>{'<'}</Text>
        </TouchableOpacity>

        {currentImage ? (
          <Image source={{ uri: currentImage }} style={styles.plantImage} resizeMode="cover" />
        ) : (
          <View style={styles.plantImage} />
        )}

        <TouchableOpacity
          style={[styles.navBtn, photoIndex >= totalPhotos - 1 && styles.navBtnHidden]}
          onPress={() => setPhotoIndex((p) => Math.min(totalPhotos - 1, p + 1))}
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
      <Text style={styles.plantName}>{detail?.commonNameKo ?? cntntsSj}</Text>
      {detail?.scientificName ? (
        <Text style={styles.scientificName}>{detail.scientificName}</Text>
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
