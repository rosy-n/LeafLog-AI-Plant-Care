import { Animated, Text, View } from 'react-native';
import { useEffect, useRef } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { identifyPlant } from '../../services/plantnet';
import { styles } from './styles/analyzing.styles';

export default function AnalyzingScreen() {
  const router = useRouter();
  const { photoUris, organs } = useLocalSearchParams<{
    photoUris: string;
    organs: string;
  }>();

  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    ).start();

    (async () => {
      try {
        const uris: string[] = JSON.parse(photoUris ?? '[]');
        const organList: string[] = JSON.parse(organs ?? '[]');
        const results = await identifyPlant(uris, organList);

        router.replace({
          pathname: '/add-plant/plant-results',
          params: { results: JSON.stringify(results), photoUris: photoUris ?? '[]' },
        });
      } catch (e: any) {
        console.error('[PlantNet]', e?.message ?? e);
        router.replace({
          pathname: '/add-plant/plant-results',
          params: {
            results: JSON.stringify([]),
            photoUris: photoUris ?? '[]',
            errorMsg: e?.message ?? '알 수 없는 오류가 발생했어요.',
          },
        });
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI가 식물을{'\n'}분석하고 있어요</Text>
      <Text style={styles.subtitle}>PlantNet으로 식물 종을 분석하는 중이에요...</Text>

      <Animated.View style={[styles.skeletonImage, { opacity: pulse }]} />
      <Animated.View style={[styles.skeletonLine, { opacity: pulse }]} />
      <Animated.View style={[styles.skeletonLine, styles.skeletonLineShort, { opacity: pulse }]} />
      <Animated.View style={[styles.skeletonLine, { opacity: pulse }]} />
    </View>
  );
}
