import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { Colors } from "../../constants/colors";
import { Fonts, FontSizes } from "../../constants/fonts";
import { Radius } from "../../constants/spacing";
import { tapFeedback } from "../feedback";

type AppButtonProps = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AppButton({
  label,
  onPress,
  variant = "primary",
  loading = false,
  style,
}: AppButtonProps) {
  const secondary = variant === "secondary";
  const handlePress = () => {
    tapFeedback();
    onPress();
  };
  return (
    <Pressable
      disabled={loading}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        pressed && styles.pressed,
        loading && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? Colors.primary : Colors.white} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.primary,
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  buttonSecondary: {
    backgroundColor: Colors.background,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: Colors.white,
    fontFamily: Fonts.nanumSquareNeo.heavy,
    fontSize: FontSizes.subtitle,
  },
  buttonSecondaryText: {
    color: Colors.primary,
  },
  pressed: {
    opacity: 0.78,
  },
  disabled: {
    opacity: 0.7,
  },
});