import { Animated, Image, Text, View } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { identifyPlant } from '../../services/plantnet';
import { common } from './styles/common.styles';
import { styles } from './styles/analyzing.styles';

const SUBTITLES = [
  '사진을 살펴보고 있어요...',
  '어떤 식물인지 알아보는 중이에요...',
  '거의 다 됐어요!',
];

export default function AnalyzingScreen() {
  const router = useRouter();
  const { photoUris, organs } = useLocalSearchParams<{
    photoUris: string;
    organs: string;
  }>();

  const previewUri: string | null = (() => {
    try { return (JSON.parse(photoUris ?? '[]') as string[])[0] ?? null; }
    catch { return null; }
  })();

  const progress = useRef(new Animated.Value(0)).current;
  const [subtitleIdx, setSubtitleIdx] = useState(0);
  // 실제 사진 비율로 표시 (잘림 없음). 기본값은 4:3.
  const [photoRatio, setPhotoRatio] = useState<number>(4 / 3);

  useEffect(() => {
    if (previewUri) {
      Image.getSize(previewUri, (w, h) => setPhotoRatio(w / h), () => {});
    }
  }, [previewUri]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSubtitleIdx(i => (i + 1) % SUBTITLES.length);
    }, 2500);

    // 30초에 걸쳐 50%까지 채움
    Animated.timing(progress, {
      toValue: 0.5,
      duration: 30000,
      useNativeDriver: false,
    }).start();

    const navigateTo = (params: Record<string, string>) => {
      clearInterval(interval);
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setTimeout(() => router.replace({ pathname: '/add-plant/plant-results', params }), 400);
      });
    };

    (async () => {
      try {
        const uris: string[] = JSON.parse(photoUris ?? '[]');
        const organList: string[] = JSON.parse(organs ?? '[]');
        const results = await identifyPlant(uris, organList);
        navigateTo({ results: JSON.stringify(results), photoUris: photoUris ?? '[]' });
      } catch (e: any) {
        console.error('[PlantNet]', e?.message ?? e);
        navigateTo({
          results: JSON.stringify([]),
          photoUris: photoUris ?? '[]',
          errorMsg: e?.message ?? '알 수 없는 오류가 발생했어요.',
        });
      }
    })();

    return () => clearInterval(interval);
  }, []);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <Text style={[common.title, { marginBottom: 24 }]} numberOfLines={1}>AI가 식물을 분석하고 있어요</Text>

      {previewUri ? (
        <Image
          source={{ uri: previewUri }}
          style={[styles.photoPreview, { aspectRatio: photoRatio }]}
          resizeMode="contain"
        />
      ) : (
        <View style={styles.photoPreviewPlaceholder} />
      )}

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <Text style={styles.subtitle}>{SUBTITLES[subtitleIdx]}</Text>
    </View>
  );
}
