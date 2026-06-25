import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRef, useState } from 'react';
import { useRouter } from '../../src/hooks/useAddPlantRouter';
import * as ImagePicker from 'expo-image-picker';

import { searchPlants } from '../../services/nongsaro';
import type { NongsaroPlant } from '../../types/plant';
import { styles } from './styles/index.styles';

// 'initial': 카메라 + 검색 모두 보임
// 'search':  카메라 영역 숨김, 검색만 보임
type Mode = 'initial' | 'search';

export default function AddPlantIndexScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>('initial');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<NongsaroPlant[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // ── photo helpers ─────────────────────────────────────────────────────────

  const navigateToOrganSelect = (uris: string[]) => {
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
    navigateToOrganSelect([result.assets[0].uri]);
  };

  // ── camera area tapped ────────────────────────────────────────────────────

  const handleCameraPress = () => {
    Alert.alert('사진으로 찾기', '', [
      { text: '사진 라이브러리에서 선택', onPress: pickFromLibrary },
      { text: '카메라로 찍기', onPress: takeWithCamera },
      { text: '취소', style: 'cancel' },
    ]);
  };

  // ── search ────────────────────────────────────────────────────────────────

  const handleSearchFocus = () => setMode('search');

  const handleCancel = () => {
    setMode('initial');
    setSearchText('');
    setSearchResults([]);
    inputRef.current?.blur();
  };

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        setSearchResults(await searchPlants(text));
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
    setIsDetailLoading(true);
    router.push({
      pathname: '/add-plant/plant-detail',
      params: { cntntsNo: plant.cntntsNo, cntntsSj: plant.cntntsSj },
    });
    setTimeout(() => setIsDetailLoading(false), 300);
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
              placeholderTextColor="#A0A0A0"
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
              <View key={item.cntntsNo}>
                {i > 0 && <View style={styles.dropdownSeparator} />}
                <TouchableOpacity
                  style={styles.dropdownItem}
                  onPress={() => handleSearchSelect(item)}
                >
                  {item.rtnThumbFileUrl ? (
                    <Image source={{ uri: item.rtnThumbFileUrl }} style={styles.dropdownThumb} />
                  ) : (
                    <View style={styles.dropdownThumb} />
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

      {isDetailLoading && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" />
          <Text style={styles.overlayText}>식물 정보를 불러오는 중...</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
