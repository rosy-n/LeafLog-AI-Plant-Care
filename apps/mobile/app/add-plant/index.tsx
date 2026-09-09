import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from '../../src/hooks/useAddPlantRouter';
import * as ImagePicker from 'expo-image-picker';

// 종 검색은 농사로 API 대신 우리 종 마스터(plant_species)를 쓴다.
// 농사로는 217종뿐이라 산림청·국가생물종지식정보시스템에만 있는 종을 고를 수 없었다.
import { searchSpecies, speciesDisplayName, type SpeciesListItem } from '../../src/api';
import { useAddPlantFlow } from '../../src/AddPlantFlowContext';
import { styles } from './styles/index.styles';

// 'initial': 카메라 + 검색 모두 보임
// 'search':  카메라 영역 숨김, 검색만 보임
type Mode = 'initial' | 'search';

export default function AddPlantIndexScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useAddPlantFlow();

  const [mode, setMode] = useState<Mode>('initial');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SpeciesListItem[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRunRef = useRef(0);
  const inputRef = useRef<TextInput>(null);

  const invalidateSearch = useCallback(() => {
    searchRunRef.current += 1;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }, []);

  useFocusEffect(useCallback(() => {
    setIsDetailLoading(false);
    setIsSearchLoading(false);
    return invalidateSearch;
  }, [invalidateSearch]));

  // ── photo helpers ─────────────────────────────────────────────────────────

  const navigateToOrganSelect = (uris: string[]) => {
    updateDraft({ identificationPhotoUri: uris[0] ?? null });
    router.push({
      pathname: '/add-plant/organ-select',
      params: { photoUris: JSON.stringify(uris) },
    });
  };

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsMultipleSelection: true,
      selectionLimit: 5,
      quality: 0.85,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || result.assets.length === 0) return;
    navigateToOrganSelect(result.assets.map((a) => a.uri));
  };

  const takeWithCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.85 });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    navigateToOrganSelect([uri]);
  };

  // ── camera area tapped ────────────────────────────────────────────────────

  const chooseNewPhoto = () => {
    Alert.alert('사진으로 찾기', '', [
      { text: '사진 라이브러리에서 선택', onPress: pickFromLibrary },
      { text: '카메라로 찍기', onPress: takeWithCamera },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const handleCameraPress = () => {
    const capturedPhotoUri = draft.capturedPhotoUri;
    if (!capturedPhotoUri) {
      chooseNewPhoto();
      return;
    }
    Alert.alert('사진으로 찾기', '', [
      { text: '방금 선택한 사진 사용', onPress: () => navigateToOrganSelect([capturedPhotoUri]) },
      { text: '다른 사진 선택', onPress: chooseNewPhoto },
      { text: '취소', style: 'cancel' },
    ]);
  };

  // ── search ────────────────────────────────────────────────────────────────

  const handleSearchFocus = () => setMode('search');

  const handleCancel = () => {
    invalidateSearch();
    setIsSearchLoading(false);
    setMode('initial');
    setSearchText('');
    setSearchResults([]);
    inputRef.current?.blur();
  };

  const handleSearchChange = (text: string) => {
    invalidateSearch();
    setSearchText(text);
    setSearchResults([]);
    setIsSearchLoading(false);
    if (!text.trim()) return;
    const runId = searchRunRef.current;
    debounceRef.current = setTimeout(async () => {
      debounceRef.current = null;
      setIsSearchLoading(true);
      try {
        const results = await searchSpecies(text.trim());
        if (searchRunRef.current === runId) setSearchResults(results);
      } catch (e: any) {
        if (searchRunRef.current === runId) {
          Alert.alert('오류', e.message ?? '식물 검색 중 문제가 발생했어요.');
        }
      } finally {
        if (searchRunRef.current === runId) setIsSearchLoading(false);
      }
    }, 500);
  };

  const handleSearchSelect = (species: SpeciesListItem) => {
    invalidateSearch();
    setIsSearchLoading(false);
    updateDraft({ identificationPhotoUri: null });
    const displayName = speciesDisplayName(species);
    setSearchText(displayName);
    setSearchResults([]);
    setIsDetailLoading(true);
    router.push({
      pathname: '/add-plant/plant-detail',
      params: {
        speciesId: String(species.species_id),
        commonNameKo: displayName,
        scientificName: species.scientific_name ?? '',
      },
    });
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

        {/* 카메라 영역: 검색 모드에서 숨김 */}
        {mode === 'initial' && (
          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={handleCameraPress}
            activeOpacity={0.85}
          >
            <Text style={styles.cameraBtnIcon}>📷</Text>
            <Text style={styles.cameraBtnText}>사진으로 찾기</Text>
          </TouchableOpacity>
        )}

        {/* 구분선: 검색 모드에서 숨김 */}
        {mode === 'initial' && (
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* 검색 */}
        <View style={styles.searchRow}>
          <View style={[styles.searchWrapper, mode === 'search' && styles.searchWrapperActive]}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="식물 이름으로 검색 (예: 스파티필룸)"
              placeholderTextColor={Colors.textFaint}
              value={searchText}
              onChangeText={handleSearchChange}
              onFocus={handleSearchFocus}
              returnKeyType="search"
            />
            {isSearchLoading && (
              <ActivityIndicator style={styles.searchSpinner} size="small" />
            )}
          </View>

          {/* 취소 버튼: 검색 모드에서만 표시 */}
          {mode === 'search' && (
            <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 드롭다운 */}
        {showDropdown && (
          <View style={styles.dropdown}>
            {searchResults.map((item, i) => (
              <View key={item.species_id}>
                {i > 0 && <View style={styles.dropdownSeparator} />}
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleSearchSelect(item)}
                >
                  <View style={styles.dropdownIcon}>
                    <Text style={styles.dropdownIconText}>🔍</Text>
                  </View>
                  <Text style={styles.dropdownText} numberOfLines={1}>
                    {speciesDisplayName(item)}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {isDetailLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
          <Text style={styles.overlayText}>식물 정보를 불러오는 중...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
