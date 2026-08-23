import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { Colors } from '../../constants/colors';
import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useAddPlantRouter';
import { createPlant, getPlant, getPlantCare, refreshPlant } from '../../src/api';
import { scheduleRefreshReminder, scheduleWateringReminder } from '../../src/notifications';

import { styles } from './styles/info.styles';
import type { NewPlantPayload } from '../../types/plant';
import { getCharacterImageSource } from '../../constants/character-candidates';

// ── Constants ────────────────────────────────────────────────────────────────

const LOCATIONS = ['거실', '침실', '베란다', '주방', '사무실'] as const;

// 화분 종류 — plant.pot_type(자유 텍스트)에 라벨 그대로 저장
const POT_TYPES = ['플라스틱', '토분', '도자기', '시멘트', '유리', '기타'] as const;

// UI 한글 라벨 → 서버 enum 코드 (plant.location_name CHECK 제약과 일치)
const LOCATION_CODES: Record<string, string> = {
  거실: 'LIVING_ROOM',
  침실: 'BEDROOM',
  베란다: 'BALCONY',
  주방: 'KITCHEN',
  사무실: 'OFFICE',
};

const LIGHT_OPTIONS = [
  { label: '직사광',     sub: '햇빛 직접', code: 'DIRECT'   },
  { label: '밝은 간접광', sub: '창가 근처', code: 'BRIGHT'   },
  { label: '간접광',     sub: '밝은 실내', code: 'INDIRECT' },
  { label: '어두움',     sub: '빛 적음',  code: 'LOW'      },
] as const;

// 광량 한글 라벨 → 서버 enum 코드 (plant.light_condition CHECK 제약과 일치)
const LIGHT_CODE_BY_LABEL: Record<string, string> = Object.fromEntries(
  LIGHT_OPTIONS.map((o) => [o.label, o.code]),
);

// 저장된 값을 폼에 되돌려 채우기 위한 역방향 표 (갱신 모드).
// 표를 따로 적지 않고 위 정의에서 뒤집어 만든다 — 손으로 두 번 적으면 어긋난다.
const LOCATION_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  Object.entries(LOCATION_CODES).map(([label, code]) => [code, label]),
);
const LIGHT_LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  LIGHT_OPTIONS.map((o) => [o.code, o.label]),
);

// 서버는 화분 지름·식물 길이를 자유 텍스트(VARCHAR)로 들고 있다 —
// "30", "30cm" 같은 값이 섞일 수 있어 숫자만 남겨 스테퍼에 넣는다
function toDigits(value: string | null | undefined): string {
  if (!value) return '';
  const digits = String(value).replace(/[^0-9]/g, '');
  return digits;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const DAYS   = Array.from({ length: 31 }, (_, i) => i + 1);

type MonthDay = { month: number; day: number } | null;

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={styles.sectionLabel}>
      {text}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
  );
}

