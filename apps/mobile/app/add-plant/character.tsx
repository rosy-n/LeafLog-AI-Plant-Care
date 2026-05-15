import {
  Alert,
  Animated,
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { styles } from './styles/character.styles';

type ScreenState = 'intro' | 'guide' | 'preview' | 'generating' | 'result';

// TODO: FLUX 모델 프롬프트 확정 후 실제 API 연동으로 교체 예정.
// 현재는 임시방편으로 캐릭터 생성 결과 화면에 로컬 asset 이미지를 출력함.
const PLACEHOLDER_CHARACTER = require('../../assets/dot-character-placeholder.png');

const GUIDE_GOOD = [
  '식물 전체 + 화분이 모두 보이게',
  '밝은 환경에서 촬영',
  '화면 정중앙에 배치',
];
const GUIDE_BAD = [
  '잎만 클로즈업',
  '어두운 곳에서 촬영',
  '흔들린 사진',
];

export default function CharacterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    cntntsNo?: string;
    commonNameKo?: string;
    scientificName?: string;
    plantDetail?: string;
    plantNetResult?: string;
    source?: string;
  }>();

  const [screenState, setScreenState] = useState<ScreenState>('intro');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [phase, setPhase] = useState<1 | 2>(1);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── camera ────────────────────────────────────────────────────────────────

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요.');
      return;
    }
    const picked = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 });
    if (picked.canceled) return;
    setPhotoUri(picked.assets[0].uri);
    setScreenState('preview');
  };

  const handlePickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '사진 라이브러리 접근 권한이 필요해요.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (picked.canceled) return;
    setPhotoUri(picked.assets[0].uri);
    setScreenState('preview');
  };

  const handleStartPhoto = () => {
    Alert.alert('사진 선택', '', [
      { text: '사진 라이브러리에서 선택', onPress: handlePickFromLibrary },
      { text: '카메라로 찍기', onPress: handleTakePhoto },
      { text: '취소', style: 'cancel' },
    ]);
  };

  // ── generation ────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    progressAnim.setValue(0);
    setPhase(1);
    setScreenState('generating');

    // Phase 1: 식물 특징 분석 (0 → 50%)
    Animated.timing(progressAnim, { toValue: 0.5, duration: 1200, useNativeDriver: false }).start();
    await new Promise<void>((r) => setTimeout(r, 1400));

    // Phase 2: 도트 캐릭터 만들기 (50% → 100%)
    setPhase(2);
    await new Promise<void>((r) => {
      Animated.timing(progressAnim, { toValue: 1, duration: 1000, useNativeDriver: false })
        .start(() => r());
    });
    await new Promise<void>((r) => setTimeout(r, 300));

    setScreenState('result');
  };

  const handleNext = () => {
    router.push({
      pathname: '/add-plant/name',
      params: {
        ...params,
        // TODO: FLUX 연동 시 API 응답 URL로 교체
        characterImageUrl: '',
        capturedPhotoUri: photoUri ?? '',
      },
    });
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── render: intro ─────────────────────────────────────────────────────────

  if (screenState === 'intro') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>도트 친구{'\n'}만들기</Text>
        <View style={styles.sampleRow}>
          <View style={styles.sampleChar} />
          <View style={styles.sampleChar} />
          <View style={styles.sampleChar} />
        </View>
        <View style={styles.spacer} />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => setScreenState('guide')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>사진 촬영 가이드</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── render: guide ─────────────────────────────────────────────────────────

  if (screenState === 'guide') {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>이렇게{'\n'}찍어주세요</Text>
        <View style={styles.guideSection}>
          <View style={styles.guideBox}>
            <Text style={styles.guideBoxTitle}>✅  좋은 예</Text>
            {GUIDE_GOOD.map((text) => (
              <Text key={text} style={styles.guideItem}>• {text}</Text>
            ))}
          </View>
          <View style={[styles.guideBox, styles.guideBoxBad]}>
            <Text style={styles.guideBoxTitle}>❌  나쁜 예</Text>
            {GUIDE_BAD.map((text) => (
              <Text key={text} style={styles.guideItem}>• {text}</Text>
            ))}
          </View>
        </View>
        <View style={styles.spacer} />
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleStartPhoto}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>사진 촬영 시작</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── render: preview ───────────────────────────────────────────────────────

  if (screenState === 'preview' && photoUri) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>이 사진으로{'\n'}캐릭터를 만들 건가요?</Text>
        <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
        <View style={styles.rowBtns}>
          <TouchableOpacity
            style={[styles.btn, styles.outlineBtn]}
            onPress={() => { setPhotoUri(null); setScreenState('guide'); }}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineBtnText}>다시 찍어요</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.primaryBtn]}
            onPress={handleGenerate}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryBtnText}>캐릭터 만들기</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── render: generating ────────────────────────────────────────────────────

  if (screenState === 'generating') {
    return (
      <View style={styles.generatingContainer}>
        <Text style={styles.generatingTitle}>
          {phase === 1 ? '식물 특징을\n분석하고 있어요' : '도트 캐릭터를\n만들고 있어요'}
        </Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
        <Text style={styles.progressLabel}>
          {phase === 1 ? '식물 특징을 파악하는 중...' : '도트 이미지를 그리는 중...'}
        </Text>
      </View>
    );
  }

  // ── render: result ────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Text style={styles.title}>도트 캐릭터가{'\n'}완성됐어요!</Text>
      <Image source={PLACEHOLDER_CHARACTER} style={styles.characterImage} resizeMode="contain" />
      <View style={styles.spacer} />
      <View style={styles.rowBtns}>
        <TouchableOpacity
          style={[styles.btn, styles.outlineBtn]}
          onPress={() => { setPhotoUri(null); setScreenState('guide'); }}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineBtnText}>다시 만들기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>확인</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
