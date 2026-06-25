import {
  Alert,
  Animated,
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useAddPlantRouter';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

import { common } from './styles/common.styles';
import { styles } from './styles/character.styles';
import { Colors } from '../../constants/colors';

type ScreenState = 'intro' | 'guide' | 'preview' | 'generating' | 'result';

// TODO: FLUX 모델 프롬프트 확정 후 실제 API 연동으로 교체 예정.
const PLACEHOLDER_CHARACTER = require('../../assets/dot-character-placeholder.png');

const CHAR_SAMPLE_1 = require('../../assets/char-sample-1.png');
const CHAR_SAMPLE_2 = require('../../assets/char-sample-2.png');
const CHAR_SAMPLE_3 = require('../../assets/char-sample-3.png');

const GUIDE_GOOD   = require('../../assets/guide-good.png');
const GUIDE_BAD_1  = require('../../assets/guide-bad-1.png');
const GUIDE_BAD_2  = require('../../assets/guide-bad-2.png');
const GUIDE_BAD_3  = require('../../assets/guide-bad-3.png');

const GUIDE_GOOD_POINTS = [
  '화분까지 전체가 보여요',
  '정면에서 촬영했어요',
  '밝은 곳에서 찍었어요',
];
const GUIDE_BAD_ITEMS = [
  { src: GUIDE_BAD_1, label: '화분이 안 나와요' },
  { src: GUIDE_BAD_2, label: '잎만 보여요' },
  { src: GUIDE_BAD_3, label: '배경이 복잡해요' },
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

    Animated.timing(progressAnim, { toValue: 0.5, duration: 1200, useNativeDriver: false }).start();
    await new Promise<void>((r) => setTimeout(r, 1400));

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
        <Text style={[common.title, { marginBottom: 8 }]}>도트 친구 만들기</Text>
        <Text style={styles.introSubtitle}>
          식물의 사진을 찍어{'\n'}나만의 도트 캐릭터를 만들어볼까요?
        </Text>

        <View style={styles.charSampleWrap}>
          <View style={styles.charTopRow}>
            <Image source={CHAR_SAMPLE_1} style={styles.charSampleImg} resizeMode="contain" />
            <Image source={CHAR_SAMPLE_2} style={styles.charSampleImg} resizeMode="contain" />
          </View>
          <Image source={CHAR_SAMPLE_3} style={[styles.charSampleImg, styles.charSampleCenter]} resizeMode="contain" />
        </View>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.primaryBtn} onPress={() => setScreenState('guide')} activeOpacity={0.8}>
          <View style={styles.btnRow}>
            <Ionicons name="camera-outline" size={20} color={Colors.white} />
            <Text style={styles.primaryBtnText}>사진 촬영 가이드</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  // ── render: guide ─────────────────────────────────────────────────────────

  if (screenState === 'guide') {
    return (
      <View style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.guideScreen}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[common.title, { marginBottom: 8 }]}>이렇게 찍어주세요</Text>

          {/* 좋은 예 */}
          <View style={styles.guideCategory}>
            <View style={styles.guideCategoryHeader}>
              <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
              <Text style={[styles.guideCategoryLabel, { color: Colors.primary }]}>좋은 예</Text>
            </View>
            <View style={[styles.guideCard, styles.guideCardGood]}>
              <Image source={GUIDE_GOOD} style={styles.guideCardImage} resizeMode="cover" />
              <View style={styles.guideCardTextWrap}>
                {GUIDE_GOOD_POINTS.map((text) => (
                  <Text key={text} style={styles.guidePoint}>{text}</Text>
                ))}
              </View>
            </View>
          </View>

          {/* 나쁜 예 */}
          <View style={styles.guideCategory}>
            <View style={styles.guideCategoryHeader}>
              <Ionicons name="close-circle" size={22} color="#E53935" />
              <Text style={[styles.guideCategoryLabel, { color: '#E53935' }]}>나쁜 예</Text>
            </View>
            <View style={styles.badExampleRow}>
              {GUIDE_BAD_ITEMS.map(({ src, label }) => (
                <View key={label} style={styles.badExampleItem}>
                  <Image source={src} style={styles.badExampleImg} resizeMode="cover" />
                  <Text style={styles.badExampleLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>

        <View style={styles.guideFooter}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleStartPhoto} activeOpacity={0.8}>
            <View style={styles.btnRow}>
              <Ionicons name="camera-outline" size={20} color={Colors.white} />
              <Text style={styles.primaryBtnText}>사진 촬영 시작</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── render: preview ───────────────────────────────────────────────────────

  if (screenState === 'preview' && photoUri) {
    return (
      <View style={styles.container}>
        <Text style={[common.title, { marginBottom: 8 }]}>이 사진으로 캐릭터를 만들 건가요?</Text>
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
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[common.title, { marginBottom: 8 }]} numberOfLines={1}>도트 캐릭터가 완성됐어요!</Text>
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
      </ScrollView>
    </View>
  );
}
