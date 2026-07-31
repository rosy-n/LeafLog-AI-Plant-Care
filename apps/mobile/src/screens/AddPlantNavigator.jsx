import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddPlantIndexScreen  from '../../app/add-plant/index';
import OrganSelectScreen    from '../../app/add-plant/organ-select';
import AnalyzingScreen      from '../../app/add-plant/analyzing';
import PlantResultsScreen   from '../../app/add-plant/plant-results';
import AddPlantPlantDetail  from '../../app/add-plant/plant-detail';
import CharacterScreen      from '../../app/add-plant/character';
import NameScreen           from '../../app/add-plant/name';
import InfoScreen           from '../../app/add-plant/info';

import BackButton from '../components/BackButton';
import { Colors } from '../../constants/colors';
import { Spacing, Radius } from "../../constants/spacing";
import { Fonts, FontSizes } from '../../constants/fonts';

const Stack = createNativeStackNavigator();

const TOTAL = 4;
const STEP_MAP = {
  AddPlantIndex:       1,
  OrganSelect:         1,
  Analyzing:           1,
  PlantResults:        1,
  AddPlantPlantDetail: 1,
  Character:           2,
  Name:                3,
  Info:                4,
};

function AddPlantHeader() {
  const navigation = useNavigation();
  const route      = useRoute();
  const { top }    = useSafeAreaInsets();
  const step       = STEP_MAP[route.name] ?? 1;

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

export default function AddPlantNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        header: () => <AddPlantHeader />,
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="AddPlantIndex"       component={AddPlantIndexScreen} />
      <Stack.Screen name="OrganSelect"         component={OrganSelectScreen} />
      <Stack.Screen name="Analyzing"           component={AnalyzingScreen} />
      <Stack.Screen name="PlantResults"        component={PlantResultsScreen} />
      <Stack.Screen name="AddPlantPlantDetail" component={AddPlantPlantDetail} />
      <Stack.Screen name="Character"           component={CharacterScreen} />
      <Stack.Screen name="Name"                component={NameScreen} />
      <Stack.Screen name="Info"                component={InfoScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: Colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  // 진행바가 있는 컴팩트 헤더 — 공용 BackButton의 48×48 박스를 줄여 쓴다
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