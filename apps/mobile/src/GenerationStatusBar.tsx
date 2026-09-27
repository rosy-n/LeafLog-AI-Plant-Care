import { useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAddPlantFlow } from './AddPlantFlowContext';
import { registrationProgressView } from './registrationProgress';
import { registrationResumeScreen } from './registrationStorage';
import { Colors, GreenTint } from '../constants/colors';
import { Fonts, FontSizes } from '../constants/fonts';
import { Radius, Spacing } from '../constants/spacing';

type Props = {
  navigation: { navigate: (name: string, params: object) => void } | null;
  /** 등록 화면 안에서는 대기 화면이 같은 내용을 보여주므로 띄우지 않는다. */
  hidden?: boolean;
};

/**
 * 생성 진행 상황을 앱 어디에서나 보여주는 하단 알림.
 *
 * 알림(푸시)만으로는 권한을 껐거나 알림을 지운 경우 돌아갈 길이 사라진다.
 * 이 막대는 등록을 끝낼 때까지 남아 있어 언제든 이어서 진행할 수 있게 한다.
 */
export default function GenerationStatusBar({ navigation, hidden = false }: Props) {
  const { draft, generation } = useAddPlantFlow();
  const insets = useSafeAreaInsets();
  // 홈 하단 버튼(설정·잎) 사이에 들어가도록 좌우를 비운다.
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const view = registrationProgressView(draft, generation);
  // 진행 중 알림을 닫아도 완료·실패는 다시 알려준다 — 결과를 놓치면 돌아갈 길이 사라진다.
  const dismissKey = view && `${view.jobId}:${view.outcome}`;
  if (hidden || !view || dismissedKey === dismissKey) return null;
  const { percent, title, hint } = view;
  const failed = view.outcome === 'failed';
  const compactTitle = failed ? '캐릭터 생성 실패'
    : view.outcome === 'completed' ? '캐릭터 완성!' : '캐릭터 생성 중';

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + Spacing.section }]} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${hint}`}
        onPress={() => {
          if (!navigation) return;
          const screen = registrationResumeScreen(draft);
          navigation.navigate('AddPlant', {
            screen,
            params: screen === 'CharacterResult' ? { resumeGeneration: 'true' } : undefined,
          });
        }}
      >
        <View style={styles.row}>
          <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.2}>{compactTitle}</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="알림 닫기"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={(event) => { event?.stopPropagation(); setDismissedKey(dismissKey); }}
            style={styles.close}
          >
            <Ionicons name="close" size={16} color={Colors.textGray} />
          </TouchableOpacity>
        </View>

        <View style={styles.track} accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: percent }}>
          <Animated.View
            style={[styles.fill, { width: `${percent}%` }, failed && styles.fillFailed]}
          />
        </View>

        <Text style={styles.hint} numberOfLines={1} maxFontSizeMultiplier={1.2}>{hint}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // 홈의 가장 큰 하단 버튼: 좌우 여백 20 + 지름 70 + 간격 4.
    left: 94,
    right: 94,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 248,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: GreenTint.line,
    // 배경색(FAFFF0) 위에 살짝 비치는 유리 느낌 — 뒤 화면이 흐리게 보인다.
    backgroundColor: 'rgba(250,255,240,0.92)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    lineHeight: 16,
    includeFontPadding: false,
    color: Colors.primary,
  },
  close: {
    width: 20,
    height: 20,
    marginLeft: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    height: 4,
    marginTop: Spacing.xs,
    borderRadius: Radius.sm,
    backgroundColor: GreenTint.wash,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  fillFailed: {
    backgroundColor: Colors.textFaint,
  },
  hint: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.caption,
    lineHeight: 12,
    includeFontPadding: false,
    color: Colors.textMid,
  },
});
