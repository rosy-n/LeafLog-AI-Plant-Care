import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { RegistrationProgressView } from '../registrationProgress';
import { Colors, GreenTint } from '../../constants/colors';
import { Fonts, FontSizes } from '../../constants/fonts';
import { Radius, Spacing } from '../../constants/spacing';

type Props = {
  progress: RegistrationProgressView;
  onPress: () => void;
};

export default function GardenGenerationCard({ progress, onPress }: Props) {
  const working = progress.outcome === 'working';
  const failed = progress.outcome === 'failed';

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${progress.shortLabel}${working ? ` ${progress.percent}%` : ''}`}
      accessibilityHint="식물 등록 이어서 진행하기"
      onPress={onPress}
    >
      <View style={styles.value}>
        {working ? (
          <Text style={styles.percent} maxFontSizeMultiplier={1.2}>
            {`${progress.percent}%`}
          </Text>
        ) : (
          <Ionicons name={failed ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={28} color={failed ? Colors.textMid : Colors.primary} />
        )}
      </View>
      <View style={styles.labelSlot}>
        <Text style={styles.label} numberOfLines={2} maxFontSizeMultiplier={1.2}>
          {progress.shortLabel}
        </Text>
      </View>
      <View style={styles.track}
        accessibilityRole={working ? 'progressbar' : undefined}
        accessibilityValue={working ? { min: 0, max: 100, now: progress.percent } : undefined}>
        {!failed && <View style={[styles.fill, { width: `${progress.percent}%` }]} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 118,
    height: 118,
    padding: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: GreenTint.line,
    borderRadius: Radius.sm,
    backgroundColor: GreenTint.faint,
  },
  value: {
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percent: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.title,
    color: Colors.primary,
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: 0,
  },
  labelSlot: {
    height: 44,
    width: '100%',
    justifyContent: 'center',
  },
  label: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    lineHeight: 18,
    color: GreenTint.deep,
    textAlign: 'center',
    includeFontPadding: false,
    letterSpacing: 0,
  },
  track: {
    width: '100%',
    height: 4,
    marginTop: Spacing.xs,
    borderRadius: Radius.xs,
    backgroundColor: GreenTint.wash,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
});
