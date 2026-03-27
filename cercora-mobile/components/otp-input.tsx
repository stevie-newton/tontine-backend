import React, { useMemo } from "react";
import { StyleProp, StyleSheet, TextInput, TextStyle, View, ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandColors } from "@/constants/brand";
import { useI18n } from "@/hooks/use-i18n";

type OtpInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  length?: number;
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

function onlyDigits(value: string) {
  return value.replace(/\D+/g, "");
}

export function OtpInput({
  value,
  onChangeText,
  placeholder,
  length = 6,
  containerStyle,
  inputStyle,
}: OtpInputProps) {
  const { t } = useI18n();
  const digits = useMemo(() => onlyDigits(value).slice(0, length), [length, value]);
  const slots = useMemo(
    () => Array.from({ length }, (_, index) => digits[index] ?? ""),
    [digits, length]
  );

  return (
    <View style={containerStyle}>
      <TextInput
        value={digits}
        onChangeText={(nextValue) => onChangeText(onlyDigits(nextValue).slice(0, length))}
        placeholder={placeholder}
        placeholderTextColor="#98A2B3"
        keyboardType="number-pad"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        selectionColor={BrandColors.blue}
        style={[styles.hiddenInput, inputStyle]}
      />

      <View pointerEvents="none" style={styles.slotsRow}>
        {slots.map((digit, index) => {
          const isFilled = Boolean(digit);
          const isNext = !isFilled && index === digits.length;

          return (
            <View
              key={`otp-slot-${index}`}
              style={[
                styles.slot,
                isFilled ? styles.slotFilled : null,
                isNext ? styles.slotActive : null,
              ]}
            >
              <ThemedText style={[styles.slotText, isFilled ? styles.slotTextFilled : null]}>
                {digit || "•"}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <ThemedText style={styles.helperText}>
        {digits.length
          ? t("{{count}} of {{total}} digits entered", { count: digits.length, total: length })
          : t("Enter the full {{count}}-digit code", { count: length })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: 58,
    zIndex: 2,
  },
  slotsRow: {
    flexDirection: "row",
    gap: 10,
  },
  slot: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  slotFilled: {
    borderColor: "rgba(42,109,230,0.32)",
    backgroundColor: "#F7FAFF",
  },
  slotActive: {
    borderColor: BrandColors.blue,
    backgroundColor: "#EEF4FF",
  },
  slotText: {
    color: "#B0BACF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  slotTextFilled: {
    color: BrandColors.blueDeep,
  },
  helperText: {
    marginTop: 8,
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
