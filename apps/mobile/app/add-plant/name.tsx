import {
  Image,
  Keyboard,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from '../../src/hooks/useAddPlantRouter';

import { common } from './styles/common.styles';
import { styles } from './styles/name.styles';

const MAX_LENGTH = 8;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PLACEHOLDER_CHARACTER = require('../../assets/dot-character-placeholder.png');

export default function NameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [nickname, setNickname] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);

  // Android: 키보드 높이를 직접 추적해 paddingBottom 추가 + 스크롤 이동
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => scrollRef.current?.scrollTo({ y: 250, animated: true }), 100);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const isValid = nickname.trim().length > 0;

  const handleConfirm = () => {
    router.push({
      pathname: '/add-plant/info',
      params: { ...params, nickname: nickname.trim() },
    });
  };

  return (
    <View style={styles.root}>
      {/*
        KeyboardAvoidingView 없음 → 버튼이 절대 움직이지 않음.
        iOS: automaticallyAdjustKeyboardInsets가 ScrollView contentInset을 키보드 높이만큼 자동 조정,
             TextInput autoFocus 시 시스템이 자동으로 스크롤.
        Android: kbHeight로 paddingBottom을 늘려 스크롤 가능 상태로 만들고 수동 scrollTo.
      */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[
          styles.scrollContent,
          kbHeight > 0 && { paddingBottom: kbHeight },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // @ts-ignore — iOS 전용 prop, 타입 정의 누락된 경우 대비
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        <Image
          source={PLACEHOLDER_CHARACTER}
          style={styles.characterImage}
          resizeMode="contain"
        />

        <Text style={common.title} numberOfLines={1}>이름을 붙여주세요</Text>

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="이름 입력"
            placeholderTextColor="#A0A0A0"
            value={nickname}
            onChangeText={setNickname}
            maxLength={MAX_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
          />
          <Text style={styles.charCount}>{nickname.length}/{MAX_LENGTH}</Text>
        </View>
      </ScrollView>

      {/* 버튼: root View의 자식 → 키보드·스크롤 어떤 상태에도 하단 고정 */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.confirmBtn, !isValid && styles.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!isValid}
          activeOpacity={0.8}
        >
          <Text style={[styles.confirmBtnText, !isValid && styles.confirmBtnTextDisabled]}>
            확인
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}