import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { BrandColors } from "@/constants/brand";

type BrandBackdropProps = {
  style?: StyleProp<ViewStyle>;
};

export function BrandBackdrop({ style }: BrandBackdropProps) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, style]}>
      <View style={[styles.orb, styles.orbTopLeft]} />
      <View style={[styles.orb, styles.orbTopRight]} />
      <View style={[styles.orb, styles.orbBottom]} />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbTopLeft: {
    top: -36,
    left: -22,
    width: 180,
    height: 180,
    backgroundColor: BrandColors.cyan,
    opacity: 0.14,
  },
  orbTopRight: {
    top: -28,
    right: -26,
    width: 190,
    height: 190,
    backgroundColor: BrandColors.violet,
    opacity: 0.11,
  },
  orbBottom: {
    bottom: -70,
    left: "28%",
    width: 240,
    height: 240,
    backgroundColor: BrandColors.blue,
    opacity: 0.08,
  },
});
