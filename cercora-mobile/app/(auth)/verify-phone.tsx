import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { OtpInput } from "@/components/otp-input";
import { PhoneInput } from "@/components/phone-input";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const initialPhone = useMemo(() => (phoneParam ? String(phoneParam) : ""), [phoneParam]);

  const { verifyPhone, resendOtp } = useAuth();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await verifyPhone({ phone: phone.trim(), code: code.trim() });
      setMessage("Phone verified. You can now sign in.");
      router.replace("/(auth)/login");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onResend() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await resendOtp({ phone: phone.trim() });
      setMessage("OTP sent.");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("Verify Phone") }} />
      <AuthScreenShell
        eyebrow={t("Verification")}
        title={t("Confirm your phone number")}
        subtitle={t("Enter the six-digit code we sent you. If it did not arrive, you can resend it from here.")}
        tone="plum"
        stats={[
          { label: t("Phone"), value: phone.trim() ? t("Ready") : t("Needed") },
          { label: t("Code"), value: code.trim() ? t("Entered") : t("Needed") },
        ]}
      >
        <ThemedText type="subtitle">Verification code</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          Use the same phone number you registered with so the verification can complete cleanly.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={authStyles.label}>Phone number</ThemedText>
          <PhoneInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("Local phone number")}
          />

          <ThemedText style={authStyles.label}>Verification code</ThemedText>
          <OtpInput
            value={code}
            onChangeText={setCode}
            placeholder={t("Verification code")}
          />

          {message ? <ThemedText style={authStyles.message}>{message}</ThemedText> : null}
          {error ? <ThemedText style={authStyles.error}>{error}</ThemedText> : null}

          <Pressable
            style={({ pressed }) => [
              authStyles.primaryButton,
              pressed ? authStyles.primaryButtonPressed : null,
            ]}
            disabled={isSubmitting}
            onPress={() => void onVerify()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={authStyles.primaryButtonText}>Verify phone</ThemedText>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              authStyles.secondaryButton,
              pressed ? authStyles.secondaryButtonPressed : null,
            ]}
            disabled={isSubmitting}
            onPress={() => void onResend()}
          >
            <ThemedText style={authStyles.secondaryButtonText}>Resend code</ThemedText>
          </Pressable>
        </View>
      </AuthScreenShell>
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
  },
});
