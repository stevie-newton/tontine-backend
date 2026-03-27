import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";

import { BrandBackdrop } from "@/components/brand-backdrop";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { useI18n } from "@/hooks/use-i18n";

type Tone = "midnight" | "forest" | "plum" | "slate";

type AuthStat = {
  label: string;
  value: string;
};

type AuthScreenShellProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  tone?: Tone;
  stats?: AuthStat[];
  children: React.ReactNode;
};

const toneStyles: Record<
  Tone,
  {
    hero: string;
    glowTop: string;
    glowBottom: string;
    eyebrow: string;
    subtitle: string;
    statLabel: string;
  }
> = {
  midnight: {
    hero: "#102643",
    glowTop: "#295FB1",
    glowBottom: "#7AD7C5",
    eyebrow: "#BFD2F3",
    subtitle: "#D9E5FA",
    statLabel: "#C8D7F4",
  },
  forest: {
    hero: "#173127",
    glowTop: "#2FA17D",
    glowBottom: "#EAAA55",
    eyebrow: "#BEE7D5",
    subtitle: "#D6F0E6",
    statLabel: "#D1EBDD",
  },
  plum: {
    hero: "#2A1746",
    glowTop: "#8151D6",
    glowBottom: "#F4B77A",
    eyebrow: "#D8C6FF",
    subtitle: "#E7DFFF",
    statLabel: "#E7DFFF",
  },
  slate: {
    hero: "#21304F",
    glowTop: "#4B68A8",
    glowBottom: "#9DD1C4",
    eyebrow: "#CDD7F2",
    subtitle: "#DEE6FA",
    statLabel: "#D6E0FA",
  },
};

export function AuthScreenShell({
  eyebrow,
  title,
  subtitle,
  tone = "midnight",
  stats = [],
  children,
}: AuthScreenShellProps) {
  const palette = toneStyles[tone];
  const { locale, setLocale, t } = useI18n();

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
        <BrandBackdrop />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.hero, { backgroundColor: palette.hero }]}>
            <View style={[styles.heroGlowTop, { backgroundColor: palette.glowTop }]} />
            <View style={[styles.heroGlowBottom, { backgroundColor: palette.glowBottom }]} />

            <View style={styles.languageRow}>
              <ThemedText style={[styles.languageLabel, { color: palette.eyebrow }]}>
                {t("Language")}
              </ThemedText>
              <View style={styles.languagePills}>
                <Pressable
                  style={[
                    styles.languagePill,
                    locale === "en" ? styles.languagePillActive : null,
                  ]}
                  onPress={() => void setLocale("en")}
                >
                  <ThemedText
                    style={[
                      styles.languagePillText,
                      locale === "en" ? styles.languagePillTextActive : null,
                    ]}
                  >
                    {t("English")}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.languagePill,
                    locale === "fr" ? styles.languagePillActive : null,
                  ]}
                  onPress={() => void setLocale("fr")}
                >
                  <ThemedText
                    style={[
                      styles.languagePillText,
                      locale === "fr" ? styles.languagePillTextActive : null,
                    ]}
                  >
                    {t("French")}
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <ThemedText style={[styles.eyebrow, { color: palette.eyebrow }]}>
              {eyebrow}
            </ThemedText>
            <ThemedText style={styles.heroTitle}>{title}</ThemedText>
            <ThemedText style={[styles.heroSubtitle, { color: palette.subtitle }]}>
              {subtitle}
            </ThemedText>

            {stats.length ? (
              <View style={styles.heroStats}>
                {stats.map((stat) => (
                  <View key={`${stat.label}-${stat.value}`} style={styles.heroStat}>
                    <ThemedText style={styles.heroStatValue}>{stat.value}</ThemedText>
                    <ThemedText style={[styles.heroStatLabel, { color: palette.statLabel }]}>
                      {stat.label}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          <View style={styles.card}>{children}</View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

export const authStyles = StyleSheet.create({
  sectionText: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: BrandColors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    color: BrandColors.ink,
  },
  primaryButton: {
    borderRadius: 18,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 15,
    alignItems: "center",
    ...BrandShadow,
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: BrandColors.surfaceStrong,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonPressed: {
    opacity: 0.92,
  },
  secondaryButtonText: {
    color: BrandColors.inkSoft,
    fontWeight: "800",
    fontSize: 14,
  },
  inlineLinks: {
    gap: 10,
  },
  linkRow: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  linkRowText: {
    color: BrandColors.inkSoft,
    fontWeight: "700",
    fontSize: 14,
  },
  helperBox: {
    borderRadius: 20,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 14,
    gap: 4,
  },
  helperTitle: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  message: {
    color: "#067647",
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: "#B42318",
    fontWeight: "700",
    fontSize: 14,
  },
});

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 44,
    gap: 18,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    padding: 22,
    gap: 14,
    ...BrandShadow,
  },
  heroGlowTop: {
    position: "absolute",
    top: -30,
    right: -18,
    width: 148,
    height: 148,
    borderRadius: 999,
    opacity: 0.24,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -12,
    bottom: -56,
    width: 148,
    height: 148,
    borderRadius: 999,
    opacity: 0.16,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
  },
  heroSubtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStat: {
    minWidth: 100,
    flexGrow: 1,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 14,
    gap: 4,
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  heroStatLabel: {
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 14,
    ...BrandShadow,
  },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  languageLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  languagePills: {
    flexDirection: "row",
    gap: 8,
  },
  languagePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.16)",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  languagePillActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  languagePillText: {
    color: "#F5F8FF",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
  languagePillTextActive: {
    color: "#102643",
  },
});
