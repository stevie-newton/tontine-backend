import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";

import { BrandBackdrop } from "@/components/brand-backdrop";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { BrandColors, BrandShadow } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

type Role = "member" | "admin";

export default function InviteMemberScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { tontineId } = useLocalSearchParams<{ tontineId: string }>();
  const id = useMemo(() => Number(tontineId), [tontineId]);

  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.post("/tontine-memberships/invite", {
        tontine_id: id,
        phone: phone.trim(),
        role,
      });
      const msg = res.data?.message;
      setMessage(typeof msg === "string" ? msg : "Invite sent.");
      setPhone("");
      router.back();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ThemedView style={styles.container} lightColor={BrandColors.canvas}>
        <BrandBackdrop />
        <Stack.Screen options={{ title: t("Invite Member") }} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />

            <ThemedText style={styles.eyebrow}>New invitation</ThemedText>
            <ThemedText style={styles.heroTitle}>Bring someone into the circle</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Invite by phone number and choose whether they join as a standard member or as an admin.
            </ThemedText>

            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>{role}</ThemedText>
                <ThemedText style={styles.heroStatLabel}>Selected role</ThemedText>
              </View>
              <View style={styles.heroStat}>
                <ThemedText style={styles.heroStatValue}>
                  {phone.trim() ? "Ready" : "Needed"}
                </ThemedText>
                <ThemedText style={styles.heroStatLabel}>Phone number</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <ThemedText type="subtitle">Invite details</ThemedText>
            <ThemedText style={styles.supportText}>
              The invited person will see a pending invite after they sign in with this phone number.
            </ThemedText>

            <ThemedText style={styles.label}>Phone number</ThemedText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder={t("Phone number")}
              placeholderTextColor="#98A2B3"
              keyboardType="phone-pad"
              autoCapitalize="none"
              style={styles.input}
            />
            <ThemedText style={styles.supportText}>
              Use international format (e.g. +237670000000)
            </ThemedText>

            <ThemedText style={styles.label}>Access level</ThemedText>
            <View style={styles.roleGrid}>
              <Pressable
                style={[styles.roleCard, role === "member" ? styles.roleCardActive : null]}
                onPress={() => setRole("member")}
              >
                <ThemedText
                  style={[
                    styles.roleTitle,
                    role === "member" ? styles.roleTitleActive : null,
                  ]}
                >
                  Member
                </ThemedText>
                <ThemedText
                  style={[
                    styles.roleDescription,
                    role === "member" ? styles.roleDescriptionActive : null,
                  ]}
                >
                  Joins cycles, contributes, and participates in the payout rotation.
                </ThemedText>
              </Pressable>

              <Pressable
                style={[styles.roleCard, role === "admin" ? styles.roleCardActive : null]}
                onPress={() => setRole("admin")}
              >
                <ThemedText
                  style={[
                    styles.roleTitle,
                    role === "admin" ? styles.roleTitleActive : null,
                  ]}
                >
                  Admin
                </ThemedText>
                <ThemedText
                  style={[
                    styles.roleDescription,
                    role === "admin" ? styles.roleDescriptionActive : null,
                  ]}
                >
                  Can help manage members and operational actions inside the tontine.
                </ThemedText>
              </Pressable>
            </View>

            {message ? <ThemedText style={styles.message}>{message}</ThemedText> : null}
            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
              ]}
              disabled={isSubmitting || !Number.isFinite(id)}
              onPress={() => void onSubmit()}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Send invite</ThemedText>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 120,
    gap: 18,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 32,
    backgroundColor: BrandColors.blueDeep,
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
    backgroundColor: BrandColors.blue,
    opacity: 0.26,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -12,
    bottom: -56,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: BrandColors.violet,
    opacity: 0.14,
  },
  eyebrow: {
    color: "#D7E7FF",
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
    color: "#E6EEFF",
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
    color: "#CFE0FF",
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
  supportText: {
    color: BrandColors.muted,
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
    backgroundColor: "rgba(255,255,255,0.88)",
    color: BrandColors.ink,
  },
  roleGrid: {
    gap: 10,
  },
  roleCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: "rgba(255,255,255,0.76)",
    padding: 16,
    gap: 4,
  },
  roleCardActive: {
    borderColor: BrandColors.blueDeep,
    backgroundColor: BrandColors.blueDeep,
  },
  roleTitle: {
    color: BrandColors.ink,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  roleTitleActive: {
    color: "#FFFFFF",
  },
  roleDescription: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  roleDescriptionActive: {
    color: "#DCE8FF",
  },
  message: {
    color: BrandColors.successText,
    fontWeight: "700",
    fontSize: 14,
  },
  error: {
    color: BrandColors.dangerText,
    fontWeight: "700",
    fontSize: 14,
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
});
