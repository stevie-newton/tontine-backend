import { Link, Stack } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn({ phone: phone.trim(), password });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("Sign In") }} />
      <AuthScreenShell
        eyebrow="Welcome back"
        title="Sign in to Cercora"
        subtitle="Pick up where you left off with your phone number and password."
        tone="midnight"
        stats={[
          { label: "Phone", value: phone.trim() ? "Ready" : "Needed" },
          { label: "Password", value: password ? "Entered" : "Needed" },
        ]}
      >
        <ThemedText type="subtitle">Your account</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          Use the same phone number you registered with to access your tontines, reminders, and profile.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={authStyles.label}>Phone number</ThemedText>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("Phone number")}
            placeholderTextColor="#98A2B3"
            autoCapitalize="none"
            keyboardType="phone-pad"
            style={authStyles.input}
          />
          <ThemedText style={authStyles.sectionText}>
            Use international format (e.g. +237670000000)
          </ThemedText>

          <ThemedText style={authStyles.label}>Password</ThemedText>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("Enter your password")}
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
              <ThemedText style={authStyles.primaryButtonText}>Sign in</ThemedText>
            )}
          </Pressable>
        </View>

        <View style={authStyles.helperBox}>
          <ThemedText style={authStyles.helperTitle}>Need help getting in?</ThemedText>
          <ThemedText style={authStyles.sectionText}>
            Reset your password if you forgot it, or create a new account if this is your first time.
          </ThemedText>
        </View>

        <View style={authStyles.inlineLinks}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={authStyles.linkRow}>
              <ThemedText style={authStyles.linkRowText}>Forgot password</ThemedText>
            </Pressable>
          </Link>
          <Link href="/(auth)/register" asChild>
            <Pressable style={authStyles.linkRow}>
              <ThemedText style={authStyles.linkRowText}>Create an account</ThemedText>
            </Pressable>
          </Link>
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
