import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';

// expo-router pathname → React Navigation screen name
const PATH_TO_SCREEN: Record<string, string> = {
  '/add-plant':                'AddPlantIndex',
  '/add-plant/organ-select':   'OrganSelect',
  '/add-plant/analyzing':      'Analyzing',
  '/add-plant/plant-results':  'PlantResults',
  '/add-plant/plant-detail':   'AddPlantPlantDetail',
  '/add-plant/character':      'Character',
  '/add-plant/name':           'Name',
  '/add-plant/info':           'Info',
  '/add-plant/persona':        'Persona',
};

type RouterArg = string | { pathname: string; params?: Record<string, unknown> };

function resolve(to: RouterArg): { screen: string; params?: Record<string, unknown> } {
  if (typeof to === 'string') return { screen: PATH_TO_SCREEN[to] ?? to };
  return { screen: PATH_TO_SCREEN[to.pathname] ?? to.pathname, params: to.params };
}

export function useRouter() {
  const navigation = useNavigation<any>();

  return {
    push(to: RouterArg) {
      const { screen, params } = resolve(to);
      navigation.navigate(screen, params);
    },
    replace(to: RouterArg) {
      const pathname = typeof to === 'string' ? to : to.pathname;
      const params = typeof to === 'string' ? undefined : to.params;

      if (pathname === '/') {
        // 등록 완료 → 메인 스택(MainStack)을 [Home, PlantDetail]로 리셋
        // 방금 등록한 식물(params.plant)을 PlantDetail로 그대로 전달
        const mainStack = navigation.getParent('MainStack');
        (mainStack ?? navigation.getParent())?.dispatch(
          CommonActions.reset({
            index: 1,
            routes: [{ name: 'Home' }, { name: 'PlantDetail', params }],
          })
        );
      } else if (pathname === '/add-plant') {
        // 등록 재시작
        navigation.replace('AddPlantIndex');
      } else {
        const { screen, params } = resolve(to);
        navigation.replace(screen, params);
      }
    },
    back() {
      navigation.goBack();
    },
  };
}

export function useLocalSearchParams<
  T extends Record<string, unknown> = Record<string, string>,
>(): Partial<T> {
  const route = useRoute();
  return ((route.params ?? {}) as unknown) as Partial<T>;
}
