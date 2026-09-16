import { Image } from "expo-image";
import createQrCode from "qrcode-generator";
import React, { useMemo, useState } from "react";
import { Share, View } from "react-native";
import { AppButton, AppCard, AppTypography, useSurfaceColors } from "@/components/ui/app-surface";
import { ThemedText } from "@/components/themed-text";
import { createInvitationLink } from "@/hooks/invitation-links";
import { getErrorMessage } from "@/hooks/error-utils";
import { useI18n } from "@/hooks/use-i18n";

export function InvitationShare({ tontineId }: { tontineId: number }) {
  const { t } = useI18n();
  const colors = useSurfaceColors();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const link = useMemo(() => createInvitationLink(tontineId), [tontineId]);
  const qrImage = useMemo(() => {
    const qr = createQrCode(0, "M");
    qr.addData(link);
    qr.make();
    return qr.createDataURL(6, 24);
  }, [link]);
  async function share() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await Share.share({ message: t("Open your Cercora invitation: {{link}}", { link }) });
    } catch (e) { setError(getErrorMessage(e)); }
    finally { setBusy(false); }
  }
  return <AppCard>
    <ThemedText style={AppTypography.section}>{t("Share this invitation")}</ThemedText>
    <ThemedText style={{ color: colors.muted }}>{t("Only the invited phone number can accept. Sharing this code does not grant access to anyone else.")}</ThemedText>
    <View style={{ alignItems: "center" }}>
      <Image accessibilityLabel={t("Invitation QR code")} source={{ uri: qrImage }} style={{ width: 240, height: 240, maxWidth: "100%", backgroundColor: "#FFFFFF" }} contentFit="contain" />
    </View>
    <ThemedText selectable style={[AppTypography.caption, { color: colors.accent }]}>{link}</ThemedText>
    <AppButton disabled={busy} label={t("Share invitation link")} onPress={() => void share()} />
    <ThemedText style={[AppTypography.caption, { color: colors.muted }]}>{t("You can also select and copy the link above.")}</ThemedText>
    {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
  </AppCard>;
}
