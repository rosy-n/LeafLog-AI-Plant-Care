import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { searchPlants, getPlantDetail } from '../../services/nongsaro';
import type { PlantNetResult } from '../../types/plant';
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
    <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
      <Text style={styles.title}>식물 검색 결과</Text>

      {/* 사용자가 찍은 사진 (상단 가로 스크롤) */}
      {userPhotos.length > 0 && (
        <View style={styles.userPhotoSection}>
          <Text style={styles.userPhotoLabel}>내가 찍은 사진</Text>
          <FlatList
            horizontal
            data={userPhotos}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={styles.userPhotoScroll}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={styles.userPhoto} resizeMode="cover" />
            )}
          />
        </View>
      )}

      {/* 결과 카드 */}
      {plantNetResults.map((item, index) => (
        <View key={index} style={styles.card}>
          {/* PlantNet 참고 이미지 가로 스크롤 */}
          {item.referenceImages.length > 0 && (
            <FlatList
              horizontal
              data={item.referenceImages}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.refImageRow}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item: img }) =>
                img.url ? (
                  <Image source={{ uri: img.url }} style={styles.refImage} resizeMode="cover" />
                ) : (
                  <View style={styles.refImage} />
                )
              }
            />
          )}

          {/* 식물 정보 + 버튼 */}
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
  );
}
