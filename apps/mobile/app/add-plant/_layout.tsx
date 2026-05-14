import { Slot, useRouter, useSegments } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

const TOTAL = 4;

const STEP_MAP: Record<string, number> = {
  index: 1,
  character: 2,
  name: 3,
  info: 4,
};

// ---------------------------------------------------------------------------
// Custom header (reads current route from useSegments)
// ---------------------------------------------------------------------------

function AddPlantHeader() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const segments = useSegments();
  const screenName = segments[segments.length - 1] as string;
  const step = STEP_MAP[screenName] ?? 1;

  return (
    <View style={[styles.header, { paddingTop: top }]}>
      {/* Left: back button */}
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backIcon}>{'<'}</Text>
      </TouchableOpacity>

      {/* Center: 4-segment progress bar */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View
            key={i}
            style={[styles.segment, i < step && styles.segmentActive]}
          />
        ))}
      </View>

      {/* Right: step label */}
      <Text style={styles.stepLabel}>{step}/{TOTAL}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Layout — Slot 사용으로 루트 Stack과 중첩 충돌 없음
// ---------------------------------------------------------------------------

export default function AddPlantLayout() {
  return (
    <View style={styles.container}>
      <AddPlantHeader />
      <Slot />
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
  },

  // header
  header: {
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },

  // back button
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  backIcon: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 20,
    color: Colors.textBlack,
  },

  // progress segments
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8D8D8',
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },

  // step label
  stepLabel: {
    width: 32,
    textAlign: 'right',
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 12,
    color: Colors.textGray,
  },
});
