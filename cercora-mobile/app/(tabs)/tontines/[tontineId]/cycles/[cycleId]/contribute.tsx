import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { api } from "@/hooks/api-client";
import { getErrorMessage } from "@/hooks/error-utils";
import { choosePaymentProof, discardPaymentProof, PaymentProofSelectionError, submitContribution, type ContributionReceipt, type PaymentProof } from "@/hooks/payment-proof";
import { useI18n } from "@/hooks/use-i18n";

type Tontine = { id: number; name: string; contribution_amount: number };

export default function ContributeScreen() {
  const router = useRouter();
  const { tontineId, cycleId } = useLocalSearchParams<{ tontineId: string; cycleId: string }>();
  const tontineNum = Number(tontineId), cycleNum = Number(cycleId);
  const { t, locale } = useI18n();
  const colors = useSurfaceColors();
  const [tontine, setTontine] = useState<Tontine | null>(null);
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [proof, setProof] = useState<PaymentProof | null>(null);
  const [proofAvailable, setProofAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPicking, setIsPicking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [receipt, setReceipt] = useState<ContributionReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const currentProof = useRef<PaymentProof | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false), submitted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // A native upload may still be reading this file after navigation.
      if (!busy.current) void discardPaymentProof(currentProof.current);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setIsLoading(true);
    setError(null);
    if (![tontineNum, cycleNum].every(value => Number.isSafeInteger(value) && value > 0)) {
      setError(t("Invalid route params."));
      setIsLoading(false);
      return;
    }
    void Promise.allSettled([
      api.get<Tontine>("/tontines/" + tontineNum, { signal: controller.signal }),
      api.get<{ available: boolean }>("/contributions/proof-upload/status", { signal: controller.signal }),
    ]).then(([group, capability]) => {
      if (!active) return;
      if (group.status === "fulfilled") {
        setTontine(group.value.data);
        setAmount(String(group.value.data.contribution_amount));
      } else setError(getErrorMessage(group.reason));
      setProofAvailable(capability.status === "fulfilled" && capability.value.data.available);
      setIsLoading(false);
    });
    return () => { active = false; controller.abort(); };
  }, [cycleNum, tontineNum, t, retry]);

  function replaceProof(next: PaymentProof | null) {
    const previous = currentProof.current;
    currentProof.current = next;
    setProof(next);
    void discardPaymentProof(previous);
  }
  async function onPickProof() {
    if (busy.current) return;
    busy.current = true;
    setIsPicking(true);
    setError(null);
    try {
      const selected = await choosePaymentProof();
      if (!mounted.current) { await discardPaymentProof(selected); return; }
      if (selected) replaceProof(selected);
    } catch (e) {
      if (mounted.current) setError(e instanceof PaymentProofSelectionError ? e.message : t("Unable to open this image. Please choose another screenshot."));
    } finally {
      busy.current = false;
      if (mounted.current) setIsPicking(false);
      else void discardPaymentProof(currentProof.current);
    }
  }
  async function onSubmit() {
    if (busy.current || submitted.current || !tontine) return;
    busy.current = true;
    setError(null);
    setProgress(0);
    setIsSubmitting(true);
    try {
      const result = await submitContribution({ cycleId: cycleNum, amount, reference }, proof,
        value => { if (mounted.current) setProgress(value); });
      submitted.current = true;
      if (mounted.current) { setReceipt(result); replaceProof(null); }
    } catch (e) {
      if (mounted.current) setError(getErrorMessage(e));
    } finally {
      busy.current = false;
      if (mounted.current) setIsSubmitting(false);
      else void discardPaymentProof(currentProof.current);
    }
  }
  function openCycle() {
    router.replace({ pathname: "/(tabs)/tontines/[tontineId]/cycles/[cycleId]", params: { tontineId: String(tontineNum), cycleId: String(cycleNum) } });
  }
  const formatAmount = (value: string | number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(Number(value));
  const disabled = isPicking || isSubmitting;
  const inputStyle = [styles.input, { color: colors.accent, borderColor: colors.border, backgroundColor: colors.surface }];

  return <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
    <Stack.Screen options={{ title: t("Contribute") }} />
    {isLoading ? <View style={styles.center}><ActivityIndicator color={colors.accent} /></View> :
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets>
        {receipt ? <AppCard>
          <Ionicons name="checkmark-circle-outline" size={44} color={colors.accent} />
          <ThemedText accessibilityRole="header" style={AppTypography.heading}>{t("Contribution submitted")}</ThemedText>
          <ThemedText accessibilityRole="alert" style={{ color: colors.muted }}>{t("Awaiting beneficiary confirmation. Your payment is not confirmed yet.")}</ThemedText>
          <ThemedText style={AppTypography.section}>{tontine?.name}</ThemedText>
          <ThemedText>{t("Amount")}: {formatAmount(receipt.amount)}</ThemedText>
          <ThemedText selectable>{t("Transaction reference")}: {receipt.transaction_reference}</ThemedText>
          {receipt.proof_available ? <ThemedText>{t("Payment proof attached")}</ThemedText> : null}
          <AppButton label={t("View cycle details")} onPress={openCycle} />
        </AppCard> : !tontine ? <AppCard>
          {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
          <AppButton label={t("Try again")} onPress={() => setRetry(value => value + 1)} />
        </AppCard> : <>
          <View style={styles.heading}>
            <ThemedText style={AppTypography.heading}>{t("Submit contribution")}</ThemedText>
            <ThemedText style={{ color: colors.muted }}>{tontine.name}</ThemedText>
            <ThemedText>{t("Expected amount")}: {formatAmount(tontine.contribution_amount)}</ThemedText>
          </View>
          <AppCard>
            <ThemedText style={AppTypography.section}>{t("Payment details")}</ThemedText>
            <ThemedText style={{ color: colors.muted }}>{t("Enter your transfer amount and reference. You can also attach a screenshot for review.")}</ThemedText>
            <ThemedText style={styles.label}>{t("Amount")}</ThemedText>
            <TextInput accessibilityLabel={t("Amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!disabled} style={inputStyle} />
            <ThemedText style={styles.label}>{t("Transaction reference")}</ThemedText>
            <TextInput accessibilityLabel={t("Transaction reference")} value={reference} onChangeText={setReference} maxLength={120} autoCapitalize="none" autoCorrect={false} editable={!disabled} style={inputStyle} />
            <ThemedText style={{ color: colors.muted }}>{t("Required, even when you attach a screenshot.")}</ThemedText>
          </AppCard>
          <AppCard>
            <ThemedText style={AppTypography.section}>{t("Payment proof (optional)")}</ThemedText>
            {proofAvailable ? <>
              <ThemedText style={{ color: colors.muted }}>{t("Attach one screenshot, up to 5 MB. Only you and the beneficiary can view it.")}</ThemedText>
              {proof ? <>
                <Image accessibilityLabel={t("Selected payment proof")} accessible source={{ uri: proof.uri }} style={styles.preview} contentFit="contain" cachePolicy="none" />
                <ThemedText style={{ color: colors.muted }}>{t("Check that the amount and reference are readable before submitting.")}</ThemedText>
                <AppButton secondary label={t("Remove screenshot")} disabled={disabled} onPress={() => replaceProof(null)} />
              </> : null}
              <AppButton secondary label={isPicking ? t("Preparing screenshot...") : proof ? t("Replace screenshot") : t("Add payment proof")} disabled={disabled} onPress={() => { void onPickProof(); }} />
            </> : <ThemedText style={{ color: colors.muted }}>{t("Screenshot uploads are currently unavailable. You can still submit your transaction reference.")}</ThemedText>}
          </AppCard>
          {error ? <ThemedText accessibilityRole="alert" style={styles.error}>{error}</ThemedText> : null}
          {isSubmitting ? <View accessibilityLiveRegion="polite" style={styles.heading}>
            <ActivityIndicator color={colors.accent} />
            <ThemedText>{proof && progress < 100 ? t("Uploading proof: {{percent}}%", { percent: progress }) : t("Submitting...")}</ThemedText>
            <ThemedText style={{ color: colors.muted }}>{t("Keep this screen open until submission finishes.")}</ThemedText>
          </View> : null}
          <AppButton label={t("Submit contribution")} disabled={disabled || !amount.trim() || !reference.trim()} onPress={() => { void onSubmit(); }} />
        </>}
      </ScrollView>}
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, center: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: 20, paddingBottom: 80, gap: 20, width: "100%", maxWidth: 640, alignSelf: "center" },
  heading: { gap: 10 }, label: { fontSize: 14, fontWeight: "700" },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16 },
  preview: { width: "100%", height: 280, borderRadius: 12 },
  error: { color: "#B42318", fontSize: 14, fontWeight: "600" },
});
