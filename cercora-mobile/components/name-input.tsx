import React, { useMemo } from "react";
import { StyleProp, StyleSheet, TextInput, TextStyle, View, ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { BrandColors } from "@/constants/brand";

type NameInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  placeholderTextColor?: string;
  statusText?: string;
  statusTone?: "neutral" | "success" | "warning";
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
};

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) {
    return "Aa";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function NameInput({
  value,
  onChangeText,
  placeholder,
  placeholderTextColor = "#98A2B3",
  statusText,
  statusTone = "neutral",
  containerStyle,
  inputStyle,
}: NameInputProps) {
  const initials = useMemo(() => getInitials(value), [value]);

  return (
    <View style={containerStyle}>
      <View style={styles.field}>
        <View style={styles.initialsBadge}>
          <ThemedText style={styles.initialsText}>{initials}</ThemedText>
        </View>

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          selectionColor={BrandColors.blue}
          style={[styles.input, inputStyle]}
        />
      </View>

      {statusText ? (
        <ThemedText
          style={[
            styles.statusText,
            statusTone === "success" ? styles.statusTextSuccess : null,
            statusTone === "warning" ? styles.statusTextWarning : null,
          ]}
        >
          {statusText}
        </ThemedText>
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
    paddingLeft: 12,
    paddingRight: 14,
    minHeight: 58,
    gap: 12,
  },
  initialsBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(42,109,230,0.12)",
  },
  initialsText: {
    color: BrandColors.blueDeep,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: "800",
  },
  input: {
    flex: 1,
    color: BrandColors.ink,
    fontSize: 15,
    paddingVertical: 14,
  },
  statusText: {
    marginTop: 6,
    color: BrandColors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  statusTextSuccess: {
    color: BrandColors.successText,
    fontWeight: "700",
  },
  statusTextWarning: {
    color: BrandColors.warningText,
    fontWeight: "700",
  },
});
