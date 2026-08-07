"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import BrandLogo from "@/src/components/BrandLogo";

const WHATSAPP_COMMUNITY_URL = "https://chat.whatsapp.com/FPkAMaDSwcDJeeSPObvY59";

const copy = {
  en: {
    nav: ["How it works", "Features", "Security"],
    signIn: "Sign in",
    getStarted: "Get started",
    eyebrow: "The modern savings circle",
    titleA: "Save together.",
    titleB: "Grow with confidence.",
    hero: "Cercora brings your tontine online—making contributions clear, payouts organized, and every member accountable.",
    start: "Start your tontine",
    explore: "See how it works",
    noCard: "Free to create an account · Set up in minutes",
    mockTitle: "Community Circle",
    active: "Active",
    nextPayout: "Next payout",
    contribution: "Monthly contribution",
    progress: "This month’s progress",
    membersPaid: "5 of 6 members paid",
    secure: "Protected and transparent",
    secureBody: "Every contribution is recorded, every payout is visible, and every member stays informed.",
    sectionTag: "Simple by design",
    sectionTitle: "Your circle, running smoothly",
    sectionBody: "From the first invitation to the final payout, Cercora keeps everyone on the same page.",
    steps: [
      ["01", "Create your circle", "Choose the contribution amount, schedule, and invite the people you trust."],
      ["02", "Contribute together", "Members track their payments and see the circle’s progress in real time."],
      ["03", "Celebrate every payout", "Keep each cycle organized with a clear beneficiary and payment history."],
    ],
    featuresTag: "Built for trust",
    featuresTitle: "Clarity for every member",
    featuresBody: "The familiar power of community saving, backed by tools that make coordination effortless.",
    features: [
      ["Clear contribution tracking", "See who has contributed and what remains—without chasing spreadsheets or chat messages."],
      ["Organized payout cycles", "Keep upcoming beneficiaries, cycle status, and group activity in one shared place."],
      ["Member reliability", "Build confidence with a transparent record of participation across completed cycles."],
      ["Cover payments & debts", "Handle missed contributions clearly, including cover payments and repayment records."],
    ],
    communityTag: "Stronger together",
    communityTitle: "Traditional saving, thoughtfully modernized.",
    communityBody: "Cercora respects how tontines already work. We simply give your group a clearer, calmer way to manage the details—so you can focus on the people and goals that matter.",
    communityPoints: ["English and French", "Mobile-friendly experience", "Clear member roles"],
    ctaTitle: "Ready to move your circle forward?",
    ctaBody: "Create your Cercora account and bring transparency to your next savings cycle.",
    whatsapp: "Join the WhatsApp community",
    payoutDate: "Aug 15",
    memberCount: "6 members",
    footer: "Community-powered saving, made simple.",
    product: "Product",
    company: "Resources",
    privacy: "Privacy",
    motto: "Save together · Grow together",
    rights: "All rights reserved.",
  },
  fr: {
    nav: ["Fonctionnement", "Fonctionnalités", "Sécurité"],
    signIn: "Se connecter",
    getStarted: "Commencer",
    eyebrow: "La tontine moderne",
    titleA: "Épargnez ensemble.",
    titleB: "Avancez en confiance.",
    hero: "Cercora met votre tontine en ligne : des cotisations claires, des paiements organisés et des membres responsables.",
    start: "Créer ma tontine",
    explore: "Découvrir le fonctionnement",
    noCard: "Compte gratuit · Configuration en quelques minutes",
    mockTitle: "Cercle Communauté",
    active: "Actif",
    nextPayout: "Prochain paiement",
    contribution: "Cotisation mensuelle",
    progress: "Progression ce mois-ci",
    membersPaid: "5 membres sur 6 ont payé",
    secure: "Protégé et transparent",
    secureBody: "Chaque cotisation est enregistrée, chaque paiement est visible et chaque membre reste informé.",
    sectionTag: "Simple par nature",
    sectionTitle: "Votre cercle, sans complications",
    sectionBody: "De la première invitation au dernier paiement, Cercora permet à tous de rester alignés.",
    steps: [
      ["01", "Créez votre cercle", "Choisissez le montant, le calendrier et invitez les personnes de confiance."],
      ["02", "Cotisez ensemble", "Les membres suivent leurs paiements et la progression du cercle en temps réel."],
      ["03", "Célébrez chaque paiement", "Organisez chaque cycle avec un bénéficiaire et un historique clairs."],
    ],
    featuresTag: "Conçu pour la confiance",
    featuresTitle: "De la clarté pour chaque membre",
    featuresBody: "La force de l’épargne communautaire, soutenue par des outils qui simplifient la coordination.",
    features: [
      ["Suivi clair des cotisations", "Voyez qui a cotisé et ce qu’il reste, sans feuilles de calcul ni relances incessantes."],
      ["Cycles de paiement organisés", "Retrouvez les bénéficiaires, le statut du cycle et l’activité du groupe au même endroit."],
      ["Fiabilité des membres", "Renforcez la confiance grâce à un historique transparent de participation."],
      ["Paiements de couverture", "Gérez clairement les cotisations manquées, les avances et les remboursements."],
    ],
    communityTag: "Plus forts ensemble",
    communityTitle: "L’épargne traditionnelle, modernisée avec soin.",
    communityBody: "Cercora respecte le fonctionnement naturel des tontines. Nous offrons simplement à votre groupe une façon plus claire et sereine de gérer les détails.",
    communityPoints: ["Français et anglais", "Expérience mobile", "Rôles clairs pour les membres"],
    ctaTitle: "Prêt à faire avancer votre cercle ?",
    ctaBody: "Créez votre compte Cercora et apportez plus de transparence à votre prochain cycle.",
    whatsapp: "Rejoindre la communauté WhatsApp",
    payoutDate: "15 août",
    memberCount: "6 membres",
    footer: "L’épargne communautaire, en toute simplicité.",
    product: "Produit",
    company: "Ressources",
    privacy: "Confidentialité",
    motto: "Épargner ensemble · Grandir ensemble",
    rights: "Tous droits réservés.",
  },
} as const;

