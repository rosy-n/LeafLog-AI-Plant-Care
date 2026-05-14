import {
  Alert,
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

type ScreenState = 'guide' | 'preview' | 'generating';

const MOCK_CHARACTER_URL = 'https://placeholder-dot-character.png';

const GUIDE_GOOD = ['식물 전체 + 화분이 모두 보이게', '밝은 환경에서 촬영', '화면 정중앙에 배치'];
const GUIDE_BAD = ['잎만 클로즈업', '어두운 곳에서 촬영', '흔들린 사진'];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function CharacterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    scientificName?: string;
    commonNameKo?: string;
    cntntsNo?: string;
    source?: string;
    plantDetail?: string;
    plantNetResult?: string;
  }>();

  const [screenState, setScreenState] = useState<ScreenState>('guide');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState('');

  const progressAnim = useRef(new Animated.Value(0)).current;

  // ── camera ────────────────────────────────────────────────────────────────

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('권한 필요', '카메라 접근 권한이 필요해요.');
      return;
    }

    const picked = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });

    if (picked.canceled) return;

    setPhotoUri(picked.assets[0].uri);
    setScreenState('preview');
  };

  const handleRetake = () => {
    setPhotoUri(null);
    setScreenState('guide');
  };

  // ── generate character (mock) ─────────────────────────────────────────────

  const handleGenerate = async () => {
    progressAnim.setValue(0);
    setScreenState('generating');

    // 25%
    setProgressMessage('사진을 분석하는 중...');
    Animated.timing(progressAnim, {
      toValue: 0.25,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // 55%
    await new Promise<void>((r) => setTimeout(r, 700));
    setProgressMessage('캐릭터를 그리는 중...');
    Animated.timing(progressAnim, {
      toValue: 0.55,
      duration: 500,
      useNativeDriver: false,
    }).start();

    // 100% — mock 총 2초 딜레이
    await new Promise<void>((r) => setTimeout(r, 1300));
    setProgressMessage('완성!');
    await new Promise<void>((r) => {
      Animated.timing(progressAnim, {
        toValue: 1.0,
        duration: 400,
        useNativeDriver: false,
      }).start(() => r());
    });

    router.push({
      pathname: '/add-plant/name',
      params: {
        ...params,
        characterImageUrl: MOCK_CHARACTER_URL,
        capturedPhotoUri: photoUri ?? '',
      },
    });
  };

  // ── render: generating ────────────────────────────────────────────────────

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  if (screenState === 'generating') {
    return (
      <View style={styles.generatingContainer}>
        <Text style={styles.generatingTitle}>캐릭터 생성 중</Text>
        <Text style={styles.progressMessage}>{progressMessage}</Text>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
        </View>
      </View>
    );
  }

  // ── render: preview ───────────────────────────────────────────────────────

  if (screenState === 'preview' && photoUri) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>이 사진으로{'\n'}만들까요?</Text>

        <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />

        <View style={styles.rowBtns}>
          <TouchableOpacity
            style={[styles.btn, styles.outlineBtn]}
            onPress={handleRetake}
            activeOpacity={0.8}
          >
            <Text style={styles.outlineBtnText}>다시 촬영</Text>
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

  // ── render: guide (default) ───────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Text style={styles.title}>도트 캐릭터를{'\n'}만들어볼까요?</Text>

      <View style={styles.guideSection}>
        <View style={styles.guideBox}>
          <Text style={styles.guideBoxTitle}>✅  좋은 예</Text>
          {GUIDE_GOOD.map((text) => (
            <Text key={text} style={styles.guideItem}>
              • {text}
            </Text>
          ))}
        </View>
        <View style={[styles.guideBox, styles.guideBoxBad]}>
          <Text style={styles.guideBoxTitle}>❌  나쁜 예</Text>
          {GUIDE_BAD.map((text) => (
            <Text key={text} style={styles.guideItem}>
              • {text}
            </Text>
          ))}
        </View>
      </View>

      <View style={styles.spacer} />

      <TouchableOpacity
        style={[styles.btn, styles.primaryBtn]}
        onPress={handleTakePhoto}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryBtnText}>사진 촬영 시작</Text>
      </TouchableOpacity>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: 28,
  },

  // guide
  guideSection: {
    gap: 14,
  },
  guideBox: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary,
    gap: 6,
  },
  guideBoxBad: {
    borderLeftColor: '#E53935',
  },
  guideBoxTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.textBlack,
    marginBottom: 4,
  },
  guideItem: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 22,
  },
  spacer: {
    flex: 1,
  },

  // preview
  previewImage: {
    flex: 1,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#E8F5E9',
  },
  rowBtns: {
    flexDirection: 'row',
    gap: 12,
  },

  // buttons — flex: 1 so they stretch in row or fill column
  btn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryBtn: {
    backgroundColor: Colors.primary,
  },
  primaryBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },
  outlineBtn: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  outlineBtnText: {
    color: Colors.primary,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },

  // generating
  generatingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  generatingTitle: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
  },
  progressMessage: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.textGray,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    backgroundColor: '#D8D8D8',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 5,
  },
});
