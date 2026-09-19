import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PhoneInput } from "@/components/phone-input";
import { ThemedText } from "@/components/themed-text";
import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import {
  getProblemReportErrors,
  REPORT_DESCRIPTION_LIMIT,
  REPORT_LOCATION_LIMIT,
  submitProblemReport,
} from "@/hooks/problem-report";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { useThemeColor } from "@/hooks/use-theme-color";

export default function ReportProblemScreen() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { user, accessToken } = useAuth();
  const { t, locale } = useI18n();
  const colors = useSurfaceColors();
  const textColor = useThemeColor({}, "text");
  const [location, setLocation] = useState(from === "sign-in" ? t("Signing in") : "");
  const [description, setDescription] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [receipt, setReceipt] = useState<{ id: number } | null>(null);
  const busyRef = useRef(false);
  const submittedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const accountName = accessToken ? user?.name : undefined;
  const accountPhone = accessToken ? user?.phone : undefined;
  const values = {
    location,
    description,
    requesterName: accountName || requesterName,
    requesterPhone: accountPhone || requesterPhone,
  };
  const errors = attempted ? getProblemReportErrors(values) : {};
  const inputStyle = [styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: textColor }];

  function goBack() {
    if (busyRef.current) return;
    if (router.canGoBack()) router.back();
    else router.replace(accessToken ? "/(tabs)/profile" : "/(auth)/login");
  }

  async function onSubmit() {
    if (busyRef.current || submittedRef.current) return;
    setAttempted(true);
    if (Object.keys(getProblemReportErrors(values)).length) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const result = await submitProblemReport(values, locale, typeof from === "string" ? from : "direct");
      submittedRef.current = true;
      if (mountedRef.current) setReceipt(result);
    } catch {
      // A timeout may occur after the server saved the report. Never retry automatically.
      if (mountedRef.current) setFailed(true);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setBusy(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Back")} accessibilityState={{ disabled: busy }} disabled={busy} onPress={goBack} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.accent} />
            <ThemedText style={{ color: colors.accent }}>{t("Back")}</ThemedText>
          </Pressable>
          <ThemedText style={AppTypography.heading}>{t("Report a problem")}</ThemedText>
          {receipt ? (
            <AppCard accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle-outline" size={36} color={colors.accent} />
              <ThemedText style={AppTypography.section}>{t("Report received")}</ThemedText>
              <ThemedText>{t("Your report has been saved. Thank you for helping us improve Cercora.")}</ThemedText>
              <ThemedText selectable type="defaultSemiBold">{t("Report #{{id}}", { id: receipt.id })}</ThemedText>
              <AppButton label={t("Done")} onPress={goBack} />
            </AppCard>
          ) : (
            <>
              <ThemedText style={{ color: colors.muted }}>{t("Tell us where you got stuck so we can improve Cercora.")}</ThemedText>
              <AppCard>
                <ThemedText type="defaultSemiBold">{t("Where did you get stuck?")}</ThemedText>
                <TextInput
                  accessibilityLabel={t("Where did you get stuck?")}
                  value={location} onChangeText={setLocation} editable={!busy}
                  maxLength={REPORT_LOCATION_LIMIT}
                  placeholder={t("e.g. Joining a tontine or making a payment")}
                  placeholderTextColor={colors.muted} style={inputStyle}
                />
                {errors.location ? <ThemedText accessibilityRole="alert" style={styles.error}>{t(errors.location)}</ThemedText> : null}
                <ThemedText type="defaultSemiBold">{t("What happened?")}</ThemedText>
                <TextInput
                  accessibilityLabel={t("What happened?")}
                  value={description} onChangeText={setDescription} editable={!busy}
                  maxLength={REPORT_DESCRIPTION_LIMIT} multiline textAlignVertical="top"
                  placeholder={t("Tell us what you tried, what happened, and what you expected.")}
                  placeholderTextColor={colors.muted} style={[inputStyle, styles.description]}
                />
                {errors.description ? <ThemedText accessibilityRole="alert" style={styles.error}>{t(errors.description)}</ThemedText> : null}
                <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("Please leave out passwords, verification codes, and payment details.")}</ThemedText>
              </AppCard>

              <AppCard>
                {!accountName ? <>
                  <ThemedText type="defaultSemiBold">{t("Your name")}</ThemedText>
                  <TextInput accessibilityLabel={t("Your name")} value={requesterName} onChangeText={setRequesterName} maxLength={100} editable={!busy} autoCapitalize="words" autoComplete="name" textContentType="name" style={inputStyle} />
                </> : null}
                {errors.requesterName ? <ThemedText accessibilityRole="alert" style={styles.error}>{t(errors.requesterName)}</ThemedText> : null}
                {!accountPhone ? <>
                  <ThemedText type="defaultSemiBold">{t("Phone number")}</ThemedText>
                  <PhoneInput value={requesterPhone} onChangeText={setRequesterPhone} editable={!busy} placeholder={t("Local phone number")} containerStyle={styles.phone} />
                </> : null}
                {errors.requesterPhone ? <ThemedText accessibilityRole="alert" style={styles.error}>{t(errors.requesterPhone)}</ThemedText> : null}
                <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("We use your name and phone number to follow up on your report.")}</ThemedText>
                <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("App version and device software are included to help us investigate.")}</ThemedText>
              </AppCard>
              {failed ? <ThemedText accessibilityRole="alert" style={styles.error}>{t("We could not confirm that your report was received. Your text is still here; please try again.")}</ThemedText> : null}
              <View accessibilityLiveRegion="polite">
                <AppButton label={busy ? t("Sending report...") : t("Send report")} disabled={busy} onPress={() => void onSubmit()} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: "100%", maxWidth: 640, alignSelf: "center", padding: 20, paddingBottom: 36, gap: 20 },
  back: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", minHeight: 44, paddingRight: 12, gap: 4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, lineHeight: 24, minHeight: 48 },
  description: { minHeight: 160 },
  error: { color: "#D92D20", fontSize: 14, lineHeight: 21 },
  phone: { marginBottom: 2 },
});