function CercoraMark() {
  return <BrandLogo width={260} height={180} className="h-auto max-w-[120px]" />;
}

function Icon({ type }: { type: number }) {
  const paths = [
    <path key="a" d="M4 18V8l8-4 8 4v10M8 20v-7h8v7M3 20h18" />,
    <path key="b" d="M4 7h16M6 3h12l2 4-2 4H6L4 7l2-4ZM8 14h8M9 18h6M12 11v9" />,
    <path key="c" d="M12 3a9 9 0 1 0 9 9M12 7v5l3 2M17 3v4h4" />,
    <path key="d" d="M12 3 4 7v5c0 5 3.4 8 8 9 4.6-1 8-4 8-9V7l-8-4Zm-3 9 2 2 4-4" />,
  ];
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{paths[type]}</svg>;
}

export default function HomePage() {
  const { locale, setLocale } = useI18n();
  const c = copy[locale];

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8fbff] text-[#172650]">
      <header className="relative z-20 border-b border-[#dbe6f5]/80 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="shrink-0"><CercoraMark /></Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-[#536481] md:flex">
            <a href="#how-it-works" className="transition hover:text-[#2c66d7]">{c.nav[0]}</a>
            <a href="#features" className="transition hover:text-[#2c66d7]">{c.nav[1]}</a>
            <a href="#security" className="transition hover:text-[#2c66d7]">{c.nav[2]}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full border border-[#dbe6f5] bg-[#f7faff] p-0.5 sm:flex">
              <button onClick={() => setLocale("en")} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${locale === "en" ? "bg-white text-[#172650] shadow-sm" : "text-[#73819a]"}`}>EN</button>
              <button onClick={() => setLocale("fr")} className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${locale === "fr" ? "bg-white text-[#172650] shadow-sm" : "text-[#73819a]"}`}>FR</button>
            </div>
            <Link href="/login" className="hidden px-2 py-2 text-sm font-semibold text-[#364868] transition hover:text-[#2c66d7] sm:block">{c.signIn}</Link>
            <Link href="/register" className="rounded-full bg-[#172650] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(23,38,80,0.18)] transition hover:-translate-y-0.5 hover:bg-[#2c66d7] sm:px-5">{c.getStarted}</Link>
          </div>
        </div>
      </header>

      <section className="relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_25%,rgba(46,207,227,0.17),transparent_28%),radial-gradient(circle_at_88%_20%,rgba(138,55,201,0.13),transparent_26%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 sm:pt-24 lg:grid-cols-[1.02fr_0.98fr] lg:pb-32 lg:pt-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#cfe7f4] bg-white/80 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.15em] text-[#2c66d7] shadow-sm">
              <span className="h-2 w-2 rounded-full bg-[#2ecfe3] shadow-[0_0_0_4px_rgba(46,207,227,0.14)]" />{c.eyebrow}
            </div>
            <h1 className="max-w-3xl text-[clamp(3.1rem,7vw,5.8rem)] font-black leading-[0.95] tracking-[-0.065em] text-[#142344]">
              {c.titleA}<br /><span className="bg-[linear-gradient(105deg,#15b9d2_5%,#2c66d7_48%,#8a37c9_92%)] bg-clip-text text-transparent">{c.titleB}</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[#5d6c8f] sm:text-xl">{c.hero}</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/register" className="group inline-flex items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,#24bfd5,#2c66d7_55%,#8438c7)] px-7 py-4 text-sm font-bold text-white shadow-[0_18px_36px_rgba(44,102,215,0.25)] transition hover:-translate-y-1 hover:shadow-[0_22px_44px_rgba(44,102,215,0.32)]">
                {c.start}<span className="transition group-hover:translate-x-1">→</span>
              </Link>
              <a href="#how-it-works" className="inline-flex items-center justify-center gap-2 rounded-full border border-[#ccd9ec] bg-white/75 px-7 py-4 text-sm font-bold text-[#273a62] transition hover:border-[#8da8d6] hover:bg-white">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#e9f2ff] text-[10px] text-[#2c66d7]">▶</span>{c.explore}
              </a>
            </div>
            <p className="mt-5 flex items-center gap-2 text-xs font-medium text-[#7b89a2]"><span className="text-emerald-500">✓</span>{c.noCard}</p>
          </div>

          <div className="relative mx-auto w-full max-w-[560px] lg:mx-0">
            <div className="absolute -inset-8 rounded-full bg-[linear-gradient(135deg,rgba(46,207,227,0.25),rgba(44,102,215,0.13),rgba(138,55,201,0.2))] blur-3xl" />
            <div className="relative rotate-[1.5deg] rounded-[2rem] border border-white/80 bg-white/82 p-3 shadow-[0_35px_90px_rgba(36,73,145,0.2)] backdrop-blur-xl transition duration-500 hover:rotate-0 sm:p-4">
              <div className="overflow-hidden rounded-[1.45rem] bg-[#f7faff]">
                <div className="flex items-center justify-between border-b border-[#e4ebf6] bg-white px-5 py-4">
                  <CercoraMark />
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#2ecfe3]" /><span className="h-2 w-2 rounded-full bg-[#2c66d7]" /><span className="h-2 w-2 rounded-full bg-[#8a37c9]" /></div>
                </div>
                <div className="p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-3">
                    <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#8290aa]">Tontine</p><h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">{c.mockTitle}</h2></div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-600">● &nbsp;{c.active}</span>
                  </div>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#e1eaf6] bg-white p-4"><p className="text-xs text-[#7a8aa5]">{c.nextPayout}</p><p className="mt-2 text-lg font-extrabold">{c.payoutDate}</p><p className="mt-1 text-xs font-medium text-[#2c66d7]">Nadia K.</p></div>
                    <div className="rounded-2xl bg-[#172650] p-4 text-white"><p className="text-xs text-white/60">{c.contribution}</p><p className="mt-2 text-lg font-extrabold">$100 CAD</p><p className="mt-1 text-xs text-cyan-300">{c.memberCount}</p></div>
                  </div>
                  <div className="mt-3 rounded-2xl border border-[#e1eaf6] bg-white p-5">
                    <div className="flex justify-between text-xs"><span className="font-semibold text-[#415273]">{c.progress}</span><span className="font-extrabold text-[#2c66d7]">83%</span></div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eaf0f8]"><div className="h-full w-5/6 rounded-full bg-[linear-gradient(90deg,#2ecfe3,#2c66d7,#8a37c9)]" /></div>
                    <p className="mt-3 text-xs text-[#7a8aa5]">{c.membersPaid}</p>
                  </div>
                  <div className="mt-4 flex -space-x-2">
                    {["NK","AM","JS","LB","MK"].map((n, i) => <span key={n} className="grid h-9 w-9 place-items-center rounded-full border-2 border-white text-[10px] font-bold text-white" style={{background: ["#2c66d7","#8a37c9","#12a9c0","#44557a","#6d55c5"][i]}}>{n}</span>)}
                    <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-[#e8eef8] text-[10px] font-bold text-[#63738f]">+1</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-8 -left-5 flex max-w-[250px] items-center gap-3 rounded-2xl border border-white bg-white/95 p-3.5 shadow-[0_18px_45px_rgba(38,65,126,0.18)] sm:-left-12">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><Icon type={3} /></span>
              <span><strong className="block text-xs text-[#273a62]">{c.secure}</strong><span className="mt-0.5 block text-[10px] leading-4 text-[#7a8aa5]">{c.secureBody}</span></span>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#2c66d7]">{c.sectionTag}</p><h2 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-5xl">{c.sectionTitle}</h2><p className="mt-5 text-lg leading-8 text-[#667694]">{c.sectionBody}</p></div>
          <div className="relative mt-16 grid gap-5 lg:grid-cols-3">
            <div className="absolute left-[16%] right-[16%] top-10 hidden border-t border-dashed border-[#b8cae6] lg:block" />
            {c.steps.map((step, i) => <div key={step[0]} className="relative rounded-[1.75rem] border border-[#e0e9f5] bg-[#f9fbff] p-7 transition hover:-translate-y-1 hover:border-[#b9ceef] hover:shadow-[0_20px_50px_rgba(44,102,215,0.1)]"><span className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl bg-white text-sm font-black text-[#2c66d7] shadow-[0_8px_22px_rgba(44,102,215,0.13)]">{step[0]}</span><h3 className="mt-8 text-xl font-extrabold">{step[1]}</h3><p className="mt-3 leading-7 text-[#6a7994]">{step[2]}</p><span className="absolute right-7 top-7 text-[#d8e4f5]"><Icon type={i} /></span></div>)}
          </div>
        </div>
      </section>

      <section id="features" className="relative overflow-hidden bg-[#152344] py-24 text-white sm:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_20%,rgba(46,207,227,0.15),transparent_30%),radial-gradient(circle_at_90%_80%,rgba(138,55,201,0.2),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[0.75fr_1.25fr]">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-300">{c.featuresTag}</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">{c.featuresTitle}</h2><p className="mt-5 max-w-lg text-lg leading-8 text-white/65">{c.featuresBody}</p></div>
          <div className="grid gap-4 sm:grid-cols-2">{c.features.map((feature, i) => <div key={feature[0]} className="rounded-[1.5rem] border border-white/10 bg-white/[0.06] p-6 backdrop-blur-sm transition hover:bg-white/[0.1]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[linear-gradient(135deg,rgba(46,207,227,0.2),rgba(138,55,201,0.3))] text-cyan-200"><Icon type={i} /></span><h3 className="mt-5 text-lg font-bold">{feature[0]}</h3><p className="mt-2 text-sm leading-6 text-white/60">{feature[1]}</p></div>)}</div>
        </div>
      </section>

      <section id="security" className="bg-white py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-2">
          <div className="relative min-h-[420px] overflow-hidden rounded-[2.25rem] bg-[linear-gradient(145deg,#eefaff,#eef1ff_55%,#f8efff)] p-8 sm:p-12">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full border-[45px] border-white/55" />
            <div className="absolute -bottom-20 -left-14 h-64 w-64 rounded-full border-[45px] border-white/60" />
            <div className="relative mx-auto grid max-w-sm place-items-center pt-5">
              <div className="grid h-48 w-48 place-items-center rounded-full bg-white shadow-[0_25px_60px_rgba(44,102,215,0.14)]"><span className="grid h-32 w-32 place-items-center rounded-full bg-[linear-gradient(145deg,#dffaff,#e9e8ff,#f4e1ff)] text-[#2c66d7]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="h-20 w-20"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="4" r="2" fill="white"/><circle cx="5" cy="15" r="2" fill="white"/><circle cx="19" cy="15" r="2" fill="white"/><path d="M12 6v4M7 14l3-2M17 14l-3-2"/></svg></span></div>
              <div className="mt-8 flex flex-wrap justify-center gap-2">{c.communityPoints.map(p => <span key={p} className="rounded-full border border-white bg-white/75 px-3 py-2 text-xs font-bold text-[#536481] shadow-sm">✓ &nbsp;{p}</span>)}</div>
            </div>
          </div>
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[#8a37c9]">{c.communityTag}</p><h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.045em] sm:text-5xl">{c.communityTitle}</h2><p className="mt-6 text-lg leading-8 text-[#667694]">{c.communityBody}</p><Link href="/help/faq" className="mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#2c66d7] hover:underline">FAQ <span>→</span></Link></div>
        </div>
      </section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] bg-[linear-gradient(115deg,#20bfd5,#2c66d7_52%,#8a37c9)] px-6 py-16 text-center text-white shadow-[0_30px_70px_rgba(44,102,215,0.24)] sm:px-12 sm:py-20">
          <div className="absolute -left-10 -top-20 h-64 w-64 rounded-full border-[50px] border-white/10" /><div className="absolute -bottom-28 -right-8 h-72 w-72 rounded-full border-[55px] border-white/10" />
          <div className="relative">
            <h2 className="text-4xl font-black tracking-[-0.045em] sm:text-5xl">{c.ctaTitle}</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-white/75">{c.ctaBody}</p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-sm font-extrabold text-[#244da9] shadow-xl transition hover:-translate-y-1">
                {c.getStarted} <span>→</span>
              </Link>
              <a
                href={WHATSAPP_COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-[#20b95a] px-7 py-4 text-sm font-extrabold text-white shadow-xl transition hover:-translate-y-1 hover:bg-[#18a64e]"
              >
                <span aria-hidden="true">💬</span>
                {c.whatsapp}
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#dfE8f4] bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1fr_auto_auto] md:gap-20">
          <div><CercoraMark /><p className="mt-4 max-w-xs text-sm leading-6 text-[#72819b]">{c.footer}</p></div>
          <div><p className="text-xs font-extrabold uppercase tracking-wider text-[#22345c]">{c.product}</p><div className="mt-4 grid gap-3 text-sm text-[#72819b]"><a href="#how-it-works">{c.nav[0]}</a><a href="#features">{c.nav[1]}</a><Link href="/login">{c.signIn}</Link></div></div>
          <div><p className="text-xs font-extrabold uppercase tracking-wider text-[#22345c]">{c.company}</p><div className="mt-4 grid gap-3 text-sm text-[#72819b]"><Link href="/help/faq">FAQ</Link><Link href="/support">Support</Link><Link href="/privacy-policy">{c.privacy}</Link></div></div>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-[#e6edf6] px-5 py-6 text-xs text-[#8a97ac] sm:flex-row sm:items-center sm:justify-between sm:px-8"><span>© {new Date().getFullYear()} Cercora. {c.rights}</span><span>{c.motto}</span></div>
      </footer>
    </main>
  );
}
