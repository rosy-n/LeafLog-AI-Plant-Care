import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';
import type { NewPlantPayload } from '../../types/plant';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

const LOCATIONS = ['거실', '침실', '베란다', '주방', '사무실'];
const LIGHT_LEVELS = ['직사광', '밝은 간접광', '간접광', '어두움'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}.${m}.${d}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <Text style={styles.sectionLabel}>
      {text}
      {required && <Text style={styles.requiredMark}> *</Text>}
    </Text>
  );
}

function SelectGroup({
  options,
  value,
  onSelect,
}: {
  options: string[];
  value: string | null;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={styles.selectGroup}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.selectBtn, value === opt && styles.selectBtnActive]}
          onPress={() => onSelect(opt)}
          activeOpacity={0.8}
        >
          <Text style={[styles.selectBtnText, value === opt && styles.selectBtnTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DatePickerField({
  value,
  onSelect,
}: {
  value: Date | null;
  onSelect: (date: Date) => void;
}) {
  const [show, setShow] = useState(false);
  const current = value ?? new Date();

  const handleChange = (_: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setShow(false);
    if (picked) onSelect(picked);
  };

  return (
    <View>
      <TouchableOpacity style={styles.dateBtn} onPress={() => setShow(true)} activeOpacity={0.8}>
        <Text style={[styles.dateBtnText, !value && styles.dateBtnPlaceholder]}>
          {value ? formatDate(value) : '날짜 선택'}
        </Text>
        <Text style={styles.dateIcon}>📅</Text>
      </TouchableOpacity>

      {/* iOS: Modal + spinner */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerSheet}>
              <TouchableOpacity style={styles.pickerDoneRow} onPress={() => setShow(false)}>
                <Text style={styles.pickerDoneText}>완료</Text>
              </TouchableOpacity>
              <DateTimePicker
                value={current}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={handleChange}
                locale="ko"
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Android: native dialog */}
      {Platform.OS !== 'ios' && show && (
        <DateTimePicker
          value={current}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={handleChange}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function InfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    cntntsNo?: string;
    scientificName?: string;
    commonNameKo?: string;
    nickname?: string;
    characterImageUrl?: string;
    capturedPhotoUri?: string;
  }>();

  const [location, setLocation] = useState<string | null>(null);
  const [lightLevel, setLightLevel] = useState<string | null>(null);
  const [plantHeight, setPlantHeight] = useState('');
  const [potDiameter, setPotDiameter] = useState('');
  const [soilNote, setSoilNote] = useState('');
  const [lastWateredAt, setLastWateredAt] = useState<Date | null>(null);
  const [lastRepottedAt, setLastRepottedAt] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = Boolean(location && lightLevel);

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      const payload: NewPlantPayload = {
        cntntsNo: params.cntntsNo ?? '',
        scientificName: params.scientificName || null,
        commonNameKo: params.commonNameKo ?? '',
        nickname: params.nickname ?? '',
        characterImageUrl: params.characterImageUrl ?? '',
        capturedPhotoUri: params.capturedPhotoUri ?? '',
        location: location!,
        lightLevel: lightLevel!,
        plantHeight: Number(plantHeight) || 0,
        potDiameter: Number(potDiameter) || 0,
        soilNote,
        lastWateredAt: (lastWateredAt ?? new Date()).toISOString(),
        lastRepottedAt: lastRepottedAt?.toISOString() ?? null,
      };

      const res = await fetch(`${API_BASE_URL}/api/plants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`서버 오류 (${res.status})`);

      router.replace('/');
    } catch (e: any) {
      Alert.alert(
        '저장 실패',
        e.message ?? '식물을 저장하는 중 문제가 발생했어요. 다시 시도해주세요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Text style={styles.title}>마지막으로{'\n'}정보를 입력해주세요</Text>

        {/* 위치 */}
        <View style={styles.section}>
          <SectionLabel text="위치" required />
          <SelectGroup options={LOCATIONS} value={location} onSelect={setLocation} />
        </View>

        {/* 햇빛 */}
        <View style={styles.section}>
          <SectionLabel text="햇빛" required />
          <SelectGroup options={LIGHT_LEVELS} value={lightLevel} onSelect={setLightLevel} />
        </View>

        {/* 식물 길이 */}
        <View style={styles.section}>
          <SectionLabel text="식물 길이" />
          <View style={styles.numericWrapper}>
            <TextInput
              style={styles.numericInput}
              placeholder="0"
              placeholderTextColor={Colors.textGray}
              value={plantHeight}
              onChangeText={setPlantHeight}
              keyboardType="numeric"
              maxLength={3}
            />
            <Text style={styles.unit}>cm</Text>
          </View>
        </View>

        {/* 화분 지름 */}
        <View style={styles.section}>
          <SectionLabel text="화분 지름" />
          <View style={styles.numericWrapper}>
            <TextInput
              style={styles.numericInput}
              placeholder="0"
              placeholderTextColor={Colors.textGray}
              value={potDiameter}
              onChangeText={setPotDiameter}
              keyboardType="numeric"
              maxLength={2}
            />
            <Text style={styles.unit}>cm</Text>
          </View>
        </View>

        {/* 흙 정보 */}
        <View style={styles.section}>
          <SectionLabel text="흙 정보" />
          <TextInput
            style={styles.soilInput}
            placeholder="사용한 흙이나 배합 비율을 적어두세요 (선택)"
            placeholderTextColor={Colors.textGray}
            value={soilNote}
            onChangeText={setSoilNote}
            maxLength={100}
            multiline
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{soilNote.length}/100</Text>
        </View>

        {/* 마지막 물 준 날 */}
        <View style={styles.section}>
          <SectionLabel text="마지막 물 준 날" />
          <DatePickerField value={lastWateredAt} onSelect={setLastWateredAt} />
        </View>

        {/* 마지막 분갈이 날 */}
        <View style={styles.section}>
          <SectionLabel text="마지막 분갈이 날" />
          <DatePickerField value={lastRepottedAt} onSelect={setLastRepottedAt} />
        </View>

        {/* 완료 버튼 */}
        <TouchableOpacity
          style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || isSubmitting}
          activeOpacity={0.8}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={[styles.submitBtnText, !isValid && styles.submitBtnTextDisabled]}>
              완료
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: 32,
  },

  // section
  section: { marginBottom: 28 },
  sectionLabel: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 14,
    color: Colors.textBlack,
    marginBottom: 10,
  },
  requiredMark: { color: Colors.primary },

  // select group
  selectGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  selectBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    backgroundColor: Colors.white,
  },
  selectBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
  selectBtnText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
  },
  selectBtnTextActive: { color: Colors.white },

  // numeric input
  numericWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    minWidth: 120,
  },
  numericInput: {
    height: 48,
    fontSize: 16,
    color: Colors.textBlack,
    minWidth: 60,
  },
  unit: { fontSize: 14, color: Colors.textGray, marginLeft: 4 },

  // soil note
  soilInput: {
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: Colors.textBlack,
    minHeight: 88,
  },
  charCount: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 12,
    color: Colors.textGray,
    textAlign: 'right',
    marginTop: 4,
  },

  // date picker
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    paddingHorizontal: 14,
    height: 48,
  },
  dateBtnText: {
    fontSize: 15,
    color: Colors.textBlack,
    fontFamily: Fonts.neoDunggeunmo,
  },
  dateBtnPlaceholder: { color: Colors.textGray },
  dateIcon: { fontSize: 18 },

  // iOS date picker modal
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
  },
  pickerDoneRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  pickerDoneText: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 15,
    color: Colors.primary,
  },

  // submit button
  submitBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: { backgroundColor: '#D8D8D8' },
  submitBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },
  submitBtnTextDisabled: { color: Colors.textGray },
});
