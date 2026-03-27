import { Link, Stack, useRouter } from "expo-router";
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AuthScreenShell, authStyles } from "@/components/auth-shell";
import { NameInput } from "@/components/name-input";
import { PasswordInput } from "@/components/password-input";
import { PhoneInput } from "@/components/phone-input";
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
  const cleanName = name.trim().replace(/\s+/g, " ");
  const nameParts = cleanName ? cleanName.split(" ").filter(Boolean) : [];
  const nameStatus = !cleanName
    ? t("This will appear on your Cercora profile.")
    : cleanName.length < 2
      ? t("Enter at least 2 characters.")
      : nameParts.length < 2
        ? t("You can keep going with one name, but full names are easier for groups to recognize.")
        : t("Looks good");
  const nameStatusTone =
    !cleanName ? "neutral" : cleanName.length < 2 ? "warning" : "success";

  async function onSubmit() {
    setError(null);
    setIsSubmitting(true);
    try {
      const cleanPhone = phone.trim();
      await signUp({ name: cleanName, phone: cleanPhone, password });
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
        eyebrow={t("Get started")}
        title={t("Create your Cercora account")}
        subtitle={t("Set up your profile, confirm your phone number, and get ready to join or manage a tontine.")}
        tone="slate"
        stats={[
          { label: t("Name"), value: name.trim() ? t("Ready") : t("Needed") },
          { label: t("Phone"), value: phone.trim() ? t("Ready") : t("Needed") },
          { label: t("Password"), value: password ? t("Ready") : t("Needed") },
        ]}
      >
        <ThemedText type="subtitle">Registration details</ThemedText>
        <ThemedText style={authStyles.sectionText}>
          We will send a one-time verification code to your phone after registration.
        </ThemedText>

        <View style={styles.form}>
          <ThemedText style={authStyles.label}>Full name</ThemedText>
          <NameInput
            value={name}
            onChangeText={setName}
            placeholder={t("Your full name")}
            statusText={nameStatus}
            statusTone={nameStatusTone}
          />

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
            placeholder={t("Create a password")}
            mode="create"
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
