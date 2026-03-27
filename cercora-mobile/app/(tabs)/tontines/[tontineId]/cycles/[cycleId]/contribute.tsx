import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
import { getCurrentLocale, useI18n } from "@/hooks/use-i18n";

type Tontine = {
  id: number;
  name: string;
  contribution_amount: number;
  frequency: string;
  total_cycles: number;
  current_cycle: number;
  status: string;
  owner_id: number;
  created_at: string;
};

function formatAmount(value: number) {
  return new Intl.NumberFormat(getCurrentLocale(), { maximumFractionDigits: 2 }).format(value);
}

export default function ContributeScreen() {
  const router = useRouter();
  const { tontineId, cycleId } = useLocalSearchParams<{
    tontineId: string;
    cycleId: string;
  }>();
  const tontineNum = useMemo(() => Number(tontineId), [tontineId]);
  const cycleNum = useMemo(() => Number(cycleId), [cycleId]);
  const { t } = useI18n();

  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [amount, setAmount] = useState("");
  const [transactionReference, setTransactionReference] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      setError(null);
      setIsLoading(true);
      try {
        const res = await api.get<Tontine>(`/tontines/${tontineNum}`);
        if (!isMounted) return;
        setTontine(res.data);
        setAmount(String(res.data.contribution_amount));
      } catch (e) {
        if (!isMounted) return;
        setError(getErrorMessage(e));
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    }

    if (!Number.isFinite(tontineNum) || !Number.isFinite(cycleNum)) {
      setIsLoading(false);
      setError("Invalid route params.");
      return;
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [cycleNum, tontineNum]);

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/contributions/", {
        cycle_id: cycleNum,
        amount: amount.trim(),
        transaction_reference: transactionReference.trim(),
        proof_screenshot_url: proofUrl.trim() ? proofUrl.trim() : null,
      });
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 24 : 0}
    >
      <ThemedView style={styles.container} lightColor="#F4F7FB">
        <Stack.Screen options={{ title: t("Contribute") }} />

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.hero}>
              <View style={styles.heroGlowTop} />
              <View style={styles.heroGlowBottom} />

              <ThemedText style={styles.eyebrow}>Contribution</ThemedText>
              <ThemedText style={styles.heroTitle}>Submit your cycle payment</ThemedText>
              <ThemedText style={styles.heroSubtitle}>
                Add the transfer amount, reference, and proof link so the contribution can be reviewed quickly.
              </ThemedText>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <ThemedText style={styles.heroStatValue}>
                    {tontine ? formatAmount(tontine.contribution_amount) : "-"}
                  </ThemedText>
                  <ThemedText style={styles.heroStatLabel}>Expected amount</ThemedText>
                </View>
                <View style={styles.heroStat}>
                  <ThemedText style={styles.heroStatValue}>Cycle {cycleNum}</ThemedText>
                  <ThemedText style={styles.heroStatLabel}>Target cycle</ThemedText>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <ThemedText type="subtitle">Payment details</ThemedText>
              <ThemedText style={styles.supportText}>
                {tontine
                  ? t("{{tontine}} expects {{amount}} for this cycle.", {
                      tontine: tontine.name,
                      amount: formatAmount(tontine.contribution_amount),
                    })
                  : t("Fill in the payment details below.")}
              </ThemedText>

              <ThemedText style={styles.label}>Amount</ThemedText>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder={t("Amount")}
                placeholderTextColor="#98A2B3"
                keyboardType="decimal-pad"
                style={styles.input}
              />

              <ThemedText style={styles.label}>Transaction reference</ThemedText>
              <TextInput
                value={transactionReference}
                onChangeText={setTransactionReference}
                placeholder={t("Transaction reference")}
                placeholderTextColor="#98A2B3"
                autoCapitalize="none"
                style={styles.input}
              />

              <ThemedText style={styles.label}>Proof screenshot URL</ThemedText>
              <TextInput
                value={proofUrl}
                onChangeText={setProofUrl}
                placeholder={t("Proof screenshot URL")}
                placeholderTextColor="#98A2B3"
                autoCapitalize="none"
                style={styles.input}
              />

              <View style={styles.helperCard}>
                <ThemedText style={styles.helperTitle}>Before you submit</ThemedText>
                <ThemedText style={styles.supportText}>
                  Make sure the amount matches your cycle contribution and the reference matches the transfer. Add screenshot proof if you have it for beneficiary review.
                </ThemedText>
              </View>

              {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

              <Pressable
                style={styles.primaryButton}
                disabled={isSubmitting || !transactionReference.trim()}
                onPress={() => void onSubmit()}
              >
                <ThemedText style={styles.primaryButtonText}>
                  {isSubmitting ? "Submitting..." : "Submit contribution"}
                </ThemedText>
              </Pressable>
            </View>
          </ScrollView>
        )}
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    padding: 18,
    paddingBottom: 56,
    gap: 18,
  },
  hero: {
    position: "relative",
    overflow: "hidden",
    borderRadius: 28,
    backgroundColor: "#21304F",
    padding: 22,
    gap: 14,
  },
  heroGlowTop: {
    position: "absolute",
    top: -30,
    right: -18,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "#4B68A8",
    opacity: 0.24,
  },
  heroGlowBottom: {
    position: "absolute",
    left: -12,
    bottom: -56,
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "#9DD1C4",
    opacity: 0.16,
  },
  eyebrow: {
    color: "#CDD7F2",
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
    color: "#DEE6FA",
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
  },
  heroStatLabel: {
    color: "#D6E0FA",
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF5",
    padding: 16,
    gap: 14,
  },
  supportText: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: "#101828",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  input: {
    borderWidth: 1,
    borderColor: "#D7E1F2",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: "#F9FBFF",
    color: "#101828",
  },
  helperCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EEF7",
    padding: 14,
    gap: 4,
  },
  helperTitle: {
    color: "#101828",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  error: {
    color: "#B42318",
    fontWeight: "700",
    fontSize: 14,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#0A2A66",
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
