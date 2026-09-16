import React from "react";
import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import { ThemedText } from "@/components/themed-text";
import { BrandColors } from "@/constants/brand";
import { Fonts } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

export function useSurfaceColors() {
  const dark = useColorScheme() === "dark";
  return {
    background: dark ? "#0D1530" : "#F5F7FB",
    surface: dark ? "#18233D" : "#FFFFFF",
    border: dark ? "#2C3953" : "#E4E9F1",
    muted: dark ? "#AFBDD4" : "#586982",
    track: dark ? "#2C3953" : "#E8EEF8",
    accent: dark ? "#91BAFF" : BrandColors.blue,
  };
}
export const AppTypography = StyleSheet.create({
  heading: { fontFamily: Fonts.sans, fontSize: 28, lineHeight: 35, fontWeight: "700", letterSpacing: -0.7 },
  section: { fontFamily: Fonts.sans, fontSize: 20, lineHeight: 27, fontWeight: "700", letterSpacing: -0.3 },
  body: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24 },
  caption: { fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
});
export function AppCard({ style, ...props }: ViewProps) {
  const colors = useSurfaceColors();
  return <View {...props} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]} />;
}
export function AppButton({ label, onPress, secondary = false, disabled = false }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  const colors = useSurfaceColors();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: secondary ? colors.track : BrandColors.blue, opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}><ThemedText style={[styles.buttonText, { color: secondary ? colors.accent : "#FFFFFF" }]}>{label}</ThemedText></Pressable>;
}
const styles = StyleSheet.create({
  card: { borderRadius: 22, borderWidth: 1, padding: 20, gap: 14 },
  button: { minHeight: 48, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 15, lineHeight: 22, fontWeight: "700" },
});
