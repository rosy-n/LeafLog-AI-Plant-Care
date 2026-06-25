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
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useAddPlantRouter';

import { styles } from './styles/info.styles';
import type { NewPlantPayload, NongsaroPlantDetail } from '../../types/plant';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';
const PLACEHOLDER_CHARACTER = require('../../assets/dot-character-placeholder.png');

// ── Constants ────────────────────────────────────────────────────────────────

const LOCATIONS = ['거실', '침실', '베란다', '주방', '사무실'] as const;

const LIGHT_OPTIONS = [
  { label: '직사광',     sub: '햇빛 직접' },
  { label: '밝은 간접광', sub: '창가 근처' },
  { label: '간접광',     sub: '밝은 실내' },
  { label: '어두움',     sub: '빛 적음'  },
] as const;

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
    cntntsNo?: string;
    scientificName?: string;
    commonNameKo?: string;
    nickname?: string;
    characterImageUrl?: string;
    capturedPhotoUri?: string;
    plantDetail?: string;
  }>();

  const plantDetail: NongsaroPlantDetail | null = params.plantDetail
    ? JSON.parse(params.plantDetail)
    : null;

  // Form state
  const [location, setLocation] = useState<string | null>(null);
  const [lightLevel, setLightLevel] = useState<string | null>(null);
  const [plantHeight, setPlantHeight] = useState('');
  const [potDiameter, setPotDiameter] = useState('');
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

  const handleSave = async () => {
    if (!isValid) return;
    setIsSubmitting(true);
    try {
      const payload: NewPlantPayload = {
        cntntsNo:          params.cntntsNo ?? '',
        scientificName:    params.scientificName ?? null,
        commonNameKo:      params.commonNameKo ?? '',
        nickname:          params.nickname ?? '',
        characterImageUrl: params.characterImageUrl ?? '',
        capturedPhotoUri:  params.capturedPhotoUri ?? '',
        location:          location!,
        lightLevel:        lightLevel!,
        plantHeight:       Number(plantHeight) || 0,
        potDiameter:       Number(potDiameter) || 0,
        soilNote,
        lastWateredAt:     toISODate(lastWatered) ?? new Date().toISOString(),
        lastRepottedAt:    toISODate(lastRepotted),
      };

      const res = await fetch(`${API_BASE_URL}/api/plants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);

      router.replace('/');
    } catch (e: any) {
      Alert.alert('저장 실패', e.message ?? '다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Plant header image: use PlantNet reference or 농사로 thumb
  // params.plantDetail이 "null"(문자열)일 수 있으므로 parse 후 null 체크 필수
  const headerImageUri = (() => {
    if (params.plantDetail) {
      const d: NongsaroPlantDetail | null = JSON.parse(params.plantDetail);
      if (d && d.imageUrls?.[0]?.thumb) return d.imageUrls[0].thumb;
    }
    return null;
  })();

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
            <Image source={PLACEHOLDER_CHARACTER} style={styles.plantHeaderImage} resizeMode="contain" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.plantHeaderName} numberOfLines={1}>
              {params.nickname || params.commonNameKo || '내 식물'}
            </Text>
            {plantDetail?.scientificName ? (
              <Text style={styles.plantHeaderScientific} numberOfLines={1}>
                {plantDetail.scientificName}
              </Text>
            ) : null}
          </View>
        </View>

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

        {/* 날짜 (두 날짜 나란히) */}
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

        {/* 흙 정보 */}
        <View style={styles.section}>
          <SectionLabel text="어떤 흙을 쓰셨나요? (선택)" />
          <TextInput
            style={styles.soilInput}
            placeholder="예: 분갈이흙 + 펄라이트 조금, 마사토 섞음..."
            placeholderTextColor="#A0A0A0"
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
          onPress={handleSave}
          disabled={!isValid || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
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
