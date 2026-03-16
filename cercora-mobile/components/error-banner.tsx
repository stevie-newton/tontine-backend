import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { subscribeToGlobalError } from "@/hooks/error-bus";

const AUTO_DISMISS_MS = 5000;

export function ErrorBannerHost() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToGlobalError((nextMessage) => {
      setMessage(nextMessage);
    });
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <View style={styles.banner}>
        <ThemedText style={styles.message}>{message}</ThemedText>
        <Pressable onPress={() => setMessage(null)} style={styles.closeButton}>
          <ThemedText style={styles.closeText}>Dismiss</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 18,
    left: 18,
    right: 18,
    zIndex: 1000,
  },
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#FECDCA",
    backgroundColor: "#FEF3F2",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  message: {
    flex: 1,
    color: "#B42318",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  closeText: {
    color: "#B42318",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
  },
});
