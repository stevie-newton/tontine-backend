import { Link, Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const cleanPhone = phone.trim();
      await signUp({ name: name.trim(), phone: cleanPhone, password });
      router.push({ pathname: "/(auth)/verify-phone", params: { phone: cleanPhone } });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("Create Account") }} />
      <AuthScreenShell
        eyebrow="Get started"
        title="Create your Cercora account"
        subtitle="Set up your profile, confirm your phone number, and get ready to join or manage a tontine."
        tone="slate"
        stats={[
          { label: "Name", value: name.trim() ? "Ready" : "Needed" },
          { label: "Phone", value: phone.trim() ? "Ready" : "Needed" },
          { label: "Password", value: password ? "Ready" : "Needed" },
        ]}
      >
        <ThemedText type="subtitle">Registration details</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          We will send a one-time verification code to your phone after registration.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={authStyles.label}>Full name</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("Your name")}
            placeholderTextColor="#98A2B3"
            autoCapitalize="words"
            style={authStyles.input}
          />

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

          <ThemedText style={authStyles.label}>Password</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("Create a password")}
            placeholderTextColor="#98A2B3"
            secureTextEntry
            autoCapitalize="none"
            style={authStyles.input}
          />

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
              <ThemedText style={authStyles.primaryButtonText}>Continue</ThemedText>
            )}
          </Pressable>
        </View>

        <Link href="/(auth)/login" asChild>
          <Pressable style={authStyles.linkRow}>
            <ThemedText style={authStyles.linkRowText}>Already have an account? Sign in</ThemedText>
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
