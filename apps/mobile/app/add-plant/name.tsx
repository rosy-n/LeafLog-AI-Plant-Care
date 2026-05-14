import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Colors } from '../../constants/colors';
import { Fonts } from '../../constants/fonts';

const MAX_LENGTH = 8;

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

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
        <Text style={styles.title}>식물에게{'\n'}이름을 붙여줄까요?</Text>

        {/* Input row */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="이름 입력"
            placeholderTextColor={Colors.textGray}
            value={nickname}
            onChangeText={setNickname}
            maxLength={MAX_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={isValid ? handleConfirm : undefined}
          />
          <Text style={styles.charCount}>
            {nickname.length}/{MAX_LENGTH}
          </Text>
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  title: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 22,
    color: Colors.textBlack,
    lineHeight: 32,
    marginBottom: 36,
  },

  // input
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    height: 52,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 18,
    color: Colors.textBlack,
  },
  charCount: {
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 13,
    color: Colors.textGray,
    marginLeft: 8,
  },

  spacer: {
    flex: 1,
  },

  // confirm button
  confirmBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: '#D8D8D8',
  },
  confirmBtnText: {
    color: Colors.white,
    fontFamily: Fonts.neoDunggeunmo,
    fontSize: 16,
  },
  confirmBtnTextDisabled: {
    color: Colors.textGray,
  },
});
