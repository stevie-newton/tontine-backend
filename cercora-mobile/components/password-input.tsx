import React, { useMemo, useState } from "react";
import { Pressable, StyleProp, StyleSheet, TextInput, TextStyle, View, ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandColors } from "@/constants/brand";
import { useI18n } from "@/hooks/use-i18n";

type PasswordMode = "signin" | "create";

type PasswordInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  mode?: PasswordMode;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

function getPasswordScore(value: string) {
  let score = 0;

  if (value.length >= 8) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  return score;
}

export function PasswordInput({
  value,
  onChangeText,
  placeholder,
  mode = "signin",
  containerStyle,
  inputStyle,
}: PasswordInputProps) {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);
  const score = useMemo(() => getPasswordScore(value), [value]);
  const shouldShowStrength = mode === "create";

  const strengthTone =
    score >= 4 ? styles.strengthStrong : score >= 2 ? styles.strengthMedium : styles.strengthWeak;
  const strengthLabel =
    score >= 4
      ? t("Strong password")
      : score >= 2
        ? t("Getting stronger")
        : t("Add a little more security");

  return (
    <View style={containerStyle}>
      <View style={styles.field}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#98A2B3"
          secureTextEntry={!isVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={mode === "signin" ? "password" : "new-password"}
          textContentType={mode === "signin" ? "password" : "newPassword"}
          returnKeyType="done"
          selectionColor={BrandColors.blue}
          style={[styles.input, inputStyle]}
        />

        <Pressable
          style={({ pressed }) => [styles.toggleButton, pressed ? styles.toggleButtonPressed : null]}
          onPress={() => setIsVisible((current) => !current)}
        >
          <ThemedText style={styles.toggleText}>
            {isVisible ? t("Hide") : t("Show")}
          </ThemedText>
        </Pressable>
      </View>

      {shouldShowStrength ? (
        <View style={styles.metaRow}>
          <ThemedText style={styles.metaText}>
            {value ? t("Password strength") : t("Create a password you will remember")}
          </ThemedText>
          <View style={[styles.strengthPill, strengthTone]}>
            <ThemedText style={styles.strengthText}>
              {value ? strengthLabel : t("8+ characters")}
            </ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.92)",
    minHeight: 58,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 10,
  },
  input: {
    flex: 1,
    color: BrandColors.ink,
    fontSize: 15,
    paddingVertical: 14,
  },
  toggleButton: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(16,36,72,0.07)",
  },
  toggleButtonPressed: {
    opacity: 0.72,
  },
  toggleText: {
    color: BrandColors.blueDeep,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  metaText: {
    flex: 1,
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  strengthPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  strengthWeak: {
    backgroundColor: BrandColors.warningBg,
  },
  strengthMedium: {
    backgroundColor: "#EEF4FF",
  },
  strengthStrong: {
    backgroundColor: BrandColors.successBg,
  },
  strengthText: {
    color: BrandColors.inkSoft,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});
