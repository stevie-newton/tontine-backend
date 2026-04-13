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
        <ThemedText type="subtitle">{t("Your account")}</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          {t("Use the same phone number you registered with to access your tontines, reminders, and profile.")}
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
                    {t("Sign in with {{label}}", { label: biometric.label })}
                  </ThemedText>
                )}
              </Pressable>
              <ThemedText style={styles.biometricHint}>
                {t("Your device will use its enrolled biometric method automatically. You can still sign in with your phone number and password below.")}
              </ThemedText>
            </>
          ) : null}

          <ThemedText style={authStyles.label}>{t("Phone number")}</ThemedText>
          <PhoneInput
            value={phone}
            onChangeText={setPhone}
            placeholder={t("Local phone number")}
          />

          <ThemedText style={authStyles.label}>{t("Password")}</ThemedText>
          <PasswordInput
            value={password}
            onChangeText={setPassword}
            placeholder={t("Enter your password")}
          />

          {error ? <ThemedText style={authStyles.error}>{error}</ThemedText> : null}

          {biometric.isAvailable && !biometric.isEnabled ? (
            <View style={styles.biometricChoiceGroup}>
              <ThemedText style={styles.biometricChoiceTitle}>
                {t("Choose how you want to sign in next time")}
              </ThemedText>
              <ThemedText style={styles.biometricChoiceText}>
                {t("Your phone decides whether that means Face ID, fingerprint, or another enrolled biometric.")}
              </ThemedText>

              <View style={styles.biometricChoiceActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.biometricChoiceButton,
                    !useBiometricNextTime ? styles.biometricChoiceButtonActive : null,
                    pressed ? styles.biometricOptionPressed : null,
                  ]}
                  onPress={() => setUseBiometricNextTime(false)}
                >
                  <ThemedText
                    style={[
                      styles.biometricChoiceButtonText,
                      !useBiometricNextTime ? styles.biometricChoiceButtonTextActive : null,
                    ]}
                  >
                    {t("Use password")}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.biometricChoiceButton,
                    useBiometricNextTime ? styles.biometricChoiceButtonActive : null,
                    pressed ? styles.biometricOptionPressed : null,
                  ]}
                  onPress={() => setUseBiometricNextTime(true)}
                >
                  <ThemedText
                    style={[
                      styles.biometricChoiceButtonText,
                      useBiometricNextTime ? styles.biometricChoiceButtonTextActive : null,
                    ]}
                  >
                    {t("Use {{label}}", { label: biometric.label })}
                  </ThemedText>
                </Pressable>
              </View>

              <View
                style={[
                  styles.biometricOption,
                  useBiometricNextTime ? styles.biometricOptionActive : null,
                ]}
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
                    {useBiometricNextTime
                      ? t("Biometric sign-in will be ready after this login")
                      : t("Password sign-in stays as your default")}
                  </ThemedText>
                  <ThemedText style={styles.biometricOptionText}>
                    {useBiometricNextTime
                      ? t("We will securely save this login so your device can unlock Cercora with {{label}} next time.", {
                          label: biometric.label,
                        })
                      : t("You can still turn on biometric sign-in later whenever you are ready.")}
                  </ThemedText>
                </View>
              </View>
            </View>
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
              <ThemedText style={authStyles.primaryButtonText}>{t("Sign in")}</ThemedText>
            )}
          </Pressable>
        </View>

        <View style={authStyles.helperBox}>
          <ThemedText style={authStyles.helperTitle}>{t("Need help getting in?")}</ThemedText>
          <ThemedText style={authStyles.sectionText}>
            {t("Reset your password if you forgot it, or create a new account if this is your first time.")}
          </ThemedText>
        </View>

        <View style={authStyles.inlineLinks}>
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable style={authStyles.linkRow}>
              <ThemedText style={authStyles.linkRowText}>{t("Forgot password")}</ThemedText>
            </Pressable>
          </Link>
          <Link href="/(auth)/register" asChild>
            <Pressable style={authStyles.linkRow}>
              <ThemedText style={authStyles.linkRowText}>{t("Create an account")}</ThemedText>
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
  biometricChoiceGroup: {
    gap: 10,
  },
  biometricChoiceTitle: {
    color: "#101828",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "800",
  },
  biometricChoiceText: {
    color: "#475467",
    fontSize: 13,
    lineHeight: 18,
  },
  biometricChoiceActions: {
    flexDirection: "row",
    gap: 10,
  },
  biometricChoiceButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  biometricChoiceButtonActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#EFF6FF",
  },
  biometricChoiceButtonText: {
    color: "#344054",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
  },
  biometricChoiceButtonTextActive: {
    color: "#1D4ED8",
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
