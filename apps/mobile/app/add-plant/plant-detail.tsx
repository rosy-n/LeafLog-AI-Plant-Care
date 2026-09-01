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
  const [isLoading, setIsLoading] = useState(true);

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

  // 종 마스터는 대표 이미지 1장(농사로 썸네일)만 가진다. 없으면 빈 슬롯.
  const images = detail?.image_url ? [detail.image_url] : [];

  const handleConfirm = () => {
    updateDraft({
      speciesId: speciesId ? Number(speciesId) : null,
      commonNameKo: detail?.common_name_ko ?? commonNameKo ?? '',
      scientificName: detail?.scientific_name ?? scientificName ?? null,
      speciesImageUrl: detail?.image_url ?? null,
    });
    router.push({
      pathname: '/add-plant/character',
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

  const currentImage = images[photoIndex] ?? null;
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
