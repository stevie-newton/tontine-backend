import { Suspense } from "react";

import VerifyPhoneForm from "@/components/VerifyPhoneForm";

export default function VerifyPhoneRoutePage() {
  return (
    <Suspense fallback={null}>
      <VerifyPhoneForm />
    </Suspense>
  );
}
