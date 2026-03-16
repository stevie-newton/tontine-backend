import { Link } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function ModalScreen() {
  return (
    <ThemedView style={styles.container} lightColor="#F4F7FB">
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <ThemedText style={styles.eyebrow}>Quick note</ThemedText>
        <ThemedText style={styles.title}>You opened a modal surface</ThemedText>
        <ThemedText style={styles.subtitle}>
          This screen is ready for lightweight confirmations, short summaries, or next-step prompts without breaking the main flow.
        </ThemedText>

        <View style={styles.helperCard}>
          <ThemedText style={styles.helperTitle}>Current behavior</ThemedText>
          <ThemedText style={styles.helperText}>
            It is still a simple placeholder route, but it now matches the rest of the app’s visual language instead of looking like a starter template.
          </ThemedText>
        </View>

        <Link href="/(tabs)/dashboard" dismissTo asChild>
          <Pressable style={styles.primaryButton}>
            <ThemedText style={styles.primaryButtonText}>Return to dashboard</ThemedText>
          </Pressable>
        </Link>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 18,
    backgroundColor: "#EAF0F8",
  },
  sheet: {
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6ECF5",
    padding: 20,
    gap: 14,
  },
  grabber: {
    alignSelf: "center",
    width: 54,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#D0D5DD",
  },
  eyebrow: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  title: {
    color: "#101828",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "800",
  },
  subtitle: {
    color: "#475467",
    fontSize: 15,
    lineHeight: 22,
  },
  helperCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E7EEF7",
    padding: 14,
    gap: 4,
  },
  helperTitle: {
    color: "#101828",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  helperText: {
    color: "#475467",
    fontSize: 14,
    lineHeight: 20,
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#0A2A66",
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 15,
  },
});
