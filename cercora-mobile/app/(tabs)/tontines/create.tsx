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

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { api } from "@/hooks/api-client";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

type Frequency = "weekly" | "monthly";

export default function CreateTontineScreen() {
  const router = useRouter();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [totalCycles, setTotalCycles] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => {
    const amount = Number(contributionAmount);
    const cycles = Number(totalCycles);
    return {
      amount: Number.isFinite(amount) ? amount : NaN,
      cycles: Number.isFinite(cycles) ? cycles : NaN,
    };
  }, [contributionAmount, totalCycles]);

  const previewCycleText =
    Number.isFinite(parsed.cycles) && parsed.cycles > 0
      ? parsed.cycles === 1
        ? t("{{count}} cycle", { count: parsed.cycles })
        : t("{{count}} cycles", { count: parsed.cycles })
      : t("Set your cycle count");

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await api.post("/tontines", {
        name: name.trim(),
        contribution_amount: parsed.amount,
        frequency,
        total_cycles: parsed.cycles,
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
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ThemedView style={styles.container} lightColor="#F4F7FB">
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.hero}>
            <View style={styles.heroGlowTop} />
            <View style={styles.heroGlowBottom} />
            <ThemedText style={styles.eyebrow}>New savings circle</ThemedText>
            <ThemedText style={styles.heroTitle}>Create a tontine that feels ready from day one</ThemedText>
            <ThemedText style={styles.heroSubtitle}>
              Define the amount, rhythm, and number of cycles now. You can invite members right after creation.
            </ThemedText>

            <View style={styles.previewRow}>
              <View style={styles.previewTile}>
                <ThemedText style={styles.previewValue}>
                  {contributionAmount.trim() || "--"}
                </ThemedText>
                <ThemedText style={styles.previewLabel}>Contribution</ThemedText>
              </View>
              <View style={styles.previewTile}>
                <ThemedText style={styles.previewValue}>
                  {frequency === "monthly" ? "Monthly" : "Weekly"}
                </ThemedText>
                <ThemedText style={styles.previewLabel}>Cadence</ThemedText>
              </View>
              <View style={styles.previewTile}>
                <ThemedText style={styles.previewValue}>{previewCycleText}</ThemedText>
                <ThemedText style={styles.previewLabel}>Structure</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.formCard}>
            <ThemedText type="subtitle">Configuration</ThemedText>
            <ThemedText style={styles.supportText}>
              Give the group a clear identity and simple contribution plan.
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
              <View style={styles.row}>
                <Pressable
                  style={[
                    styles.pill,
                    frequency === "weekly" ? styles.pillActive : null,
                  ]}
                  onPress={() => setFrequency("weekly")}
                >
                  <ThemedText
                    style={[
                      styles.pillText,
                      frequency === "weekly" ? styles.pillTextActive : null,
                    ]}
                  >
                    Weekly
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.pillHint,
                      frequency === "weekly" ? styles.pillHintActive : null,
                    ]}
                  >
                    Faster rotations
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.pill,
                    frequency === "monthly" ? styles.pillActive : null,
                  ]}
                  onPress={() => setFrequency("monthly")}
                >
                  <ThemedText
                    style={[
                      styles.pillText,
                      frequency === "monthly" ? styles.pillTextActive : null,
                    ]}
                  >
                    Monthly
                  </ThemedText>
                  <ThemedText
                    style={[
                      styles.pillHint,
                      frequency === "monthly" ? styles.pillHintActive : null,
                    ]}
                  >
                    Lower pressure cadence
                  </ThemedText>
                </Pressable>
              </View>
            </View>

            <View style={styles.formGroup}>
              <ThemedText style={styles.label}>Total cycles</ThemedText>
              <TextInput
                value={totalCycles}
                onChangeText={setTotalCycles}
                placeholder={t("Total cycles")}
                placeholderTextColor="#98A2B3"
                keyboardType="number-pad"
                style={styles.input}
              />
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

          <View style={styles.tipCard}>
            <ThemedText style={styles.tipTitle}>What happens next</ThemedText>
            <ThemedText style={styles.tipText}>
              After creation, you can invite members, generate cycles, and start collecting contributions from the tontine workspace.
            </ThemedText>
          </View>
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 28,
    gap: 16,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#132A4F",
    padding: 22,
    gap: 14,
  },
  heroGlowTop: {
    position: "absolute",
    top: -36,
    right: -24,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "#2563EB",
    opacity: 0.26,
  },
  heroGlowBottom: {
    position: "absolute",
    bottom: -50,
    left: -10,
    width: 150,
    height: 150,
    borderRadius: 999,
    backgroundColor: "#6FD3C1",
    opacity: 0.18,
  },
  eyebrow: {
    color: "#BFD2F3",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: "#D6E2F8",
    fontSize: 15,
    lineHeight: 22,
  },
  previewRow: {
    gap: 10,
  },
  previewTile: {
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 14,
    gap: 4,
  },
  previewValue: {
    color: "#FFFFFF",
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "800",
  },
  previewLabel: {
    color: "#CAD7F1",
    fontSize: 13,
    lineHeight: 18,
  },
  formCard: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5ECF6",
    padding: 18,
    gap: 14,
  },
  supportText: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    color: "#344054",
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
  row: {
    flexDirection: "row",
    gap: 10,
  },
  pill: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: "#FCFCFD",
    gap: 4,
  },
  pillActive: {
    borderColor: "#0A2A66",
    backgroundColor: "#0A2A66",
  },
  pillText: {
    color: "#101828",
    fontWeight: "700",
    fontSize: 15,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  pillHint: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 16,
  },
  pillHintActive: {
    color: "#D9E5FA",
  },
  error: {
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  primaryButton: {
    marginTop: 4,
    borderRadius: 16,
    backgroundColor: "#0A2A66",
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
  tipCard: {
    borderRadius: 22,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    padding: 18,
    gap: 6,
  },
  tipTitle: {
    color: "#1D4ED8",
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "800",
  },
  tipText: {
    color: "#1E3A8A",
    fontSize: 14,
    lineHeight: 20,
  },
});