function Stepper({
  value,
  onChange,
  unit,
  min = 1,
  max = 999,
}: {
  value: string;
  onChange: (v: string) => void;
  unit: string;
  min?: number;
  max?: number;
}) {
  const num = parseInt(value, 10) || 0;

  const decrement = () => {
    if (num > min) onChange(String(num - 1));
  };
  const increment = () => {
    if (num < max) onChange(String(num + 1));
  };

  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.stepperBtn} onPress={decrement} activeOpacity={0.7}>
        <Text style={styles.stepperBtnText}>−</Text>
      </TouchableOpacity>
      <View style={styles.stepperValueWrap}>
        <TextInput
          style={styles.stepperInput}
          value={value}
          onChangeText={(t) => {
            const n = parseInt(t.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(n)) onChange(String(Math.min(max, Math.max(min, n))));
            else if (t === '') onChange('');
          }}
          keyboardType="numeric"
          maxLength={3}
          selectTextOnFocus
        />
        <Text style={styles.stepperUnit}>{unit}</Text>
      </View>
      <TouchableOpacity style={styles.stepperBtn} onPress={increment} activeOpacity={0.7}>
        <Text style={styles.stepperBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

type PickerTarget = 'water-month' | 'water-day' | 'repot-month' | 'repot-day';

function DatePairPicker({
  label,
  value,
  onMonthPress,
  onDayPress,
}: {
  label: string;
  value: MonthDay;
  onMonthPress: () => void;
  onDayPress: () => void;
}) {
  return (
    <View style={styles.dateBlock}>
      <Text style={styles.dateBlockLabel}>{label}</Text>
      <View style={styles.datePickerRow}>
        <TouchableOpacity style={styles.dateDropdown} onPress={onMonthPress} activeOpacity={0.8}>
          <Text style={[styles.dateDropdownText, !value && styles.dateDropdownPlaceholder]}>
            {value ? `${value.month}월` : '월'}
          </Text>
          <Text style={styles.dateDropdownArrow}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateDropdown} onPress={onDayPress} activeOpacity={0.8}>
          <Text style={[styles.dateDropdownText, !value && styles.dateDropdownPlaceholder]}>
            {value ? `${value.day}일` : '일'}
          </Text>
          <Text style={styles.dateDropdownArrow}>▾</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function InfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    speciesId?: string;
    cntntsNo?: string;
    scientificName?: string;
    commonNameKo?: string;
    nickname?: string;
    characterId?: string;
    characterImageUrl?: string;
    characterChecksum?: string;
    capturedPhotoUri?: string;
    // 종 마스터의 대표 이미지 (plant-detail 단계에서 전달)
    imageUrl?: string;
    // 월 1회 갱신으로 들어왔을 때만 있다 → 새 개체를 만들지 않고 기존 개체를 갱신한다
    plantId?: string;
  }>();

  // 갱신 모드 — 기존 값을 채워서 보여주고, 사용자가 고친 것만 바뀐 채로 저장한다.
  // 등록과 같은 폼을 쓰는 이유: 묻는 항목이 같고, 화면이 두 벌이면 한쪽만 고쳐진다.
  const isRefresh = Boolean(params.plantId);
  const plantId = params.plantId ? Number(params.plantId) : null;

  // Form state
  const [location, setLocation] = useState<string | null>(null);
  const [lightLevel, setLightLevel] = useState<string | null>(null);
  const [plantHeight, setPlantHeight] = useState('');
  const [potDiameter, setPotDiameter] = useState('');
  const [potType, setPotType] = useState<string | null>(null);
  const todayDate = new Date();
  const [lastWatered, setLastWatered] = useState<MonthDay>({
    month: todayDate.getMonth() + 1,
    day: todayDate.getDate(),
  });
  const [lastRepotted, setLastRepotted] = useState<MonthDay>(null);
  const [soilNote, setSoilNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Picker modal state
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  // 갱신 모드에서 화면에 보여줄 기존 개체 정보 (헤더의 이름·캐릭터에도 쓴다)
  const [isPrefilling, setIsPrefilling] = useState(isRefresh);
  const [saved, setSaved] = useState<{
    nickname: string;
    scientificName: string | null;
    characterImageUrl: string | null;
  } | null>(null);

  /*
      갱신 모드 진입 시 저장된 값을 폼에 채운다.

      route params 로 넘겨받지 않고 서버에서 다시 읽는 이유: 알림을 눌러 들어오면
      들고 있는 개체 정보가 목록 스냅샷뿐이라 화분·크기 같은 항목이 없다.
      갱신은 "지금 저장된 값"을 보여주는 것이 요점이므로 한 번 조회하는 편이 정확하다.
  */
  useEffect(() => {
    if (plantId === null) return;
    let alive = true;
    getPlant(plantId)
      .then((detail) => {
        if (!alive) return;
        setLocation(
          detail.location_name ? LOCATION_LABEL_BY_CODE[detail.location_name] ?? null : null,
        );
        setLightLevel(
          detail.light_condition ? LIGHT_LABEL_BY_CODE[detail.light_condition] ?? null : null,
        );
        setPlantHeight(toDigits(detail.height));
        setPotDiameter(toDigits(detail.pot_size));
        setPotType(detail.pot_type ?? null);
        setSoilNote(detail.soil_type ?? '');
        setSaved({
          nickname: detail.nickname,
          scientificName: detail.scientific_name,
          characterImageUrl: detail.character_image_url,
        });
      })
      .catch((e: any) =>
        Alert.alert('불러오기 실패', e?.message ?? '다시 시도해주세요.'),
      )
      .finally(() => {
        if (alive) setIsPrefilling(false);
      });
    return () => {
      alive = false;
    };
  }, [plantId]);

  const isValid = Boolean(location && lightLevel);

  const openPicker = (target: PickerTarget) => setPickerTarget(target);
  const closePicker = () => setPickerTarget(null);

  const handlePickerSelect = (value: number) => {
    if (!pickerTarget) return;
    if (pickerTarget === 'water-month') {
      setLastWatered((prev) => ({ month: value, day: prev?.day ?? 1 }));
    } else if (pickerTarget === 'water-day') {
      setLastWatered((prev) => ({ month: prev?.month ?? new Date().getMonth() + 1, day: value }));
    } else if (pickerTarget === 'repot-month') {
      setLastRepotted((prev) => ({ month: value, day: prev?.day ?? 1 }));
    } else if (pickerTarget === 'repot-day') {
      setLastRepotted((prev) => ({ month: prev?.month ?? new Date().getMonth() + 1, day: value }));
    }
    closePicker();
  };

  const pickerItems = pickerTarget?.endsWith('month') ? MONTHS : DAYS;
  const pickerTitle = pickerTarget?.endsWith('month') ? '월 선택' : '일 선택';

  const getSelectedPickerValue = (): number | null => {
    if (!pickerTarget) return null;
    if (pickerTarget === 'water-month') return lastWatered?.month ?? null;
    if (pickerTarget === 'water-day')   return lastWatered?.day   ?? null;
    if (pickerTarget === 'repot-month') return lastRepotted?.month ?? null;
    if (pickerTarget === 'repot-day')   return lastRepotted?.day   ?? null;
    return null;
  };

  // Build ISO date string from MonthDay (assumes current year)
  const toISODate = (md: MonthDay): string | null => {
    if (!md) return null;
    const year = new Date().getFullYear();
    const m = String(md.month).padStart(2, '0');
    const d = String(md.day).padStart(2, '0');
    return new Date(`${year}-${m}-${d}T00:00:00.000Z`).toISOString();
  };

  // 월 1회 갱신 저장 — 개체 정보와 (다시 만들었다면) 새 캐릭터를 한 번에 보낸다.
  // 등록과 달리 물주기/분갈이 기록은 건드리지 않는다 (아래 날짜 입력을 감추는 이유와 같다).
  const handleRefresh = async () => {
    if (!isValid || plantId === null) return;
    setIsSubmitting(true);
    try {
      const updated = await refreshPlant(plantId, {
        location: LOCATION_CODES[location!] ?? '',
        lightLevel: LIGHT_CODE_BY_LABEL[lightLevel!] ?? '',
        plantHeight: Number(plantHeight) || 0,
        potDiameter: Number(potDiameter) || 0,
        potType: potType ?? '',
        soilNote,
        // 캐릭터를 다시 만들지 않고 건너뛰었으면 비어 있다 → 기존 캐릭터가 유지된다
        characterImageUrl: params.characterImageUrl ?? '',
        characterChecksum: params.characterChecksum ?? '',
      });

      // 다음 달 갱신 알림을 다시 예약한다. 여기서 안 하면 앱을 다시 켤 때
      // (전체 동기화)까지 기기에는 방금 지나간 예정일이 남는다.
      try {
        await scheduleRefreshReminder(
          updated.id,
          updated.nickname,
          updated.next_refresh_reminder_date,
        );
      } catch (e: any) {
        // 알림 예약 실패가 갱신을 되돌리지는 않는다
        console.warn('갱신 알림 예약 실패:', e?.message);
      }

      // 갱신을 마치면 개체탭으로 — 방금 바뀐 모습을 바로 확인하는 자리다
      router.replace({
        pathname: '/',
        params: {
          plant: {
            id: String(updated.id),
            name: updated.nickname,
            favorite: updated.is_favorite,
            imageUri: updated.character_image_url,
            memorial: updated.status === 'DEAD',
            commonNameKo: updated.common_name_ko,
            persona: updated.persona,
            createdAt: updated.created_at,
          },
        },
      });
    } catch (e: any) {
      Alert.alert('갱신 실패', e.message ?? '다시 시도해주세요.');
      setIsSubmitting(false);
    }
  };

  const handleSave = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      const payload: NewPlantPayload = {
        // 종 마스터에서 고른 종이면 id 를 그대로 넘긴다.
        // 없으면(카메라 인식 결과가 마스터에 없는 경우) 서버가 학명/국명으로 종을 만든다.
        speciesId:         params.speciesId ? Number(params.speciesId) : null,
        cntntsNo:          params.cntntsNo ?? '',
        scientificName:    params.scientificName ?? null,
        commonNameKo:      params.commonNameKo ?? '',
        nickname:          params.nickname ?? '',
        characterImageUrl: params.characterImageUrl ?? '',
        characterChecksum: params.characterChecksum ?? '',
        capturedPhotoUri:  params.capturedPhotoUri ?? '',
        location:          LOCATION_CODES[location!] ?? '',
        lightLevel:        LIGHT_CODE_BY_LABEL[lightLevel!] ?? '',
        plantHeight:       Number(plantHeight) || 0,
        potDiameter:       Number(potDiameter) || 0,
        potType:           potType ?? '',
        soilNote,
        lastWateredAt:     toISODate(lastWatered) ?? new Date().toISOString(),
        lastRepottedAt:    toISODate(lastRepotted),
      };

      const created = await createPlant(payload);

      // 물주기 알림 예약 — 등록이 알림의 첫 접점이다.
      // 여기서 안 하면 앱을 다시 켤 때(전체 동기화)까지 알림이 잡히지 않는다.
      try {
        const care = await getPlantCare(created.id);
        await scheduleWateringReminder(
          created.id,
          created.nickname,
          care.next_watering_date,
        );
      } catch (e: any) {
        // 알림 예약 실패가 등록을 막지 않게 한다
        console.warn('물주기 알림 예약 실패:', e?.message);
      }

      // 페르소나(성격)는 plant_id가 있어야 저장 가능 → 식물 생성 후 다음 단계에서 선택
      router.push({
        pathname: '/add-plant/persona',
        params: {
          plantId: String(created.id),
          nickname: created.nickname,
          createdAt: created.created_at,
          characterId: params.characterId ?? '',
          characterImageUrl: params.characterImageUrl ?? '',
        },
      });
    } catch (e: any) {
      Alert.alert('저장 실패', e.message ?? '다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /*
      헤더 이미지 우선순위.
        등록: 종 마스터 대표 이미지 → 사용자가 찍은 사진 → 2단계에서 고른 도트 캐릭터
        갱신: 방금 다시 만든 캐릭터 → 지금 쓰고 있는 캐릭터
      갱신에서 종 대표 이미지를 쓰지 않는 이유 — 지금 이 개체가 어떻게 보이는지가
      확인해야 할 정보이고, 종의 표본 사진은 그 판단에 도움이 되지 않는다.
  */
  const headerImageUri = isRefresh
    ? params.characterImageUrl || saved?.characterImageUrl || null
    : params.imageUrl || null;
  const characterSource = getCharacterImageSource(params.characterId);

  const headerName = isRefresh
    ? saved?.nickname || params.nickname || '내 식물'
    : params.nickname || params.commonNameKo || '내 식물';
  const headerScientific = isRefresh
    ? saved?.scientificName ?? null
    : params.scientificName ?? null;

  if (isPrefilling) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Plant header */}
        <View style={styles.plantHeader}>
          {headerImageUri ? (
            <Image source={{ uri: headerImageUri }} style={styles.plantHeaderImage} resizeMode="cover" />
          ) : params.capturedPhotoUri ? (
            <Image source={{ uri: params.capturedPhotoUri }} style={styles.plantHeaderImage} resizeMode="cover" />
          ) : (
            <Image source={characterSource} style={styles.plantHeaderImage} resizeMode="contain" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.plantHeaderName} numberOfLines={1}>
              {headerName}
            </Text>
            {headerScientific ? (
              <Text style={styles.plantHeaderScientific} numberOfLines={1}>
                {headerScientific}
              </Text>
            ) : null}
          </View>
        </View>

        {isRefresh && (
          <Text style={styles.refreshHint}>
            지금 저장된 정보를 그대로 채워 뒀어요.{'\n'}
            한 달 사이 달라진 것만 고치고 저장하면 돼요.
          </Text>
        )}

        {/* 위치 */}
        <View style={styles.section}>
          <SectionLabel text="어디에 두셨나요?" required />
          <View style={styles.chipGroup}>
            {LOCATIONS.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.chip, location === loc && styles.chipActive]}
                onPress={() => setLocation(loc)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipLabel, location === loc && styles.chipLabelActive]}>
                  {loc}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 햇빛 */}
        <View style={styles.section}>
          <SectionLabel text="햇빛은 어느 정도 들어오나요?" required />
          <View style={styles.chipGroup}>
            {LIGHT_OPTIONS.map(({ label, sub }) => (
              <TouchableOpacity
                key={label}
                style={[styles.chip, lightLevel === label && styles.chipActive]}
                onPress={() => setLightLevel(label)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipLabel, lightLevel === label && styles.chipLabelActive]}>
                  {label}
                </Text>
                <Text style={[styles.chipSub, lightLevel === label && styles.chipSubActive]}>
                  {sub}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 식물 길이 */}
        <View style={styles.section}>
          <SectionLabel text={`식물 길이${plantHeight ? ` — ${plantHeight}cm` : ''}`} />
          <Stepper value={plantHeight} onChange={setPlantHeight} unit="cm" max={300} />
        </View>

        {/* 화분 지름 */}
        <View style={styles.section}>
          <SectionLabel text={`화분 지름${potDiameter ? ` — ${potDiameter}cm` : ''}`} />
          <Stepper value={potDiameter} onChange={setPotDiameter} unit="cm" max={100} />
        </View>

        {/* 화분 종류 */}
        <View style={styles.section}>
          <SectionLabel text="화분 종류는 무엇인가요?" />
          <View style={styles.chipGroup}>
            {POT_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.chip, potType === type && styles.chipActive]}
                onPress={() => setPotType((prev) => (prev === type ? null : type))}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipLabel, potType === type && styles.chipLabelActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/*
            날짜 (두 날짜 나란히) — 등록에서만 묻는다.
            갱신에서 다시 물으면 같은 물주기·분갈이가 care_record 에 한 번 더 쌓여
            일정과 기록이 어긋난다. 이 두 날짜는 개체탭의 물주기 버튼과 분갈이탭이
            각각 관리하는 값이고, 갱신이 확인하려는 것은 화분·크기 같은 개체 정보다.
        */}
        {!isRefresh && (
        <View style={styles.section}>
          <View style={styles.dateRow}>
            <DatePairPicker
              label="마지막으로 물 준 날"
              value={lastWatered}
              onMonthPress={() => openPicker('water-month')}
              onDayPress={() => openPicker('water-day')}
            />
            <DatePairPicker
              label="분갈이 한 날"
              value={lastRepotted}
              onMonthPress={() => openPicker('repot-month')}
              onDayPress={() => openPicker('repot-day')}
            />
          </View>
        </View>
        )}

        {/* 흙 정보 */}
        <View style={styles.section}>
          <SectionLabel text="어떤 흙을 쓰셨나요? (선택)" />
          <TextInput
            style={styles.soilInput}
            placeholder="예: 분갈이흙 + 펄라이트 조금, 마사토 섞음..."
            placeholderTextColor={Colors.textFaint}
            value={soilNote}
            onChangeText={setSoilNote}
            maxLength={80}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{soilNote.length}/80</Text>
        </View>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
          onPress={isRefresh ? handleRefresh : handleSave}
          disabled={!isValid || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={[styles.saveBtnText, !isValid && styles.saveBtnTextDisabled]}>
              저장
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Month / Day picker modal */}
      <Modal
        visible={pickerTarget !== null}
        transparent
        animationType="slide"
        onRequestClose={closePicker}
      >
        <TouchableOpacity style={styles.pickerBackdrop} activeOpacity={1} onPress={closePicker}>
          <TouchableOpacity activeOpacity={1} onPress={() => {}}>
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{pickerTitle}</Text>
                <TouchableOpacity onPress={closePicker}>
                  <Text style={styles.pickerDoneText}>완료</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 240 }}>
                {pickerItems.map((item) => {
                  const isSelected = getSelectedPickerValue() === item;
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                      onPress={() => handlePickerSelect(item)}
                    >
                      <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextSelected]}>
                        {pickerTarget?.endsWith('month') ? `${item}월` : `${item}일`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}
