import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";

import { BrandColors } from "@/constants/brand";

type BrandBackdropProps = {
  style?: StyleProp<ViewStyle>;
};

export function BrandBackdrop({ style }: BrandBackdropProps) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, style]}>
      <View style={styles.wash} />
      <View style={[styles.orb, styles.orbTopLeft]} />
      <View style={[styles.orb, styles.orbTopRight]} />
      <View style={[styles.orb, styles.orbCenter]} />
      <View style={[styles.orb, styles.orbBottom]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
  },
  orbTopLeft: {
    top: -44,
    left: -30,
    width: 210,
    height: 210,
    backgroundColor: BrandColors.cyan,
    opacity: 0.16,
  },
  orbTopRight: {
    top: -34,
    right: -34,
    width: 210,
    height: 210,
    backgroundColor: BrandColors.violet,
    opacity: 0.12,
  },
  orbCenter: {
    top: "30%",
    right: "8%",
    width: 160,
    height: 160,
    backgroundColor: BrandColors.rose,
    opacity: 0.08,
  },
  orbBottom: {
    bottom: -84,
    left: "24%",
    width: 280,
    height: 280,
    backgroundColor: BrandColors.blue,
    opacity: 0.09,
  },
});
