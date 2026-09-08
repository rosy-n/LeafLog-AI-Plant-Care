import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NavigationContainerRef } from '@react-navigation/native';

import PixelSpeechBubble, { WordWrapText } from './components/PixelSpeechBubble';
import { Colors, GreenTint } from '../constants/colors';
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
  Home: 280,        // 스파 머리 위, 살짝 더 띄운 값 (TUTORIAL_DEMO_CENTER_FY와 함께 맞춤)
  PlantDetail: 250,  // 개체탭 캐릭터(마운트 top 355) 머리 위, 살짝 더 띄운 값
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

/*
    개체탭 햄버거 메뉴가 열려 화면 왼쪽을 가리는 동안(plant-hamburger ~ 각
    plant-menu-* 설명 단계)인지 — 이때는 스파·다음 버튼·말풍선을 다 같이
    오른쪽으로 비켜준다. TutorialBubbleGroup(꼬리 위치)과 TutorialBubbleOverlay
    (가로 이동)가 같은 판정을 써야 해서 한 곳에 둔다.
*/
function isPlantMenuStep(step: TutorialStep | null): boolean {
  if (!step || step.screen !== 'PlantDetail') return false;
  return step.id === 'plant-hamburger' || step.id.startsWith('plant-menu-');
}

// 문장 하나를 읽는 데 적당한 시간 — 너무 촘촘하면 못 읽고, 너무 길면 늘어진다.
// 글자 수에 비례하되, 짧은 문장도 최소 이만큼은 떠 있게 한다.
const MIN_READ_MS = 1200;
const READ_MS_PER_CHAR = 70;
const readDelayFor = (line: string) => Math.max(MIN_READ_MS, line.length * READ_MS_PER_CHAR);

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
      '왼쪽 위는 날씨랑 미세먼지를 알려주는 버튼이에요.',
      '오늘 물을 줘도 괜찮을지, 환기를 시켜도 좋을지 미리 확인할 수 있어요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-weather',
  },
  {
    id: 'home-notif',
    screen: 'Home',
    text: [
      '오른쪽 위는 알림 버튼이에요.',
      '물 줄 때가 되거나 식물에 문제가 생기면 알려줘서 돌봄 시기를 놓치지 않게 도와줘요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-notif',
  },
  {
    id: 'home-diary-calendar',
    screen: 'Home',
    text: [
      '오른쪽 아래는 캘린더랑 일지 버튼이에요.',
      '물 준 날이나 식물의 변화를 기록해두면 다음에 돌볼 때 큰 도움이 돼요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-diary-calendar',
  },
  {
    id: 'home-settings',
    screen: 'Home',
    text: [
      '왼쪽 아래는 설정으로 가는 버튼이에요.',
      '알림 시간이나 소리를 바꿀 수 있고, 나중에 여기서 저를 다시 불러 튜토리얼을 볼 수도 있어요.',
    ],
    advanceOn: 'bubble',
    targetId: 'home-settings',
  },
  {
    id: 'home-garden-button',
    screen: 'Home',
    text: [
      '오른쪽 아래 이파리 모양 버튼은 정원으로 가는 버튼이에요.',
      '눌러서 기르는 식물들을 한눈에 모아 보고, 새 식물도 등록할 수 있어요.',
      '눌러볼까요?',
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
      '오른쪽 아래 + 버튼은 새 식물을 추가하는 버튼이에요.',
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
    text: ['여기는 개체탭이에요.', '식물을 자세히 돌보고 이야기 나눌 수 있는 곳이죠.'],
    advanceOn: 'bubble',
  },
  {
    id: 'plant-resource',
    screen: 'PlantDetail',
    text: [
      '왼쪽 위는 물주기랑 영양제까지 남은 날짜예요.',
      '숫자가 0이 되면 줘야 할 때라는 뜻이라, 물주기를 놓치지 않을 수 있어요.',
    ],
    advanceOn: 'bubble',
    targetId: 'plant-resource',
  },
  {
    id: 'plant-water',
    screen: 'PlantDetail',
    text: [
      '오른쪽 아래는 물주기 버튼이에요.',
      '정해진 주기마다 눌러서 물을 주면 제가 건강하게 자랄 수 있어요.',
      '물주기 버튼을 눌러보세요.',
    ],
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
      '오른쪽 아래는 병해충 상담 버튼이에요.',
      '잎이 이상하거나 벌레가 보일 때 사진을 찍어 물어보면 AI가 원인과 해결법을 알려줘요.',
    ],
    advanceOn: 'bubble',
    targetId: 'plant-counsel',
  },
  {
    id: 'plant-chat',
    screen: 'PlantDetail',
    text: ['오른쪽 아래는 저와 대화하는 버튼이에요.', '궁금한 걸 물어보거나 이야기를 나누면서 저와 더 친해질 수 있어요.'],
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
    text: ['왼쪽 아래는 홈으로 돌아가는 버튼이에요.', '눌러서 홈 화면으로 돌아가 볼까요?'],
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
  // advanceOn: 'target' 단계에서만 값이 있다 — 화면이 이 값으로 자기 버튼을 하이라이트한다
  currentTargetId: string | null;
  start: (source: TutorialSource) => void;
  advance: () => void;
  // 특정 단계 id로 바로 이동 — 정원을 몇 번째 안내 단계에서 닫든 항상 롱프레스
  // 단계로 돌아가야 하는 것처럼, 선형(advance)이 아닌 분기가 필요할 때 쓴다.
  goToStep: (stepId: string) => void;
  skip: () => void;
  end: () => void;
  // 마지막 단계(개체탭 홈 버튼)를 실제로 끝까지 마쳤을 때 쓴다 — end()처럼 상태를
  // 정리하면서, 잠깐 떴다 사라지는 완료 메시지도 함께 띄운다. 중간에 건너뛴
  // 경우(skip)에는 "끝냈다"고 축하할 일이 아니라서 완료 메시지를 띄우지 않는다.
  complete: () => void;
  // complete() 직후 잠깐 떠 있는 완료 메시지 — 없으면 null
  completionMessage: string | null;
  navigateRoot: (screen: string, params?: object) => void;
  // 지금 몇 번째 문장을 보여주고 있는지(1부터) — 두 문장짜리 단계는 한 번에
  // 하나씩만 보여주고(교체 방식) 시간차를 두고 다음 문장으로 넘어간다.
  revealedLineIndex: number;
  // 마지막 문장까지 나오고, 그것도 읽을 만큼 시간이 지났는지 — "다음" 버튼과
  // 말풍선 탭 진행 둘 다 이게 true일 때만 동작한다(문장이 뜨자마자 넘어가지 않게).
  canAdvance: boolean;
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
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);
  const completionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 지금 단계의 몇 번째 문장을 보여줄지(1부터). 단계가 바뀌면 1로 되돌아가고,
  // 문장이 두 개면 첫 문장을 적당히 읽었을 시간 뒤에 2로 넘어간다.
  const [revealedLineIndex, setRevealedLineIndex] = useState(1);
  // 마지막 문장까지 나오고 그것도 읽을 시간이 지나야 true — "다음" 버튼은 문장이
  // 뜨자마자가 아니라 이때 뜬다.
  const [canAdvance, setCanAdvance] = useState(false);

  const steps = source ? STEPS_BY_SOURCE[source] : [];
  const currentStep = active ? steps[stepIndex] ?? null : null;
  const stepId = currentStep?.id ?? null;

  /*
      단계가 바뀌면 revealedLineIndex/canAdvance를 리셋해야 하는데, 이걸
      useEffect에서 하면 문제가 생긴다 — effect는 커밋 다음 틱에야 실행되므로,
      stepIndex가 바뀐 바로 그 렌더에서는 currentStep은 이미 새 단계인데
      revealedLineIndex/canAdvance는 아직 이전 단계의 값 그대로다. 그 한 프레임
      동안 "새 단계의 엉뚱한 줄"이 잠깐 보이거나(문장이 갑자기 바뀌어 보이는 원인),
      새 단계가 bubble 타입인데 이전 단계에서 남은 canAdvance=true 때문에 "다음"
      버튼이 잠깐 떴다 사라지는 원인이 된다.

      React가 지원하는 "렌더 도중 상태 조정" 패턴으로 고친다 — 렌더 중에 이전
      stepId와 다르면 즉시 리셋해버리고, React가 그 즉시 다시 렌더하게 한다.
      그러면 currentStep이 바뀌는 바로 그 렌더에서부터 항상 값이 맞다.
  */
  const prevStepIdRef = useRef<string | null>(null);
  if (prevStepIdRef.current !== stepId) {
    prevStepIdRef.current = stepId;
    if (revealedLineIndex !== 1) setRevealedLineIndex(1);
    if (canAdvance !== false) setCanAdvance(false);
  }

  useEffect(() => {
    if (!currentStep) return;

    // 문장이 몇 개든(2개든 CTA까지 3개든) 한 번에 하나씩만 보여주고, 각 문장을
    // 읽을 시간만큼 지날 때마다 다음 문장으로 교체한다. 마지막 문장까지 그만큼
    // 지나야 "다음"이 켜진다 — 마지막 문장이 뜨자마자 넘어갈 수 있으면 못 읽는다.
    const lines = currentStep.text;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    lines.forEach((line, index) => {
      elapsed += readDelayFor(line);
      const isLast = index === lines.length - 1;
      timers.push(
        setTimeout(() => {
          if (isLast) setCanAdvance(true);
          else setRevealedLineIndex(index + 2);
        }, elapsed),
      );
    });

    return () => timers.forEach(clearTimeout);
    // currentStep 전체가 아니라 id가 바뀔 때만 다시 재야 한다 — 매 렌더 새로
    // 만들어지는 객체 참조를 deps로 쓰면 타이머가 계속 리셋된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepId]);

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

  /*
      설정에서 시작한 튜토리얼을 건너뛰면 원래 어느 화면(정원 모달, 개체탭 등)에
      있었든 상관없이 즉시 홈으로 보내야 한다. navigate('Home')은 "그 경로로
      이동/pop"이라 지금 쌓인 스택 상태에 따라 느리거나 애매하게 동작할 수 있어서,
      reset으로 스택 자체를 홈 하나만 남기고 통째로 갈아치운다 — 더 빠르고 확실하다.
  */
  const returnHome = useCallback(() => {
    navigationRef.current?.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigationRef]);

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
    // 어느 화면(정원 모달·개체탭 등)에서 건너뛰든 즉시 홈 하나만 남기고 되돌린다
    end();
    returnHome();
  }, [end, returnHome]);

  const complete = useCallback(() => {
    end();
    // 이모지 넣지 말 것 — 계속 지워달라는 요청이 있었다
    setCompletionMessage('튜토리얼이 끝났어요!\n이제 정원에서 식물들을 길러봐요');
    if (completionTimerRef.current) clearTimeout(completionTimerRef.current);
    completionTimerRef.current = setTimeout(() => setCompletionMessage(null), 2600);
  }, [end]);

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
      currentTargetId: currentStep?.targetId ?? null,
      start,
      advance,
      goToStep,
      skip,
      end,
      complete,
      completionMessage,
      navigateRoot,
      revealedLineIndex,
      canAdvance,
    }),
    [
      active,
      source,
      currentStep,
      stepIndex,
      start,
      advance,
      goToStep,
      skip,
      end,
      complete,
      completionMessage,
      navigateRoot,
      revealedLineIndex,
      canAdvance,
    ],
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
  // 문장이 바뀔 때마다(첫 문장 → 둘째 문장 교체 포함) 살짝 페이드인 — 순간적으로
  // 뚝 바뀌지 않게 한다.
  const lineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    lineOpacity.setValue(0);
    Animated.timing(lineOpacity, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [tutorial.currentStep?.id, tutorial.revealedLineIndex, lineOpacity]);

  if (!tutorial.active || !tutorial.currentStep) return null;

  const { text, advanceOn } = tutorial.currentStep;
  // 문장을 동시에 두 개 다 보여주면 가독성이 떨어진다 — 지금 보여줄 한 문장만
  // 꺼내 쓰고(교체 방식), 이전 문장은 화면에서 완전히 사라진다.
  const currentLine = text[tutorial.revealedLineIndex - 1] ?? text[0] ?? '';
  // 개체탭 햄버거 메뉴가 열려 왼쪽을 가리는 동안엔 꼬리도 함께 오른쪽으로 기울인다
  const tailOffset = isPlantMenuStep(tutorial.currentStep)
    ? BUBBLE_WIDTH / 2 + 40
    : BUBBLE_WIDTH / 2;
  const bubbleContent = (
    <PixelSpeechBubble style={styles.bubbleFill} contentStyle={styles.bubbleContent} tailOffset={tailOffset}>
      <Animated.View style={{ opacity: lineOpacity }}>
        <WordWrapText text={currentLine} style={styles.bubbleText} />
      </Animated.View>
    </PixelSpeechBubble>
  );

  return (
    <View style={styles.bubbleGroup}>
      {advanceOn === 'bubble' ? (
        // 문장을 다 보여주기 전엔 눌러도 다음으로 안 넘어간다 — 둘째 문장이
        // 뜨기도 전에 건너뛰지 않도록
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!tutorial.canAdvance}
          onPress={tutorial.advance}
        >
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
  // 마지막 문장까지 나오고 그것도 읽을 시간이 지나야 "다음"이 뜬다
  if (!tutorial.active || tutorial.currentStep?.advanceOn !== 'bubble' || !tutorial.canAdvance) {
    return null;
  }
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
    튜토리얼을 끝까지 마쳤을 때(complete()) 잠깐 떴다 사라지는 완료 메시지.
    active가 이미 false로 꺼진 뒤에도 completionMessage는 잠깐 살아있어야 해서
    TutorialBubbleOverlay와 별개로, App.js에 항상 마운트해 둔다.
*/
export function TutorialCompletionToast() {
  const tutorial = useTutorial();
  if (!tutorial.completionMessage) return null;
  return (
    <View style={styles.completionToastRoot} pointerEvents="none">
      <View style={styles.completionToast}>
        <Text style={styles.completionToastText}>{tutorial.completionMessage}</Text>
      </View>
    </View>
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
  // 개체탭 햄버거 메뉴가 왼쪽에 열려 있는 동안엔 말풍선도 같이 오른쪽으로 비켜준다
  const bubbleShiftX = isPlantMenuStep(tutorial.currentStep) ? 50 : 0;

  return (
    // 개체탭의 speechBubble과 같은 SafeAreaView(top/left/right) 기준으로 잡아야
    // top이 같은 기준(안전영역 아래)을 가리킨다. bottom도 넣어 건너뛰기 버튼이
    // 홈 인디케이터 위에 안전하게 뜬다.
    <SafeAreaView
      style={styles.root}
      edges={['top', 'left', 'right', 'bottom']}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bubbleGroupPosition,
          { top: bubbleTop, transform: [{ translateX: bubbleShiftX }] },
        ]}
        pointerEvents="box-none"
      >
        <TutorialBubbleGroup />
      </View>
      {/*
          개체탭은 "다음" 버튼을 화면 중앙(이름표 자리)에서 자체적으로 그린다
          (PlantDetailScreen.jsx) — 여기서 또 그리면 두 개가 뜬다.
      */}
      {tutorial.currentStep.screen !== 'PlantDetail' && (
        <View style={styles.nextBtnRow} pointerEvents="box-none">
          <TutorialNextButton />
        </View>
      )}
      {/* 최하단 중앙 — "다음"과는 확실히 떨어뜨려서 잘못 누르지 않게 한다 */}
      <View style={styles.skipBtnRow} pointerEvents="box-none">
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
  // "다음"과 "건너뛰기" 사이를 확실히 띄워 잘못 누르지 않게 한다
  nextBtnRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 100,
    alignItems: 'center',
  },
  skipBtnRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Spacing.xxl,
    alignItems: 'center',
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
  completionToastRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  // 검정 반투명 대신, Colors.primary와 같은 톤이지만 82% 불투명한 GreenTint.deep을
  // 써서 화면과 좀 더 자연스럽게 섞이게 한다
  completionToast: {
    backgroundColor: GreenTint.deep,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderRadius: Radius.lg,
  },
  completionToastText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: FontSizes.bodyLarge,
    lineHeight: 22,
    color: Colors.white,
    textAlign: 'center',
  },
});
