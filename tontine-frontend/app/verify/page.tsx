import { redirect } from "next/navigation";

export default async function VerifyPhonePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextQuery = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") {
      nextQuery.set(key, value);
      return;
    }
    value?.forEach((entry) => nextQuery.append(key, entry));
  });

  const suffix = nextQuery.toString();
  redirect(suffix ? `/verify-phone?${suffix}` : "/verify-phone");
}
