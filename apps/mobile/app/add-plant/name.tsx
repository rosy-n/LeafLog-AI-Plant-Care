import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { common } from './styles/common.styles';
import { styles } from './styles/name.styles';

const MAX_LENGTH = 8;

// TODO: FLUX 연동 시 characterImageUrl param으로 교체. assets/dot-character-placeholder.png 필요.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PLACEHOLDER_CHARACTER = require('../../assets/dot-character-placeholder.png');

export default function NameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [nickname, setNickname] = useState('');

  const isValid = nickname.trim().length > 0;

  const handleConfirm = () => {
    router.push({
      pathname: '/add-plant/info',
      params: { ...params, nickname: nickname.trim() },
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.container}>
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
            onSubmitEditing={isValid ? handleConfirm : undefined}
          />
          <Text style={styles.charCount}>{nickname.length}/{MAX_LENGTH}</Text>
        </View>

        <View style={styles.spacer} />

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
    </KeyboardAvoidingView>
  );
}
