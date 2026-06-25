import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

import { Colors } from '../../constants/colors';
import { Fonts }  from '../../constants/fonts';

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
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Text style={styles.backIcon}>{'<'}</Text>
      </TouchableOpacity>

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
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 32,
    alignItems: 'flex-start',
  },
  backIcon: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 20,
    color: Colors.textBlack,
  },
  progressRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.disabled,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  stepLabel: {
    width: 32,
    textAlign: 'right',
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 12,
    color: Colors.textGray,
  },
});