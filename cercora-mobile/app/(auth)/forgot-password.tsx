import { Link, Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { forgotPassword } = useAuth();
  const { t } = useI18n();

  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);
    try {
      const cleanPhone = phone.trim();
      await forgotPassword({ phone: cleanPhone });
      setMessage("If that phone exists, a reset code was sent.");
      router.push({ pathname: "/(auth)/reset-password", params: { phone: cleanPhone } });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("Forgot Password") }} />
      <AuthScreenShell
        eyebrow="Account recovery"
        title="Reset your password"
        subtitle="We will send a reset code to your phone so you can securely set a new password."
        tone="forest"
        stats={[{ label: "Phone", value: phone.trim() ? "Ready" : "Needed" }]}
      >
        <ThemedText type="subtitle">Recovery details</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          Enter the phone number attached to your account and we will guide you to the reset step.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={authStyles.label}>Phone number</ThemedText>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("Phone number")}
            placeholderTextColor="#98A2B3"
            keyboardType="phone-pad"
            autoCapitalize="none"
            style={authStyles.input}
          />
          <ThemedText style={authStyles.sectionText}>
            Use international format (e.g. +237670000000)
          </ThemedText>

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
              <ThemedText style={authStyles.primaryButtonText}>Send reset code</ThemedText>
            )}
          </Pressable>
        </View>

        <Link href="/(auth)/login" asChild>
          <Pressable style={authStyles.linkRow}>
            <ThemedText style={authStyles.linkRowText}>Back to sign in</ThemedText>
          </Pressable>
        </Link>
      </AuthScreenShell>
    </>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 10,
  },
});
