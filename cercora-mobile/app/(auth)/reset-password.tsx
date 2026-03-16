import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { phone: phoneParam } = useLocalSearchParams<{ phone?: string }>();
  const initialPhone = useMemo(() => (phoneParam ? String(phoneParam) : ""), [phoneParam]);

  const { resetPassword } = useAuth();
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  return (
    <>
      <Stack.Screen options={{ title: t("Reset Password") }} />
      <AuthScreenShell
        eyebrow="Finish reset"
        title="Choose a new password"
        subtitle="Enter the reset code you received, then set the password you want to use the next time you sign in."
        tone="slate"
        stats={[
          { label: "Phone", value: phone.trim() ? "Ready" : "Needed" },
          { label: "Code", value: code.trim() ? "Entered" : "Needed" },
          { label: "Password", value: newPassword ? "Ready" : "Needed" },
        ]}
      >
        <ThemedText type="subtitle">Reset details</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          Make sure the phone number and reset code match the one you requested from the recovery screen.
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

          <ThemedText style={authStyles.label}>Reset code</ThemedText>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder={t("Reset code")}
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
            autoCapitalize="none"
            style={authStyles.input}
          />

          <ThemedText style={authStyles.label}>New password</ThemedText>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder={t("Create a new password")}
            placeholderTextColor="#98A2B3"
            secureTextEntry
            autoCapitalize="none"
            style={authStyles.input}
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
});
