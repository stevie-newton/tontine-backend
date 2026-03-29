import { useRouter } from "expo-router";
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

type Frequency = "weekly" | "monthly";

export default function CreateTontineScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmount = useMemo(() => {
    const value = Number(contributionAmount);
    return Number.isFinite(value) ? value : NaN;
  }, [contributionAmount]);

  function validateForm() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return t("Enter a tontine name.");
    }
    if (trimmedName.length < 3) {
      return t("Use at least 3 characters for the tontine name.");
    }
    if (!Number.isInteger(parsedAmount) || parsedAmount <= 0) {
      return t("Enter a valid contribution amount.");
    }
    return null;
  }

  async function onSubmit() {
    setError(null);
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post("/tontines/", {
        name: name.trim(),
        contribution_amount: parsedAmount,
        frequency,
        total_cycles: 1,
        current_cycle: 1,
        status: "draft",
      });

      const tontineId = res.data?.id;
      if (typeof tontineId === "number") {
        router.replace({
          pathname: "/(tabs)/tontines/[tontineId]",
          params: { tontineId: String(tontineId) },
        });
      } else {
        router.back();
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

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
          <View style={styles.pageHeader}>
            <ThemedText style={styles.pageTitle}>Create a tontine</ThemedText>
            <ThemedText style={styles.pageSubtitle}>
              Configure your group with a streamlined setup, then refine membership and cycle planning from the tontine workspace.
            </ThemedText>
          </View>

          <View style={styles.formCard}>
            <ThemedText style={styles.sectionTitle}>Setup details</ThemedText>
            <ThemedText style={styles.sectionSubtitle}>
              Name the group, choose the contribution amount, and set the contribution rhythm.
            </ThemedText>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t("Family circle")}
                placeholderTextColor="#98A2B3"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Contribution amount</ThemedText>
              <TextInput
                value={contributionAmount}
                onChangeText={setContributionAmount}
                placeholder={t("Contribution amount")}
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                style={styles.input}
              />
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Frequency</ThemedText>
              <View style={styles.frequencyRow}>
                <Pressable
                  style={[styles.frequencyCard, frequency === "weekly" ? styles.frequencyCardActive : null]}
                  onPress={() => setFrequency("weekly")}
                >
                  <ThemedText style={[styles.frequencyTitle, frequency === "weekly" ? styles.frequencyTitleActive : null]}>
                    Weekly
                  </ThemedText>
                  <ThemedText style={[styles.frequencyHint, frequency === "weekly" ? styles.frequencyHintActive : null]}>
                    Faster rotations
                  </ThemedText>
                </Pressable>

                <Pressable
                  style={[styles.frequencyCard, frequency === "monthly" ? styles.frequencyCardActive : null]}
                  onPress={() => setFrequency("monthly")}
                >
                  <ThemedText style={[styles.frequencyTitle, frequency === "monthly" ? styles.frequencyTitleActive : null]}>
                    Monthly
                  </ThemedText>
                  <ThemedText style={[styles.frequencyHint, frequency === "monthly" ? styles.frequencyHintActive : null]}>
                    Lower pressure cadence
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed ? styles.primaryButtonPressed : null,
              ]}
              disabled={isSubmitting}
              onPress={() => void onSubmit()}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>Create tontine</ThemedText>
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
    flexGrow: 1,
    padding: 18,
    paddingBottom: 56,
    gap: 16,
  },
  pageHeader: {
    gap: 6,
  },
  pageTitle: {
    color: BrandColors.ink,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  pageSubtitle: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    borderRadius: 28,
    backgroundColor: BrandColors.surface,
    borderWidth: 1,
    borderColor: BrandColors.border,
    padding: 18,
    gap: 14,
    ...BrandShadow,
  },
  sectionTitle: {
    color: BrandColors.ink,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "800",
  },
  sectionSubtitle: {
    color: BrandColors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    color: BrandColors.inkSoft,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#FCFCFD",
    color: "#101828",
    fontSize: 16,
  },
  frequencyRow: {
    flexDirection: "row",
    gap: 10,
  },
  frequencyCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BrandColors.borderStrong,
    backgroundColor: "rgba(255,255,255,0.7)",
    padding: 14,
    gap: 4,
  },
  frequencyCardActive: {
    backgroundColor: BrandColors.blueDeep,
    borderColor: BrandColors.blueDeep,
  },
  frequencyTitle: {
    color: BrandColors.ink,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
  },
  frequencyTitleActive: {
    color: "#FFFFFF",
  },
  frequencyHint: {
    color: BrandColors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  frequencyHintActive: {
    color: "#D9E5FA",
  },
  error: {
    color: BrandColors.dangerText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: BrandColors.blueDeep,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
});
