import {
  Alert,
  FlatList,
  Image,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { searchPlants, getPlantDetail } from '../../services/nongsaro';
import type { PlantNetResult } from '../../types/plant';
import { common } from './styles/common.styles';
import { styles } from './styles/plant-results.styles';

export default function PlantResultsScreen() {
  const router = useRouter();
  const { results, photoUris, errorMsg } = useLocalSearchParams<{
    results: string;
    photoUris: string;
    errorMsg?: string;
  }>();

  const plantNetResults: PlantNetResult[] = JSON.parse(results ?? '[]');
  const userPhotos: string[] = JSON.parse(photoUris ?? '[]');
  const [loadingIndex, setLoadingIndex] = useState<number | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [heroRatio, setHeroRatio] = useState<number>(4 / 3);

  useEffect(() => {
    if (userPhotos[0]) {
      Image.getSize(userPhotos[0], (w, h) => setHeroRatio(w / h), () => {});
    }
  }, []);

  const handleSelect = async (item: PlantNetResult, index: number) => {
    setLoadingIndex(index);
    try {
      const plants = await searchPlants(item.scientificName);
      if (plants.length > 0) {
        const detail = await getPlantDetail(plants[0].cntntsNo);
        router.push({
          pathname: '/add-plant/character',
          params: {
            cntntsNo: plants[0].cntntsNo,
            commonNameKo: detail.commonNameKo,
            scientificName: item.scientificName,
            plantDetail: JSON.stringify(detail),
            plantNetResult: JSON.stringify(item),
            source: 'camera',
          },
        });
      } else {
        router.push({
          pathname: '/add-plant/character',
          params: {
            cntntsNo: '',
            commonNameKo: item.commonNames[0] ?? item.scientificName,
            scientificName: item.scientificName,
            plantNetResult: JSON.stringify(item),
            source: 'camera',
          },
        });
      }
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '식물 정보를 불러오는 중 문제가 발생했어요.');
    } finally {
      setLoadingIndex(null);
    }
  };

  if (plantNetResults.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          인식 결과가 없어요.{'\n'}다시 촬영하거나 이름으로 검색해주세요.
        </Text>
        {errorMsg ? (
          <Text style={styles.errorText}>오류: {errorMsg}</Text>
        ) : null}
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => router.replace('/add-plant')}
        >
          <Text style={styles.retryBtnText}>처음으로</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        <Text style={[common.title, styles.titleOverride]} numberOfLines={1}>식물 검색 결과</Text>

        {userPhotos[0] && (
          <Image
            source={{ uri: userPhotos[0] }}
            style={[styles.heroPhoto, { aspectRatio: heroRatio }]}
            resizeMode="contain"
          />
        )}

        {plantNetResults.map((item, index) => (
          <View key={index} style={styles.card}>
            {item.referenceImages.length > 0 && (
              <FlatList
                horizontal
                data={item.referenceImages}
                keyExtractor={(_, i) => String(i)}
                contentContainerStyle={styles.refImageRow}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item: img }) =>
                  img.url ? (
                    <TouchableOpacity
                      onPress={() => setModalImage(img.url)}
                      activeOpacity={0.85}
                    >
                      <Image
                        source={{ uri: img.url }}
                        style={styles.refImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.refImage} />
                  )
                }
              />
            )}

            <View style={styles.cardBody}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardScore}>{Math.round(item.score * 100)}%</Text>
                <Text style={styles.cardScientific} numberOfLines={1}>
                  {item.scientificName}
                </Text>
                {item.commonNames.length > 0 && (
                  <Text style={styles.cardCommon} numberOfLines={1}>
                    {item.commonNames.join(' · ')}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleSelect(item, index)}
                disabled={loadingIndex !== null}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>
                  {loadingIndex === index ? '...' : '네, 맞아요'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal
        visible={modalImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalImage(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalImage(null)}
        >
          {modalImage && (
            <Image
              source={{ uri: modalImage }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}
