import { Link, Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";
import { ThemedText } from "@/components/themed-text";
import { useAuth } from "@/hooks/use-auth";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export default function LoginScreen() {
  const { biometric, enableBiometricSignIn, signIn, signInWithBiometrics } = useAuth();
  const { t } = useI18n();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false);
  const [useBiometricNextTime, setUseBiometricNextTime] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (biometric.isAvailable && !biometric.isEnabled) {
      setUseBiometricNextTime(true);
      return;
    }
    setUseBiometricNextTime(false);
  }, [biometric.isAvailable, biometric.isEnabled]);

  async function onSubmit() {
    const cleanPhone = phone.trim();
    const shouldEnableBiometric =
      biometric.isAvailable && !biometric.isEnabled && useBiometricNextTime;

    setError(null);
    setIsSubmitting(true);
    try {
      await signIn({ phone: cleanPhone, password });
      if (shouldEnableBiometric) {
        await enableBiometricSignIn({ phone: cleanPhone, password });
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onBiometricSubmit() {
    setError(null);
    setIsBiometricSubmitting(true);
    try {
      await signInWithBiometrics();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsBiometricSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: t("Sign In") }} />
      <AuthScreenShell
        eyebrow={t("Welcome back")}
        title={t("Sign in to Cercora")}
        subtitle={t("Pick up where you left off with your phone number and password.")}
        tone="midnight"
        stats={[
          { label: t("Phone"), value: phone.trim() ? t("Ready") : t("Needed") },
          { label: t("Password"), value: password ? t("Entered") : t("Needed") },
        ]}
      >
        <ThemedText type="subtitle">Your account</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          Use the same phone number you registered with to access your tontines, reminders, and profile.
        </ThemedText>

        <View style={styles.form}>
          {biometric.isAvailable && biometric.isEnabled ? (
            <>
              <Pressable
                style={({ pressed }) => [
                  authStyles.secondaryButton,
                  pressed ? authStyles.secondaryButtonPressed : null,
                ]}
                disabled={isBiometricSubmitting || isSubmitting}
                onPress={() => void onBiometricSubmit()}
              >
                {isBiometricSubmitting ? (
                  <ActivityIndicator />
                ) : (
                  <ThemedText style={authStyles.secondaryButtonText}>
                    Sign in with {biometric.label}
                  </ThemedText>
                )}
              </Pressable>
              <ThemedText style={styles.biometricHint}>
                {biometric.label} is ready on this device. You can also use your phone number and
                password below.
              </ThemedText>
            </>
          ) : null}

          <ThemedText style={authStyles.label}>Phone number</ThemedText>
          <PhoneInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("Local phone number")}
          />

          <ThemedText style={authStyles.label}>Password</ThemedText>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("Enter your password")}
          />

          {error ? <ThemedText style={authStyles.error}>{error}</ThemedText> : null}

          {biometric.isAvailable && !biometric.isEnabled ? (
            <Pressable
              style={({ pressed }) => [
                styles.biometricOption,
                useBiometricNextTime ? styles.biometricOptionActive : null,
                pressed ? styles.biometricOptionPressed : null,
              ]}
              onPress={() => setUseBiometricNextTime((current) => !current)}
            >
              <View
                style={[
                  styles.biometricCheck,
                  useBiometricNextTime ? styles.biometricCheckActive : null,
                ]}
              >
                {useBiometricNextTime ? <View style={styles.biometricCheckInner} /> : null}
              </View>
              <View style={styles.biometricOptionCopy}>
                <ThemedText style={styles.biometricOptionTitle}>
                  Enable {biometric.label} after sign in
                </ThemedText>
                <ThemedText style={styles.biometricOptionText}>
                  Save your login securely so next time you can unlock Cercora with {biometric.label}.
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

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
  biometricHint: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 18,
  },
  biometricOption: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#F8FAFC",
    padding: 14,
    alignItems: "flex-start",
  },
  biometricOptionActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#EFF6FF",
  },
  biometricOptionPressed: {
    opacity: 0.92,
  },
  biometricCheck: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#98A2B3",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  biometricCheckActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#1D4ED8",
  },
  biometricCheckInner: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  biometricOptionCopy: {
    flex: 1,
    gap: 2,
  },
  biometricOptionTitle: {
    color: "#101828",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
  },
  biometricOptionText: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 18,
  },
});
