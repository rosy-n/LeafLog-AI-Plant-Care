import { CommonActions, useNavigation, useRoute } from '@react-navigation/native';

// expo-router pathname → React Navigation screen name
const PATH_TO_SCREEN: Record<string, string> = {
  '/add-plant':                'AddPlantIndex',
  '/add-plant/organ-select':   'OrganSelect',
  '/add-plant/analyzing':      'Analyzing',
  '/add-plant/plant-results':  'PlantResults',
  '/add-plant/plant-detail':   'AddPlantPlantDetail',
  '/add-plant/character':      'Character',
  '/add-plant/character-result': 'CharacterResult',
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
        // 인식 실패 후에도 생성 작업은 유지하고 종 선택으로 돌아간다.
        navigation.replace('AddPlantIndex');
      } else {
        const { screen, params } = resolve(to);
        navigation.replace(screen, params);
      }
    },
    back() {
      navigation.goBack();
    },
    // 생성 작업은 남겨둔 채 메인 스택의 홈으로 나간다 (캐릭터 생성 대기 화면 "나중에
    // 확인할게요"). navigate('Home')은 지금 쌓인 스택 상태(Garden 모달을 거쳐
    // 들어왔는지 등)에 따라 애매하게 동작할 수 있어(예: 이전 화면 헤더가 안 지워진
    // 채 남는 전환 잔상), replace('/')·tutorial.skip()과 같은 방식으로 스택 자체를
    // Home 하나만 남기고 통째로 갈아치운다.
    leaveToHome() {
      const mainStack = navigation.getParent('MainStack');
      (mainStack ?? navigation.getParent())?.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Home' }] })
      );
    },
  };
}

export function useLocalSearchParams<
  T extends Record<string, unknown> = Record<string, string>,
>(): Partial<T> {
  const route = useRoute();
  return ((route.params ?? {}) as unknown) as Partial<T>;
}
