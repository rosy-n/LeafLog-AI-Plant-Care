import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NavigationContainerRef } from '@react-navigation/native';

import PixelSpeechBubble, { WordWrapText } from './components/PixelSpeechBubble';
import { Colors } from '../constants/colors';
import { Fonts, FontSizes } from '../constants/fonts';
import { Radius, Spacing } from '../constants/spacing';

/*
    개체탭(PlantDetailScreen.jsx)의 스파 말풍선(styles.speechBubble)과 같은 가로 폭
    기준을 쓰되, 튜토리얼은 두 문장(버튼 설명 + 실제 도움)을 담아야 해서 더 크게 잡는다.
    PixelSpeechBubble은 계단형 테두리가 절대좌표 inset이라 명시적 width/height가
    없으면 부모 크기만큼 무한정 커지므로, 여기서도 고정값을 준다.
*/
const BUBBLE_WIDTH = 280;
const BUBBLE_HEIGHT = 110;

// 화면마다 스파(또는 캐릭터)가 서는 자리가 달라서 말풍선의 세로 위치도 화면별로 다르다.
// Garden은 transparentModal(네이티브 모달)로 뜨는 화면이라 이 전역 오버레이가 그
// 위로 그려지지 않는다 — GardenScreen.jsx가 자기 화면 안에서 직접 말풍선을 그린다.
const BUBBLE_TOP_BY_SCREEN: Partial<Record<TutorialScreenName, number>> = {
  Home: 300,        // 스파 머리 바로 위 (TUTORIAL_DEMO_CENTER_FY와 함께 맞춘 값)
  PlantDetail: 265,  // 개체탭 캐릭터(마운트 top 355) 머리 바로 위
};

export type TutorialSource = 'first-plant' | 'settings';
export type TutorialScreenName = 'Home' | 'Garden' | 'PlantDetail';

export type TutorialStep = {
  id: string;
  screen: TutorialScreenName;
  // 문장 배열 — 보통 [이 버튼이 뭔지, 구체적으로 어떤 기능이고 식물 기르는 데
  // 어떻게 도움되는지] 두 문장. 줄바꿈 문자로 잇지 않고 따로따로 줄을 나눠 그린다
  // (PixelSpeechBubble의 wrapWords는 공백 기준 단어 wrap이라 \n을 넣으면 레이아웃이 깨진다).
  text: string[];
  // 'bubble': 말풍선을 탭하면 다음 단계로. 'target': 화면의 실제 버튼(targetId)을
  // 눌러야 다음 단계로 — 그 버튼의 onPress가 직접 tutorial.advance()를 부른다.
  advanceOn: 'bubble' | 'target';
  // 이 단계가 가리키는 버튼 — advanceOn과 무관하게 있으면 그 버튼 배경색이 바뀐다.
  // 'bubble' 단계에서도 "이 버튼 얘기예요"를 보여주기 위해 쓴다(눌러도 진행은 안 됨).
  targetId?: string;
};

