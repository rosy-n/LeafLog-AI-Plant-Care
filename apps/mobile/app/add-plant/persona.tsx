import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from '../../src/hooks/useAddPlantRouter';
import {
  createPlant,
  getPersonas,
  getPlantCare,
  updatePlant,
  type PersonaOption,
} from '../../src/api';
import { scheduleWateringReminder } from '../../src/notifications';
import { useAddPlantFlow } from '../../src/AddPlantFlowContext';
import PixelSpeechBubble from '../../src/components/PixelSpeechBubble';
import { Colors } from '../../constants/colors';

import { common } from './styles/common.styles';
import { styles, BUBBLE_WIDTH } from './styles/persona.styles';
import { getCharacterImageSource } from '../../constants/character-candidates';
import PlantImage from '../../src/components/PlantImage';
import {
  CHARACTER_EXPRESSIONS,
  CHARACTER_EXPRESSION_KEYS,
  getFaceBoundsFromChecksum,
  hasFaceRemovedChecksum,
} from '../../src/data/characterExpressions';

// 페르소나별 말풍선 대사 — slug는 서버 persona_chat.PERSONA_SLUG_TO_FILE과 일치해야 한다.
// 대사 자체는 서버에 필드가 없어 앱에서만 관리하는 UI 카피.
const PERSONA_LINES: Record<string, string> = {
  SUNSHINE: '네가 올 때마다\n오늘은 또 무슨 좋은 일이 생길까\n기대하게 돼!',
  CHIC: '흥, 나도 나름 바빴거든.\n뭐 했냐고 물으면 곤란하지만.',
  RELAXED: '나도 빨리 자라고 싶을 때가 있지만\n기다리는 법을 배우는 중이야.',
  TIMID: '네가 오기 전까지\n혹시 나를 잊은 건 아닐까\n조금 걱정했어.',
  SAGE: '매일 같은 자리에 있어도\n바라보는 마음에 따라 풍경은 달라지지.',
  PLAYFUL: '나한테 관심을 한 번 주면\n장난은 두 배로 돌려줄게!',
  DILIGENT: '작은 일이라도 매일 꾸준히 하면\n어느새 꽤 큰 변화가 생겨.',
  DREAMER: '조용히 눈을 감으면\n아직 오지 않은 계절의 냄새가\n느껴지는 것 같아.',
};

export default function PersonaScreen() {
  const router = useRouter();
  const { draft, updateDraft } = useAddPlantFlow();

  const characterSource = draft.characterImageUrl
    ? { uri: draft.characterImageUrl }
    : getCharacterImageSource(draft.characterId ?? undefined);

  const [personaOptions, setPersonaOptions] = useState<PersonaOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getPersonas()
      .then((options) => {
        setPersonaOptions(options);
        // 화면 진입 시 기본값은 햇살형 — 첫 화면에서부터 대표 성격을 미리 보여준다
        setSelected('SUNSHINE');
      })
      .catch((e: any) => Alert.alert('불러오기 실패', e.message ?? '다시 시도해주세요.'))
      .finally(() => setIsLoading(false));
  }, []);

  const nickname = draft.nickname || '내 식물';
  const bubbleText = selected
    ? PERSONA_LINES[selected]
    : `"${nickname}"이(가) 어떤 성격일지\n골라주세요!`;

  const handleConfirm = async () => {
    if (!selected) return;
    if (!draft.info || !draft.characterImageUrl || !draft.nickname) {
      Alert.alert('등록 정보 확인', '입력한 식물 정보가 부족해요. 이전 단계부터 다시 확인해주세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      let plantId = draft.createdPlantId;

      if (!plantId) {
        const created = await createPlant({
          speciesId: draft.speciesId,
          cntntsNo: draft.cntntsNo,
          scientificName: draft.scientificName,
          commonNameKo: draft.commonNameKo,
          nickname: draft.nickname,
          characterImageUrl: draft.characterImageUrl,
          characterChecksum: draft.characterChecksum,
          capturedPhotoUri:
            draft.identificationPhotoUri ?? draft.capturedPhotoUri ?? '',
          location: draft.info.location,
          lightLevel: draft.info.lightLevel,
          plantHeight: draft.info.plantHeight,
          potDiameter: draft.info.potDiameter,
          potType: draft.info.potType,
          soilNote: draft.info.soilNote,
          lastWateredAt: draft.info.lastWateredAt,
          lastRepottedAt: draft.info.lastRepottedAt,
        });
        plantId = created.id;
        updateDraft({ createdPlantId: created.id });

        try {
          const care = await getPlantCare(created.id);
          await scheduleWateringReminder(
            created.id,
            created.nickname,
            care.next_watering_date,
          );
        } catch (e: any) {
          console.warn('물주기 알림 예약 실패:', e?.message);
        }
      }

      const savedPlant = await updatePlant(plantId, { persona: selected });
      const care = await getPlantCare(plantId).catch(() => null);
      router.replace({
        pathname: '/',
        params: {
          plant: {
            id: String(savedPlant.id),
            name: savedPlant.nickname,
            favorite: savedPlant.is_favorite,
            imageUri: savedPlant.character_image_url,
            characterFaceRemoved: savedPlant.character_face_removed,
            characterFaceBounds: savedPlant.character_face_bounds,
            memorial: savedPlant.status === 'DEAD',
            status: savedPlant.status,
            commonNameKo: savedPlant.common_name_ko,
            persona: savedPlant.persona,
            createdAt: savedPlant.created_at,
            wateringIntervalDays: care?.watering_interval_days ?? null,
            nextWateringDate: care?.next_watering_date ?? null,
            daysUntilWatering: care?.days_until_watering ?? null,
          },
        },
      });
    } catch (e: any) {
      Alert.alert('저장 실패', e.message ?? '다시 시도해주세요.');
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[common.title, { marginBottom: 8 }]} numberOfLines={1}>
          {nickname}의 성격을 선택해주세요
        </Text>
        <Text style={styles.subtitle}>
          {`버튼을 눌러 여러 성격을 미리 살펴보고\n${nickname}에게 어울리는 성격을 선택해주세요`}
        </Text>

        <PixelSpeechBubble
          style={styles.speechBubble}
          textStyle={styles.speechText}
          tailOffset={BUBBLE_WIDTH / 2}
        >
          {bubbleText}
        </PixelSpeechBubble>

        <PlantImage
          source={characterSource}
          expressionSource={
            hasFaceRemovedChecksum(draft.characterChecksum)
              ? CHARACTER_EXPRESSIONS[CHARACTER_EXPRESSION_KEYS.DEFAULT]
              : null
          }
          expressionBounds={getFaceBoundsFromChecksum(draft.characterChecksum)}
          style={styles.characterImage}
        />

        <View style={styles.personaGrid}>
          {personaOptions.map((option) => {
            const isActive = selected === option.slug;
            return (
              <TouchableOpacity
                key={option.slug}
                style={[common.chip, styles.personaOption, isActive && common.chipActive]}
                onPress={() => setSelected(option.slug)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    common.chipText,
                    styles.personaOptionLabel,
                    isActive && common.chipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[common.primaryBtn, !selected && common.disabledBtn]}
          onPress={handleConfirm}
          disabled={!selected || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={[common.primaryBtnText, !selected && common.disabledBtnText]}>
              저장
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
