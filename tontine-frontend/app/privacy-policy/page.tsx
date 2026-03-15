"use client";

import type { Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import AuthLocaleToggle from "@/components/AuthLocaleToggle";
import BrandLogo from "@/src/components/BrandLogo";

type PolicySection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

type PolicyContent = {
  badge: string;
  title: string;
  subtitle: string;
  effectiveDateLabel: string;
  effectiveDate: string;
  intro: string;
  sections: PolicySection[];
  primaryCta: string;
  secondaryCta: string;
};

const POLICY_CONTENT: Record<Locale, PolicyContent> = {
  en: {
    badge: "Legal",
    title: "Privacy Policy",
    subtitle: "How Cercora collects, uses, stores, and protects personal information on the web app.",
    effectiveDateLabel: "Effective date",
    effectiveDate: "March 15, 2026",
    intro:
      "This Privacy Policy explains how Cercora handles personal information when you create an account, join or manage a tontine, submit contributions, receive reminders, or contact support through the web app.",
    sections: [
      {
        heading: "Information We Collect",
        paragraphs: [
          "We collect information you provide directly, such as your name, phone number, password, support messages, and any payment proof or screenshots you choose to upload or reference.",
          "We also process tontine activity data needed to run the service, including memberships, contributions, payout records, debt records, reminder activity, and transaction references.",
        ],
      },
      {
        heading: "How We Use Information",
        bullets: [
          "Create and secure your account.",
          "Manage tontines, cycles, contributions, debts, payouts, and transaction history.",
          "Send verification codes, reminders, and service notifications.",
          "Provide support, investigate issues, and improve reliability and security.",
          "Comply with legal obligations and prevent fraud or abuse.",
        ],
      },
      {
        heading: "When We Share Information",
        paragraphs: [
          "We do not sell your personal information. We may share limited information with service providers that help operate the platform, such as hosting, messaging, analytics, or payment-related providers, only as needed to deliver the service.",
          "Information may also be disclosed if required by law, to enforce platform rules, or to protect users, Cercora, or the public from fraud, security threats, or other harm.",
        ],
      },
      {
        heading: "Data Retention",
        paragraphs: [
          "We keep account and transaction-related information for as long as needed to operate tontines, maintain financial records, resolve disputes, support audits, and meet legal or operational requirements.",
          "If you request account deletion, some information may be retained where records are required for security, compliance, or existing tontine obligations.",
        ],
      },
      {
        heading: "Your Choices and Rights",
        bullets: [
          "You can review and update certain profile details in the app.",
          "You can request account deletion, subject to active tontine and record-retention limits.",
          "You can choose whether to provide optional information such as support screenshots.",
          "You can contact Cercora through the available support channels if you have privacy questions or requests.",
        ],
      },
      {
        heading: "Security",
        paragraphs: [
          "We use reasonable administrative, technical, and organizational measures to protect personal information. No online service can guarantee absolute security, so users should also protect their login credentials and devices.",
        ],
      },
      {
        heading: "Policy Updates",
        paragraphs: [
          "We may update this Privacy Policy from time to time. When material changes are made, we may update the effective date and provide notice through the app or other appropriate channels.",
        ],
      },
    ],
    primaryCta: "Back to login",
    secondaryCta: "Create account",
  },
  fr: {
    badge: "Juridique",
    title: "Politique de confidentialite",
    subtitle: "Comment Cercora collecte, utilise, conserve et protege les informations personnelles sur l application web.",
    effectiveDateLabel: "Date d effet",
    effectiveDate: "15 mars 2026",
    intro:
      "Cette politique de confidentialite explique comment Cercora traite les informations personnelles lorsque vous creez un compte, rejoignez ou gerez une tontine, soumettez des contributions, recevez des rappels ou contactez le support via l application web.",
    sections: [
      {
        heading: "Informations que nous collectons",
        paragraphs: [
          "Nous collectons les informations que vous fournissez directement, comme votre nom, votre numero de telephone, votre mot de passe, vos messages au support et toute preuve de paiement ou capture d ecran que vous choisissez d envoyer ou de referencer.",
          "Nous traitons aussi les donnees d activite necessaires au fonctionnement du service, notamment les adhesions, contributions, paiements, dettes, rappels et references de transaction.",
        ],
      },
      {
        heading: "Comment nous utilisons les informations",
        bullets: [
          "Creer et securiser votre compte.",
          "Gerer les tontines, cycles, contributions, dettes, paiements et historiques de transaction.",
          "Envoyer des codes de verification, des rappels et des notifications de service.",
          "Fournir le support, analyser les incidents et ameliorer la fiabilite et la securite.",
          "Respecter les obligations legales et prevenir la fraude ou les abus.",
        ],
      },
      {
        heading: "Quand nous partageons les informations",
        paragraphs: [
          "Nous ne vendons pas vos informations personnelles. Nous pouvons partager des informations limitees avec des prestataires qui aident a exploiter la plateforme, comme l hebergement, la messagerie, l analyse ou les services lies au paiement, seulement dans la mesure necessaire au service.",
          "Les informations peuvent aussi etre communiquees si la loi l exige, pour faire respecter les regles de la plateforme, ou pour proteger les utilisateurs, Cercora ou le public contre la fraude, les risques de securite ou d autres dommages.",
        ],
      },
      {
        heading: "Conservation des donnees",
        paragraphs: [
          "Nous conservons les informations de compte et de transaction aussi longtemps que necessaire pour exploiter les tontines, maintenir les registres financiers, resoudre les litiges, soutenir les audits et respecter les exigences legales ou operationnelles.",
          "Si vous demandez la suppression du compte, certaines informations peuvent etre conservees lorsqu elles restent necessaires pour la securite, la conformite ou des obligations existantes liees a une tontine.",
        ],
      },
      {
        heading: "Vos choix et vos droits",
        bullets: [
          "Vous pouvez consulter et mettre a jour certains details de profil dans l application.",
          "Vous pouvez demander la suppression du compte, sous reserve des limites liees aux tontines actives et a la conservation des enregistrements.",
          "Vous pouvez choisir de fournir ou non des informations optionnelles comme des captures d ecran pour le support.",
          "Vous pouvez contacter Cercora via les canaux de support disponibles pour toute question ou demande relative a la confidentialite.",
        ],
      },
      {
        heading: "Securite",
        paragraphs: [
          "Nous utilisons des mesures administratives, techniques et organisationnelles raisonnables pour proteger les informations personnelles. Aucun service en ligne ne peut garantir une securite absolue, et les utilisateurs doivent aussi proteger leurs identifiants et leurs appareils.",
        ],
      },
      {
        heading: "Mises a jour de la politique",
        paragraphs: [
          "Nous pouvons mettre a jour cette politique de confidentialite de temps en temps. En cas de changement important, nous pouvons mettre a jour la date d effet et fournir un avis dans l application ou par un autre canal approprie.",
        ],
      },
    ],
    primaryCta: "Retour a la connexion",
    secondaryCta: "Creer un compte",
  },
};

export default function PrivacyPolicyPage() {
  const { locale } = useI18n();
  const content = POLICY_CONTENT[locale];

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

              <div className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-[rgba(79,107,194,0.16)] bg-[rgba(20,35,68,0.03)] px-4 py-2 text-sm text-[color:var(--brand-ink)]">
                <span className="font-semibold">{content.effectiveDateLabel}:</span>
                <span>{content.effectiveDate}</span>
              </div>
            </div>

            <div className="rounded-3xl bg-[linear-gradient(145deg,rgba(16,36,72,0.96)_0%,rgba(30,78,188,0.92)_42%,rgba(126,53,194,0.92)_100%)] p-5 text-white shadow-[0_18px_40px_rgba(44,102,215,0.18)]">
              <BrandLogo width={260} height={180} className="h-auto max-w-[160px]" />
              <p className="mt-4 max-w-xs text-sm leading-6 text-white/82">{content.intro}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4">
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
              href="/register"
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
