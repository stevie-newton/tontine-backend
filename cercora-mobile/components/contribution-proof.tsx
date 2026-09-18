import { Image } from "expo-image";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { BrandColors } from "@/constants/brand";
import { api } from "@/hooks/api-client";
import { normalizeApiError } from "@/hooks/error-utils";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/hooks/use-i18n";
import { useThemeColor } from "@/hooks/use-theme-color";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;

type ContributionProofProps = {
  contributionId: number;
};

// Only accepts an internal contribution ID. Legacy external proof links must
// never be fetched through the authenticated API client.
export function ContributionProof({ contributionId }: ContributionProofProps) {
  const { accessToken } = useAuth();
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const buttonColor = useThemeColor({ light: BrandColors.blue, dark: "#AFCBFF" }, "tint");

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setIsOpen(true)}
        style={[styles.button, { borderColor: buttonColor }]}
      >
        <ThemedText style={[styles.buttonText, { color: buttonColor }]}>{t("View payment proof")}</ThemedText>
      </Pressable>
      {isOpen && accessToken ? (
        <ProofModal
          key={contributionId}
          contributionId={contributionId}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}

function ProofModal({ contributionId, onClose }: ContributionProofProps & { onClose: () => void }) {
  const { accessToken } = useAuth();
  const { t } = useI18n();
  const backgroundColor = useThemeColor({}, "background");
  const buttonColor = useThemeColor({ light: BrandColors.blue, dark: "#AFCBFF" }, "tint");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const reader = new FileReader();
    let active = true;

    async function loadProof() {
      setImageUri(null);
      setHasError(false);
      setIsLoading(true);
      try {
        const response = await api.get<Blob>(`/contributions/${contributionId}/proof`, {
          responseType: "blob",
          headers: { Accept: "image/jpeg" },
          signal: controller.signal,
        });
        if (!active) return;
        const contentType = String(response.headers["content-type"] ?? "").split(";")[0].trim();
        if (contentType !== "image/jpeg" || !response.data.size || response.data.size > MAX_PROOF_BYTES) {
          throw new Error("Invalid payment proof response");
        }

        // A local data URI works on native and web without passing credentials
        // to an image loader. It is discarded on close and never cached to disk.
        const uri = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            if (typeof reader.result === "string") resolve(reader.result);
            else reject(new Error("Unable to read payment proof"));
          };
          reader.onerror = () => reject(new Error("Unable to read payment proof"));
          reader.onabort = () => reject(new Error("Payment proof read cancelled"));
          reader.readAsDataURL(response.data);
        });
        if (active) setImageUri(uri);
      } catch (error) {
        if (active && normalizeApiError(error).status !== 401) {
          setHasError(true);
          setIsLoading(false);
        }
      }
    }

    void loadProof();
    return () => {
      active = false;
      controller.abort();
      reader.abort();
    };
  }, [accessToken, attempt, contributionId]);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modal, { backgroundColor }]} accessibilityViewIsModal>
        <View style={styles.header}>
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.title}>{t("Payment proof")}</ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Close payment proof")}
            onPress={onClose}
            style={styles.closeButton}
          >
            <ThemedText style={[styles.buttonText, { color: buttonColor }]}>{t("Close")}</ThemedText>
          </Pressable>
        </View>
        <View style={styles.imageArea}>
          {imageUri && !hasError ? (
            <Image
              key={attempt}
              source={{ uri: imageUri }}
              style={styles.image}
              contentFit="contain"
              cachePolicy="none"
              accessible
              accessibilityLabel={t("Payment proof screenshot")}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setHasError(true);
                setIsLoading(false);
              }}
            />
          ) : null}
          {isLoading ? (
            <View style={[styles.status, StyleSheet.absoluteFill]} accessibilityLiveRegion="polite">
              <ActivityIndicator color={buttonColor} />
              <ThemedText style={styles.statusText}>{t("Loading payment proof...")}</ThemedText>
            </View>
          ) : null}
          {hasError ? (
            <View style={styles.status} accessibilityLiveRegion="polite">
              <ThemedText style={styles.statusText}>{t("Unable to load payment proof. Please try again.")}</ThemedText>
              <Pressable
                accessibilityRole="button"
                style={[styles.button, { borderColor: buttonColor, alignSelf: "center" }]}
                onPress={() => setAttempt((value) => value + 1)}
              >
                <ThemedText style={[styles.buttonText, { color: buttonColor }]}>{t("Try again")}</ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonText: { fontWeight: "700", fontSize: 14, lineHeight: 20 },
  modal: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 16, padding: 16 },
  title: { flex: 1 },
  closeButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", padding: 8 },
  imageArea: { flex: 1, marginHorizontal: 16, marginBottom: 16 },
  image: { flex: 1, width: "100%" },
  status: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 20 },
  statusText: { textAlign: "center" },
});
