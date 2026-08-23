/*
    월 1회 갱신 흐름 — 캐릭터 재생성 → 개체 정보 갱신, 두 단계.

    등록 흐름(AddPlantNavigator)의 2단계(캐릭터)와 4단계(개체 정보) 화면을 그대로 다시 쓴다.
    같은 것을 묻는 화면을 두 벌 두면 한쪽만 고쳐지는 일이 반드시 생기기 때문이다.
    두 화면은 route params 에 plantId 가 있으면 "갱신 모드"로 동작한다
    (기존 값을 채워서 보여주고, 저장은 POST /api/plants/{id}/refresh 로 간다).

    스크린 이름을 등록 흐름과 같게(Character/Info) 둔 이유: 화면들이 쓰는
    useAddPlantRouter 의 경로→스크린 이름 표가 이 스택에서도 그대로 맞아야 한다.
*/
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CharacterScreen from '../../app/add-plant/character';
import InfoScreen from '../../app/add-plant/info';

import BackButton from '../components/BackButton';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from '../../constants/spacing';
import { Fonts, FontSizes } from '../../constants/fonts';

const Stack = createNativeStackNavigator();

const TOTAL = 2;
const STEP_MAP = {
  Character: 1,
  Info: 2,
};

function RefreshHeader() {
  const navigation = useNavigation();
  const route = useRoute();
  const { top } = useSafeAreaInsets();
  const step = STEP_MAP[route.name] ?? 1;

  return (
    <View style={[styles.header, { paddingTop: top }]}>
      <BackButton onPress={() => navigation.goBack()} style={styles.backBtn} />

      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL }).map((_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentActive]} />
        ))}
      </View>

      <Text style={styles.stepLabel}>{step}/{TOTAL}</Text>
    </View>
  );
}

export default function MonthlyRefreshNavigator({ route }) {
  // 알림 탭·알림 목록에서 넘겨준 개체 (정원 목록 형태)
  const plant = route?.params?.plant ?? {};

  return (
    <Stack.Navigator
      /*
          개체가 바뀌면 스택을 새로 만든다.
          initialParams 는 화면이 처음 붙을 때만 적용되므로, 이 화면이 이미 떠 있는 상태에서
          다른 개체의 알림을 누르면 첫 단계가 옛 plantId 를 그대로 들고 있게 된다.
      */
      key={String(plant.id ?? 'none')}
      screenOptions={{
        header: () => <RefreshHeader />,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen
        name="Character"
        component={CharacterScreen}
        // plantId 가 갱신 모드 표시다 — 두 화면이 이 값으로 등록/갱신을 구분한다
        initialParams={{
          plantId: String(plant.id ?? ''),
          nickname: plant.name ?? '',
          commonNameKo: plant.commonNameKo ?? '',
        }}
      />
      <Stack.Screen name="Info" component={InfoScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  // 등록 흐름 헤더와 같은 모양 — 진행바 칸 수만 다르다
  header: {
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backBtn: {
    width: 32,
    height: 38,
    alignItems: 'flex-start',
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: Radius.xs,
    backgroundColor: Colors.disabled,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  stepLabel: {
    width: 32,
    textAlign: 'right',
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.textGray,
  },
});
