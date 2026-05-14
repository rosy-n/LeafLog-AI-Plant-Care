import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import { identifyPlant } from '../../services/plantnet';
import { getPlantDetail, searchPlants } from '../../services/nongsaro';
import type { NongsaroPlant, PlantNetResult } from '../../types/plant';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AddPlantIndexScreen() {
  const router = useRouter();

  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<NongsaroPlant[]>([]);
  const [plantNetResults, setPlantNetResults] = useState<PlantNetResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── navigate ──────────────────────────────────────────────────────────────

  const navigateWithDetail = async (cntntsNo: string, plantNetResult?: PlantNetResult) => {
    setIsDetailLoading(true);
    try {
      const detail = await getPlantDetail(cntntsNo);
      router.push({
        pathname: '/add-plant/character',
        params: {
          plantDetail: JSON.stringify(detail),
          ...(plantNetResult ? { plantNetResult: JSON.stringify(plantNetResult) } : {}),
        },
      });
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '식물 정보를 불러오는 중 문제가 발생했어요.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // ── camera → PlantNet ─────────────────────────────────────────────────────

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요.');
      return;
    }

    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (picked.canceled) return;

    setPlantNetResults([]);
    setIsCameraLoading(true);
    try {
      const results = await identifyPlant(picked.assets[0].uri);
      if (results.length === 0) {
        Alert.alert(
          '인식 불가',
          '식별 결과가 불확실해요.\n다시 촬영하거나 이름으로 검색해주세요.',
        );
      } else {
        setPlantNetResults(results);
      }
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '식물 인식 중 문제가 발생했어요.');
    } finally {
      setIsCameraLoading(false);
    }
  };

  // ── PlantNet card selected ────────────────────────────────────────────────

  const handlePlantNetSelect = async (result: PlantNetResult) => {
    setIsDetailLoading(true);
    try {
      const plants = await searchPlants(result.scientificName);
      if (plants.length === 0) {
        router.push({
          pathname: '/add-plant/character',
          params: {
            scientificName: result.scientificName,
            commonNameKo: result.commonNames[0] ?? '',
            cntntsNo: '',
            source: 'plantnet',
          },
        });
        return;
      }
      const detail = await getPlantDetail(plants[0].cntntsNo);
      router.push({
        pathname: '/add-plant/character',
        params: {
          plantDetail: JSON.stringify(detail),
          plantNetResult: JSON.stringify(result),
        },
      });
    } catch (e: any) {
      Alert.alert('오류', e.message ?? '식물 정보를 불러오는 중 문제가 발생했어요.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // ── search input (debounce 500ms) ─────────────────────────────────────────

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const results = await searchPlants(text);
        setSearchResults(results);
      } catch (e: any) {
        Alert.alert('오류', e.message ?? '식물 검색 중 문제가 발생했어요.');
      } finally {
        setIsSearchLoading(false);
      }
    }, 500);
  };

  const handleSearchSelect = (plant: NongsaroPlant) => {
    setSearchText(plant.cntntsSj);
    setSearchResults([]);
    navigateWithDetail(plant.cntntsNo);
  };

  const showDropdown = searchResults.length > 0 && searchText.trim().length > 0;

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>어떤 식물인가요?</Text>

        {/* Camera button */}
        <TouchableOpacity
          style={styles.cameraButton}
          onPress={handleCamera}
          disabled={isCameraLoading || isDetailLoading}
          activeOpacity={0.8}
        >
          {isCameraLoading ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.cameraButtonText}>📷  사진으로 찾기</Text>
          )}
        </TouchableOpacity>

        {/* PlantNet result cards */}
        {plantNetResults.length > 0 && (
          <View style={styles.plantNetSection}>
            <Text style={styles.sectionLabel}>인식 결과</Text>
            {plantNetResults.map((result, i) => (
              <View key={i} style={styles.plantNetCard}>
                {result.referenceImages[0]?.url ? (
                  <Image
                    source={{ uri: result.referenceImages[0].url }}
                    style={styles.plantNetImage}
                  />
                ) : (
                  <View style={[styles.plantNetImage, styles.imagePlaceholder]} />
                )}
                <View style={styles.plantNetInfo}>
                  <Text style={styles.plantNetScore}>
                    {Math.round(result.score * 100)}%
                  </Text>
                  <Text style={styles.plantNetScientific} numberOfLines={1}>
                    {result.scientificName}
                  </Text>
                  {result.commonNames.length > 0 && (
                    <Text style={styles.plantNetCommon} numberOfLines={1}>
                      {result.commonNames.join(' · ')}
                    </Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.selectBtn}
                  onPress={() => handlePlantNetSelect(result)}
                  disabled={isDetailLoading}
                >
                  <Text style={styles.selectBtnText}>네, 맞아요</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>또는</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Search input */}
        <View style={styles.searchWrapper}>
          <TextInput
            style={styles.searchInput}
            placeholder="식물 이름으로 검색 (예: 스파티필룸)"
            placeholderTextColor={Colors.textGray}
            value={searchText}
            onChangeText={handleSearchChange}
            editable={!isDetailLoading}
            returnKeyType="search"
          />
          {isSearchLoading && (
            <ActivityIndicator style={styles.searchSpinner} color={Colors.primary} size="small" />
          )}
        </View>

        {/* Search dropdown */}
        {showDropdown && (
          <View style={styles.dropdown}>
            {searchResults.map((item, i) => (
              <View key={item.cntntsNo}>
                {i > 0 && <View style={styles.dropdownSeparator} />}
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleSearchSelect(item)}
                  disabled={isDetailLoading}
                >
                  {item.rtnThumbFileUrl ? (
                    <Image
                      source={{ uri: item.rtnThumbFileUrl }}
                      style={styles.dropdownThumb}
                    />
                  ) : (
                    <View style={[styles.dropdownThumb, styles.imagePlaceholder]} />
                  )}
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {item.cntntsSj}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Detail loading overlay */}
      {isDetailLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.overlayText}>식물 정보를 불러오는 중...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    marginBottom: 24,
  },

  // camera
  cameraButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraButtonText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },

  // PlantNet cards
  sectionLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    marginBottom: 8,
  },
  plantNetSection: {
    gap: 8,
    marginBottom: 8,
  },
  plantNetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  plantNetImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  plantNetInfo: {
    flex: 1,
    gap: 2,
  },
  plantNetScore: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.primary,
  },
  plantNetScientific: {
    fontSize: 14,
    color: Colors.textBlack,
    fontStyle: 'italic',
  },
  plantNetCommon: {
    fontSize: 12,
    color: Colors.textGray,
  },
  selectBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  selectBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 12,
  },

  // divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#D0D0D0',
  },
  dividerText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
  },

  // search
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: Colors.textBlack,
  },
  searchSpinner: {
    marginLeft: 8,
  },

  // dropdown
  dropdown: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  dropdownThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textBlack,
  },
  dropdownSeparator: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 14,
  },

  // shared
  imagePlaceholder: {
    backgroundColor: '#E8F5E9',
  },

  // overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 255, 240, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    zIndex: 100,
  },
  overlayText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.textBlack,
  },
});
