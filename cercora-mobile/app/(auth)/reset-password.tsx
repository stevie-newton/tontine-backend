import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { OtpInput } from "@/components/otp-input";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const initialPhone = useMemo(() => (phoneParam ? String(phoneParam) : ""), [phoneParam]);

  const { forgotPassword, resetPassword } = useAuth();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      await resetPassword({
        phone: phone.trim(),
        code: code.trim(),
        newPassword,
      });
      setMessage("Password reset successful. You can now sign in.");
      router.replace("/(auth)/login");
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onResendCode() {
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setError(t("Enter your phone number first."));
      return;
    }

    setError(null);
    setMessage(null);
    setIsResending(true);
    try {
      await forgotPassword({ phone: cleanPhone });
      setMessage(t("A new reset code was sent if that phone number exists."));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsResending(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("Reset Password") }} />
      <AuthScreenShell
        eyebrow={t("Finish reset")}
        title={t("Choose a new password")}
        subtitle={t("Enter the reset code you received, then set the password you want to use the next time you sign in.")}
        tone="slate"
        stats={[
          { label: t("Phone"), value: phone.trim() ? t("Ready") : t("Needed") },
          { label: t("Code"), value: code.trim() ? t("Entered") : t("Needed") },
          { label: t("Password"), value: newPassword ? t("Ready") : t("Needed") },
        ]}
      >
        <ThemedText type="subtitle">Reset details</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          Make sure the phone number and reset code match the one you requested from the recovery screen.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={authStyles.label}>Phone number</ThemedText>
          <PhoneInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("Local phone number")}
          />

          <ThemedText style={authStyles.label}>Reset code</ThemedText>
          <OtpInput
            value={code}
            onChangeText={setCode}
            placeholder={t("Reset code")}
          />

          <Pressable
            style={({ pressed }) => [
              authStyles.linkRow,
              styles.resendLink,
              pressed ? styles.resendLinkPressed : null,
            ]}
            disabled={isSubmitting || isResending}
            onPress={() => void onResendCode()}
          >
            {isResending ? (
              <ActivityIndicator color="#1849A9" />
            ) : (
              <ThemedText style={authStyles.linkRowText}>{t("Resend code")}</ThemedText>
            )}
          </Pressable>

          <ThemedText style={authStyles.label}>New password</ThemedText>
          <PasswordInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t("Create a new password")}
            mode="create"
          />

          {message ? <ThemedText style={authStyles.message}>{message}</ThemedText> : null}
          {error ? <ThemedText style={authStyles.error}>{error}</ThemedText> : null}

          <Pressable
            style={({ pressed }) => [
              authStyles.primaryButton,
              pressed ? authStyles.primaryButtonPressed : null,
            ]}
            disabled={isSubmitting}
            onPress={() => void onSubmit()}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={authStyles.primaryButtonText}>Reset password</ThemedText>
            )}
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
  resendLink: {
    alignSelf: "flex-start",
    marginTop: -2,
  },
  resendLinkPressed: {
    opacity: 0.7,
  },
});