// 튜토리얼 순서 문서의 "2. 홈화면" 단계
const HOME_STEPS: TutorialStep[] = [
  {
    id: 'home-intro',
    screen: 'Home',
    text: ['안녕하세요, 저는 스파예요!', 'LeafLog 이곳저곳을 소개해드릴게요.'],
    advanceOn: 'bubble',
  },
  {
    id: 'home-weather',
    screen: 'Home',
    text: [
      '여기는 날씨랑 미세먼지를 알려주는 버튼이에요.',
      '오늘 물을 줘도 괜찮을지, 환기를 시켜도 좋을지 미리 확인할 수 있어요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-weather',
  },
  {
    id: 'home-notif',
    screen: 'Home',
    text: [
      '여기는 알림 버튼이에요.',
      '물 줄 때가 되거나 식물에 문제가 생기면 알려줘서 돌봄 시기를 놓치지 않게 도와줘요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-notif',
  },
  {
    id: 'home-diary-calendar',
    screen: 'Home',
    text: [
      '여기는 캘린더랑 일지 버튼이에요.',
      '물 준 날이나 식물의 변화를 기록해두면 다음에 돌볼 때 큰 도움이 돼요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-diary-calendar',
  },
  {
    id: 'home-settings',
    screen: 'Home',
    text: [
      '여기는 설정 버튼이에요.',
      '알림 시간이나 소리를 바꿀 수 있고, 나중에 여기서 저를 다시 불러 튜토리얼을 볼 수도 있어요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-settings',
  },
  {
    id: 'home-garden-button',
    screen: 'Home',
    text: [
      '이건 정원으로 가는 버튼이에요.',
      '눌러서 기르는 식물들을 한눈에 모아 보고, 새 식물도 등록할 수 있어요.',
    ],
    advanceOn: 'target',
    targetId: 'home-garden-button',
  },
];

// 이파리 버튼으로 들어간 정원탭 — 데모 식물 3개와 함께 소개한다
const GARDEN_STEPS: TutorialStep[] = [
  {
    id: 'garden-intro',
    screen: 'Garden',
    text: [
      '여기가 정원이에요.',
      '기르는 식물들을 한눈에 모아 보고, 물 줄 때가 지난 아이도 바로 확인할 수 있어요.',
    ],
    advanceOn: 'bubble',
  },
  {
    id: 'garden-add',
    screen: 'Garden',
    text: [
      '이건 새 식물을 추가하는 버튼이에요.',
      '사진 한 장으로 나만의 도트 캐릭터를 만들어서 새 식구로 등록할 수 있어요.',
    ],
    advanceOn: 'bubble',
    targetId: 'garden-add',
  },
  {
    id: 'garden-close',
    screen: 'Garden',
    text: ['이 창은 아래로 끌어내려서 닫을 수 있어요.', '한번 끌어내려서 홈으로 돌아가볼까요?'],
    advanceOn: 'target',
    targetId: 'garden-close',
  },
];

// 정원을 닫고 홈으로 돌아온 뒤 이어지는 롱프레스 단계 — 스텝 배열 어디서든
// 이 id로 바로 이동할 수 있어야 해서(goToStep) 별도로 뺐다.
const HOME_LONGPRESS_STEP: TutorialStep = {
  id: 'home-longpress',
  screen: 'Home',
  text: ['저를 길게 눌러보세요.', '이렇게 들어서 돋보기에 놓으면 저를 자세히 볼 수 있는 개체탭으로 갈 수 있어요.'],
  advanceOn: 'target',
  targetId: 'home-longpress',
};

// 튜토리얼 순서 문서의 "3. 개체탭" 단계
const PLANT_STEPS: TutorialStep[] = [
  {
    id: 'plant-intro',
    screen: 'PlantDetail',
    text: ['여기는 개체탭이에요.', '저를 자세히 돌보고 이야기 나눌 수 있는 곳이죠.'],
    advanceOn: 'bubble',
  },
  {
    id: 'plant-resource',
    screen: 'PlantDetail',
    text: [
      '왼쪽 위는 물주기랑 영양제까지 남은 날짜예요.',
      '숫자가 0이 되면 줘야 할 때라는 뜻이라, 돌봄 시기를 놓치지 않을 수 있어요.',
    ],
    advanceOn: 'bubble',
    targetId: 'plant-resource',
  },
  {
    id: 'plant-water',
    screen: 'PlantDetail',
    text: ['이건 물주기 버튼이에요.', '정해진 주기마다 눌러서 물을 주면 제가 건강하게 자랄 수 있어요.'],
    advanceOn: 'target',
    targetId: 'plant-water',
  },
  {
    id: 'plant-hearts-intro',
    screen: 'PlantDetail',
    text: ['오른쪽 위는 애정도예요.', '저를 예뻐해줄수록 하트가 하나씩 채워져요.'],
    advanceOn: 'bubble',
    targetId: 'plant-hearts',
  },
  {
    id: 'plant-hearts',
    screen: 'PlantDetail',
    text: ['저를 쓰다듬어 보세요!', '화면을 문지르듯 만지면 돼요.'],
    advanceOn: 'target',
    targetId: 'plant-hearts',
  },
  {
    id: 'plant-hearts-outcome',
    screen: 'PlantDetail',
    text: ['애정도가 차오르면 좋은 일이 생겨요.', '저를 꾸며줄 수 있는 액세서리 아이템들이 단계별로 하나씩 열려요.'],
    advanceOn: 'bubble',
    targetId: 'plant-hearts',
  },
  {
    id: 'plant-counsel',
    screen: 'PlantDetail',
    text: [
      '이건 병해충 상담 버튼이에요.',
      '잎이 이상하거나 벌레가 보일 때 사진을 찍어 물어보면 AI가 원인과 해결법을 알려줘요.',
    ],
    advanceOn: 'bubble',
    targetId: 'plant-counsel',
  },
  {
    id: 'plant-chat',
    screen: 'PlantDetail',
    text: ['이건 저와 대화하는 버튼이에요.', '궁금한 걸 물어보거나 이야기를 나누면서 저와 더 친해질 수 있어요.'],
    advanceOn: 'bubble',
    targetId: 'plant-chat',
  },
  {
    id: 'plant-hamburger',
    screen: 'PlantDetail',
    text: ['이건 더 많은 기능이 모여있는 메뉴 버튼이에요.', '눌러서 안에 뭐가 있는지 같이 볼까요?'],
    advanceOn: 'target',
    targetId: 'plant-hamburger',
  },
  {
    id: 'plant-menu-profile',
    screen: 'PlantDetail',
    text: ['여기서는 제 프로필을 볼 수 있어요.', '이름이나 저와 함께한 지 며칠째인지 같은 정보를 확인할 수 있어요.'],
    advanceOn: 'bubble',
    targetId: 'menu-profile',
  },
  {
    id: 'plant-menu-decorate',
    screen: 'PlantDetail',
    text: ['여기서는 저를 꾸며줄 수 있어요.', '애정도로 얻은 아이템들로 제 모습을 자유롭게 꾸며보세요.'],
    advanceOn: 'bubble',
    targetId: 'menu-decorate',
  },
  {
    id: 'plant-menu-care',
    screen: 'PlantDetail',
    text: ['여기서는 저를 돌보는 방법을 알려줘요.', '빛, 온습도처럼 저를 잘 키우기 위한 정보를 볼 수 있어요.'],
    advanceOn: 'bubble',
    targetId: 'menu-care',
  },
  {
    id: 'plant-menu-sensor',
    screen: 'PlantDetail',
    text: ['여기서는 우리 집 환경 데이터를 볼 수 있어요.', '온도, 습도 같은 정보로 제가 지내기 좋은 환경인지 확인해요.'],
    advanceOn: 'bubble',
    targetId: 'menu-sensor',
  },
  {
    id: 'plant-menu-repot',
    screen: 'PlantDetail',
    text: ['여기서는 분갈이 기록을 남길 수 있어요.', '화분을 바꿔줄 때마다 기록해두면 다음 시기를 가늠할 수 있어요.'],
    advanceOn: 'bubble',
    targetId: 'menu-repot',
  },
  {
    id: 'plant-menu-nutrient',
    screen: 'PlantDetail',
    text: ['여기서는 영양제 준 기록을 남길 수 있어요.', '제때 챙겨주면 제가 더 튼튼하게 자랄 수 있어요.'],
    advanceOn: 'bubble',
    targetId: 'menu-nutrient',
  },
  {
    id: 'plant-home',
    screen: 'PlantDetail',
    text: ['이건 홈으로 돌아가는 버튼이에요.', '눌러서 홈 화면으로 돌아가 볼까요?'],
    advanceOn: 'target',
    targetId: 'plant-home',
  },
];

const FULL_STEPS: TutorialStep[] = [
  ...HOME_STEPS,
  ...GARDEN_STEPS,
  HOME_LONGPRESS_STEP,
  ...PLANT_STEPS,
];

const STEPS_BY_SOURCE: Record<TutorialSource, TutorialStep[]> = {
  'first-plant': FULL_STEPS,
  settings: FULL_STEPS,
};

type TutorialContextValue = {
  active: boolean;
  source: TutorialSource | null;
  currentStep: TutorialStep | null;
  // 첫 단계인지 — 말풍선을 눌러야 진행된다는 안내를 이때만 한 번 보여준다
  isFirstStep: boolean;
  // advanceOn: 'target' 단계에서만 값이 있다 — 화면이 이 값으로 자기 버튼을 하이라이트한다
  currentTargetId: string | null;
  start: (source: TutorialSource) => void;
  advance: () => void;
  // 특정 단계 id로 바로 이동 — 정원을 몇 번째 안내 단계에서 닫든 항상 롱프레스
  // 단계로 돌아가야 하는 것처럼, 선형(advance)이 아닌 분기가 필요할 때 쓴다.
  goToStep: (stepId: string) => void;
  skip: () => void;
  end: () => void;
  navigateRoot: (screen: string, params?: object) => void;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({
  children,
  navigationRef,
}: {
  children: ReactNode;
  navigationRef: RefObject<NavigationContainerRef<any> | null>;
}) {
  const [active, setActive] = useState(false);
  const [source, setSource] = useState<TutorialSource | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = source ? STEPS_BY_SOURCE[source] : [];
  const currentStep = active ? steps[stepIndex] ?? null : null;

  const navigateRoot = useCallback(
    (screen: string, params?: object) => {
      // 루트 스택 화면 이름은 문자열로만 관리되어 있어 여기선 느슨하게 받는다
      (navigationRef.current?.navigate as (name: string, params?: object) => void)?.(
        screen,
        params,
      );
    },
    [navigationRef],
  );

  const start = useCallback((nextSource: TutorialSource) => {
    setSource(nextSource);
    setStepIndex(0);
    setActive(true);
  }, []);

  const end = useCallback(() => {
    setActive(false);
    setSource(null);
    setStepIndex(0);
  }, []);

  const skip = useCallback(() => {
    // 개체탭(데모) 단계에서 건너뛰면 그 화면에 스파 데모 상태로 남지 않도록 홈으로 되돌린다
    end();
    navigateRoot('Home');
  }, [end, navigateRoot]);

  const advance = useCallback(() => {
    setStepIndex((prev) => {
      const next = prev + 1;
      // 마지막 단계 이후엔 각 화면의 plant-home 핸들러가 end()/navigateRoot()를
      // 직접 호출해 마무리하므로, 여기선 안전망으로 범위만 넘지 않게 막는다.
      return next >= steps.length ? prev : next;
    });
  }, [steps.length]);

  const goToStep = useCallback(
    (stepId: string) => {
      const index = steps.findIndex((step) => step.id === stepId);
      if (index >= 0) setStepIndex(index);
    },
    [steps],
  );

  const value = useMemo<TutorialContextValue>(
    () => ({
      active,
      source,
      currentStep,
      isFirstStep: stepIndex === 0,
      currentTargetId: currentStep?.targetId ?? null,
      start,
      advance,
      goToStep,
      skip,
      end,
      navigateRoot,
    }),
    [active, source, currentStep, stepIndex, start, advance, goToStep, skip, end, navigateRoot],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const value = useContext(TutorialContext);
  if (!value) {
    throw new Error('useTutorial must be used inside TutorialProvider.');
  }
  return value;
}

/*
    NavigationContainer의 형제로 한 번만 마운트하는 전역 오버레이 — 어느 화면이
    떠 있든 항상 최상단에 말풍선을 띄운다. advanceOn: 'bubble' 단계는 말풍선 자체가
    탭 영역이고, 'target' 단계는 설명만 띄우고 실제 진행은 해당 화면의 하이라이트된
    버튼이 처리한다. pointerEvents="box-none"이라 말풍선 밖 터치는 아래 화면으로
    그대로 통과한다.
*/
/*
    말풍선(+ 첫 단계 사용법 안내) 한 덩어리 — 절대좌표는 호출하는 쪽이 감싸는
    View의 style로 정한다. GardenScreen처럼 화면 안에서 직접 그려야 하는 경우와
    TutorialBubbleOverlay(전역)가 이 컴포넌트를 공유해서 쓴다.
*/
export function TutorialBubbleGroup() {
  const tutorial = useTutorial();
  if (!tutorial.active || !tutorial.currentStep) return null;

  const { text, advanceOn } = tutorial.currentStep;
  const bubbleContent = (
    <PixelSpeechBubble
      style={styles.bubbleFill}
      contentStyle={styles.bubbleContent}
      tailOffset={BUBBLE_WIDTH / 2}
    >
      {text.map((line, index) => (
        <WordWrapText key={index} text={line} style={styles.bubbleText} />
      ))}
    </PixelSpeechBubble>
  );

  return (
    <View style={styles.bubbleGroup}>
      {/* 맨 처음 한 번만 — 말풍선 위에, 배경 없이 글자만으로 사용법을 안내한다 */}
      {tutorial.isFirstStep && advanceOn === 'bubble' && (
        <Text style={styles.usageHintText} pointerEvents="none">
          💬 아래 '다음' 버튼을 눌러 진행해요
        </Text>
      )}
      {advanceOn === 'bubble' ? (
        <TouchableOpacity activeOpacity={0.85} onPress={tutorial.advance}>
          {bubbleContent}
        </TouchableOpacity>
      ) : (
        <View pointerEvents="none">{bubbleContent}</View>
      )}
    </View>
  );
}

/*
    "다음" 버튼 — 말풍선이 화면 위쪽에 있어 매번 손을 뻗어 탭하기 불편하다는
    피드백으로 추가했다. 엄지가 편한 하단에 두고, 설명만 하는 단계(advanceOn:
    'bubble')에서만 뜬다 — target 단계는 실제 버튼/제스처를 직접 해봐야 넘어간다.
    말풍선 자체를 탭해도 여전히 넘어가지만, 이제 주로 쓰는 통로는 이 버튼이다.
*/
export function TutorialNextButton() {
  const tutorial = useTutorial();
  if (!tutorial.active || tutorial.currentStep?.advanceOn !== 'bubble') return null;
  return (
    <TouchableOpacity style={styles.nextBtn} activeOpacity={0.85} onPress={tutorial.advance}>
      <Text style={styles.nextBtnText}>다음 ▶</Text>
    </TouchableOpacity>
  );
}

// "튜토리얼 건너뛰기" — 마찬가지로 위치는 호출하는 쪽이 정한다.
export function TutorialSkipButton() {
  const tutorial = useTutorial();
  if (!tutorial.active) return null;
  return (
    <TouchableOpacity
      onPress={tutorial.skip}
      activeOpacity={0.8}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={styles.closeBtnText}>튜토리얼 건너뛰기</Text>
    </TouchableOpacity>
  );
}

/*
    NavigationContainer의 형제로 한 번만 마운트하는 전역 오버레이 — Home·PlantDetail처럼
    보통 프레젠테이션으로 뜨는 화면 위에는 이 오버레이가 정상적으로 그려진다.

    Garden은 presentation: "transparentModal"로 뜨는 화면이라 iOS에서 별도의 네이티브
    모달 레이어로 올라가는데, 이 오버레이는 그 모달 바깥(원래 창)에 속해 있어서 모달
    아래에 가려져 버린다(실제로 정원탭에서 말풍선이 안 보였던 원인). 그래서 Garden
    단계에서는 이 전역 오버레이를 아예 그리지 않고, GardenScreen.jsx가
    TutorialBubbleGroup/TutorialSkipButton을 자기 화면 트리 안에서 직접 그린다.
*/
export function TutorialBubbleOverlay() {
  const tutorial = useTutorial();
  if (!tutorial.active || !tutorial.currentStep) return null;
  if (tutorial.currentStep.screen === 'Garden') return null;

  const bubbleTop = BUBBLE_TOP_BY_SCREEN[tutorial.currentStep.screen] ?? BUBBLE_TOP_BY_SCREEN.Home!;

  return (
    // 개체탭의 speechBubble과 같은 SafeAreaView(top/left/right) 기준으로 잡아야
    // top이 같은 기준(안전영역 아래)을 가리킨다. bottom도 넣어 건너뛰기 버튼이
    // 홈 인디케이터 위에 안전하게 뜬다.
    <SafeAreaView
      style={styles.root}
      edges={['top', 'left', 'right', 'bottom']}
      pointerEvents="box-none"
    >
      <View style={[styles.bubbleGroupPosition, { top: bubbleTop }]} pointerEvents="box-none">
        <TutorialBubbleGroup />
      </View>
      {/* 최하단 중앙 — 엄지가 닿기 편한 자리에 다음/건너뛰기를 모아둔다 */}
      <View style={styles.bottomActionsRow} pointerEvents="box-none">
        <TutorialNextButton />
        <TutorialSkipButton />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // 전역 오버레이(Home/PlantDetail) 전용 — TutorialBubbleGroup을 원하는 top에 배치
  bubbleGroupPosition: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  // 사용법 안내(있으면) + 말풍선을 세로로 쌓는다 — 안내가 항상 말풍선 "위"에 온다
  bubbleGroup: {
    alignItems: 'center',
  },
  bubbleFill: {
    width: BUBBLE_WIDTH,
    height: BUBBLE_HEIGHT,
  },
  bubbleContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xxs,
  },
  bubbleText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    lineHeight: 18,
    color: Colors.textBlack,
  },
  // 배경 없이 글자만 — color.ts의 배경색으로 쓰는 연두(Colors.background)
  usageHintText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.background,
    marginBottom: Spacing.xs,
  },
  bottomActionsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  nextBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  nextBtnText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.body,
    color: Colors.white,
  },
  closeBtnText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.small,
    color: Colors.disabled,
  },
});
