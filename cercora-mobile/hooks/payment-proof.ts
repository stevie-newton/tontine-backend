import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { api } from "@/hooks/api-client";
import { translateText } from "@/hooks/use-i18n";

export const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2400;

export type PaymentProof = { uri: string; width: number; height: number; bytes: number };
export class PaymentProofSelectionError extends Error {}
export type ContributionReceipt = {
  id: number;
  amount: string | number;
  transaction_reference: string;
  proof_available: boolean;
};

export async function discardPaymentProof(proof: PaymentProof | null) {
  if (Platform.OS === "web" && proof?.uri.startsWith("blob:")) {
    URL.revokeObjectURL(proof.uri);
    return;
  }
  // Delete only our processed cache copy, never the photo in the user's library.
  if (proof && FileSystem.cacheDirectory && proof.uri.startsWith(FileSystem.cacheDirectory)) {
    await FileSystem.deleteAsync(proof.uri, { idempotent: true }).catch(() => {});
  }
}

export async function choosePaymentProof(): Promise<PaymentProof | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], allowsMultipleSelection: false, allowsEditing: false,
    quality: 1, exif: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset || asset.width <= 0 || asset.height <= 0 || asset.width * asset.height > 24_000_000) {
    if (Platform.OS === "web" && asset?.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
    throw new PaymentProofSelectionError(translateText("Choose a smaller screenshot (up to 24 megapixels)."));
  }
  const context = ImageManipulator.manipulate(asset.uri);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  try {
    if (Math.max(asset.width, asset.height) > MAX_IMAGE_EDGE) {
      context.resize(asset.width >= asset.height ? { width: MAX_IMAGE_EDGE } : { height: MAX_IMAGE_EDGE });
    }
    rendered = await context.renderAsync();
    const image = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: true });
    const bytes = image.base64
      ? Math.floor(image.base64.length * 3 / 4) - (image.base64.endsWith("==") ? 2 : image.base64.endsWith("=") ? 1 : 0)
      : 0;
    const proof = { uri: image.uri, width: image.width, height: image.height, bytes };
    if (!bytes || bytes > MAX_PROOF_BYTES) {
      await discardPaymentProof(proof);
      throw new PaymentProofSelectionError(translateText("Choose a screenshot smaller than 5 MB."));
    }
    return proof;
  } finally {
    // The web renderer creates an intermediate object URL as well as the saved image.
    const renderedUri = (rendered as { uri?: string } | undefined)?.uri;
    if (Platform.OS === "web" && renderedUri?.startsWith("blob:")) URL.revokeObjectURL(renderedUri);
    rendered?.release();
    context.release();
    if (Platform.OS === "web" && asset.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
  }
}

export async function submitContribution(
  values: { cycleId: number; amount: string; reference: string },
  proof: PaymentProof | null,
  onProgress?: (percent: number) => void,
): Promise<ContributionReceipt> {
  const fields = {
    cycle_id: values.cycleId,
    amount: values.amount.trim().replace(",", "."),
    transaction_reference: values.reference.trim(),
  };
  if (!Number.isSafeInteger(fields.cycle_id) || fields.cycle_id <= 0) {
    throw new Error(translateText("Invalid route params."));
  }
  if (!/^\d+(\.\d{1,2})?$/.test(fields.amount) || !Number.isFinite(Number(fields.amount)) || Number(fields.amount) <= 0) {
    throw new Error(translateText("Enter a valid contribution amount."));
  }
  if (!fields.transaction_reference || fields.transaction_reference.length > 120) {
    throw new Error(translateText("Enter a transaction reference (up to 120 characters)."));
  }
  if (!proof) return (await api.post<ContributionReceipt>("/contributions/", fields)).data;
  if (proof.bytes <= 0 || proof.bytes > MAX_PROOF_BYTES) {
    throw new Error(translateText("Choose a screenshot smaller than 5 MB."));
  }
  const body = new FormData();
  body.append("cycle_id", String(fields.cycle_id));
  body.append("amount", fields.amount);
  body.append("transaction_reference", fields.transaction_reference);
  if (Platform.OS === "web") {
    const response = await fetch(proof.uri);
    body.append("proof", await response.blob(), "payment-proof.jpg");
  } else {
    body.append("proof", { uri: proof.uri, name: "payment-proof.jpg", type: "image/jpeg" } as unknown as Blob);
  }
  return (await api.post<ContributionReceipt>("/contributions/with-proof", body, {
    timeout: 60_000,
    headers: Platform.OS === "web" ? undefined : { "Content-Type": "multipart/form-data" },
    onUploadProgress: event => {
      if (event.total) onProgress?.(Math.min(100, Math.round(event.loaded / event.total * 100)));
    },
  })).data;
}
