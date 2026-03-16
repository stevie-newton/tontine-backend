"use client";

import type { Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import AuthLocaleToggle from "@/components/AuthLocaleToggle";
import BrandLogo from "@/src/components/BrandLogo";

type ContentSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type DeletionContent = {
  badge: string;
  title: string;
  subtitle: string;
  intro: string;
  stepsTitle: string;
  steps: string[];
  sections: ContentSection[];
  primaryCta: string;
  secondaryCta: string;
};

const CONTENT: Record<Locale, DeletionContent> = {
  en: {
    badge: "Account Help",
    title: "Delete Your Account",
    subtitle: "Public account deletion instructions for Cercora users on web and mobile.",
    intro:
      "Cercora lets users request permanent account deletion from inside the product. This page explains how to delete your account and the cases where deletion may be blocked until active obligations are resolved.",
    stepsTitle: "How to delete your account",
    steps: [
      "Sign in to your Cercora account.",
      "On the web app, open My Tontines and use the Delete Account button.",
      "On the mobile app, open Profile and choose Delete account.",
      "Confirm the deletion request when prompted.",
    ],
    sections: [
      {
        heading: "When deletion can be blocked",
        bullets: [
          "If you own an active tontine group.",
          "If you are still an active member of an active tontine group.",
          "If related financial records exist and the account cannot be removed safely.",
        ],
      },
      {
        heading: "What happens after deletion",
        paragraphs: [
          "If your deletion request is accepted, your account is permanently removed and you will lose access to the app.",
          "Some records may still be retained where necessary for security, compliance, fraud prevention, dispute handling, or existing financial obligations tied to tontine activity.",
        ],
      },
      {
        heading: "If you cannot delete yet",
        paragraphs: [
          "If deletion is blocked, complete or exit active tontine obligations first, then try again. The product will return an error message when the request cannot be completed.",
        ],
      },
    ],
    primaryCta: "Sign in",
    secondaryCta: "View privacy policy",
  },
  fr: {
    badge: "Aide Compte",
    title: "Supprimer votre compte",
    subtitle: "Instructions publiques de suppression de compte pour les utilisateurs Cercora sur le web et le mobile.",
    intro:
      "Cercora permet aux utilisateurs de demander la suppression definitive de leur compte depuis l application. Cette page explique comment supprimer votre compte et dans quels cas la suppression peut etre bloquee jusqu a la resolution des obligations actives.",
    stepsTitle: "Comment supprimer votre compte",
    steps: [
      "Connectez-vous a votre compte Cercora.",
      "Sur l application web, ouvrez Mes tontines puis utilisez le bouton Supprimer le compte.",
      "Sur l application mobile, ouvrez Profil puis choisissez Supprimer le compte.",
      "Confirmez la demande de suppression lorsque le systeme vous le demande.",
    ],
    sections: [
      {
        heading: "Quand la suppression peut etre bloquee",
        bullets: [
          "Si vous etes proprietaire d une tontine active.",
          "Si vous etes encore membre actif d une tontine active.",
          "Si des enregistrements financiers lies au compte existent et empechent une suppression securisee.",
        ],
      },
      {
        heading: "Ce qui se passe apres la suppression",
        paragraphs: [
          "Si votre demande est acceptee, votre compte est supprime de facon definitive et vous perdez l acces a l application.",
          "Certaines donnees peuvent toutefois etre conservees lorsque cela reste necessaire pour la securite, la conformite, la prevention de la fraude, la gestion des litiges ou des obligations financieres existantes liees a une tontine.",
        ],
      },
      {
        heading: "Si vous ne pouvez pas encore supprimer le compte",
        paragraphs: [
          "Si la suppression est bloquee, terminez ou quittez d abord les obligations actives liees a vos tontines, puis reessayez. L application affichera un message d erreur si la demande ne peut pas etre finalisee.",
        ],
      },
    ],
    primaryCta: "Se connecter",
    secondaryCta: "Voir la politique de confidentialite",
  },
};

export default function DeleteAccountPage() {
  const { locale } = useI18n();
  const content = CONTENT[locale];

  return (
    <main className="relative min-h-screen bg-transparent px-4 py-6 sm:px-6 lg:px-8">
      <AuthLocaleToggle />

      <div className="mx-auto max-w-5xl">
        <div className="rounded-[32px] border border-[rgba(79,107,194,0.14)] bg-white/86 p-6 shadow-[0_28px_70px_rgba(44,102,215,0.12)] backdrop-blur-sm sm:p-8 lg:p-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(79,107,194,0.16)] bg-[rgba(46,207,227,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-blue)]">
                <span className="h-2 w-2 rounded-full bg-[color:var(--brand-cyan)]" />
                {content.badge}
              </div>

              <h1 className="mt-5 text-3xl font-semibold leading-tight text-[color:var(--brand-ink)] sm:text-4xl">
                {content.title}
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-[color:var(--brand-muted)] sm:text-base">
                {content.subtitle}
              </p>
            </div>

            <div className="rounded-3xl bg-[linear-gradient(145deg,rgba(16,36,72,0.96)_0%,rgba(30,78,188,0.92)_42%,rgba(126,53,194,0.92)_100%)] p-5 text-white shadow-[0_18px_40px_rgba(44,102,215,0.18)]">
              <BrandLogo width={260} height={180} className="h-auto max-w-[160px]" />
              <p className="mt-4 max-w-xs text-sm leading-6 text-white/82">{content.intro}</p>
            </div>
          </div>

          <section className="mt-8 rounded-3xl border border-[rgba(79,107,194,0.14)] bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_14px_30px_rgba(44,102,215,0.08)] sm:p-6">
            <h2 className="text-lg font-semibold text-[color:var(--brand-ink)]">{content.stepsTitle}</h2>
            <ol className="mt-4 space-y-3">
              {content.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm leading-7 text-[color:var(--brand-muted)] sm:text-[15px]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(44,102,215,0.12)] text-xs font-semibold text-[color:var(--brand-blue)]">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <div className="mt-4 grid gap-4">
            {content.sections.map((section) => (
              <section
                key={section.heading}
                className="rounded-3xl border border-[rgba(79,107,194,0.14)] bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_14px_30px_rgba(44,102,215,0.08)] sm:p-6"
              >
                <h2 className="text-lg font-semibold text-[color:var(--brand-ink)]">{section.heading}</h2>

                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-sm leading-7 text-[color:var(--brand-muted)] sm:text-[15px]">
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="mt-4 space-y-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-3 text-sm leading-7 text-[color:var(--brand-muted)] sm:text-[15px]">
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[color:var(--brand-blue)]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/login"
              className="inline-flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2ecfe3_0%,#2c66d7_46%,#8a37c9_100%)] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_35px_rgba(44,102,215,0.22)] transition hover:brightness-105"
            >
              {content.primaryCta}
            </a>
            <a
              href="/privacy-policy"
              className="inline-flex items-center justify-center rounded-2xl border border-[rgba(79,107,194,0.18)] bg-white px-5 py-3 text-sm font-medium text-[color:var(--brand-ink)] transition hover:bg-[rgba(46,207,227,0.08)]"
            >
              {content.secondaryCta}
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
