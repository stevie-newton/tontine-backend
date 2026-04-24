import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type SupportedLocale = "en" | "fr";
type TranslationParams = Record<string, string | number>;

const STORAGE_KEY = "app.locale";

const enTranslations: Record<string, string> = {
  "transactions.export_csv": "Export CSV",
  "transactions.exporting": "Exporting...",
  "transactions.export_title": "Tontine ledger export",
};

const frTranslations: Record<string, string> = {
  Dashboard: "Tableau de bord",
  Reminders: "Rappels",
  Tontines: "Tontines",
  Profile: "Profil",
  Modal: "Fenêtre",
  "Return to dashboard": "Retour au tableau de bord",
  Dismiss: "Fermer",
  "Something went wrong": "Un problème est survenu",
  "The app hit an unexpected error": "L'application a rencontré une erreur inattendue",
  "Try reloading this view. If the problem keeps happening, sign in again or retry the action a little later.":
    "Essayez de recharger cet écran. Si le problème persiste, reconnectez-vous ou réessayez un peu plus tard.",
  "Try again": "Réessayer",
  "Quick note": "Note rapide",
  "You opened a modal surface": "Vous avez ouvert une fenêtre modale",
  "This screen is ready for lightweight confirmations, short summaries, or next-step prompts without breaking the main flow.":
    "Cet écran est prêt pour des confirmations légères, de courts résumés ou des prochaines étapes sans casser le flux principal.",
  "Current behavior": "Comportement actuel",
  "It is still a simple placeholder route, but it now matches the rest of the app’s visual language instead of looking like a starter template.":
    "Il s'agit encore d'une route de démonstration, mais elle correspond désormais au langage visuel du reste de l'application.",

  "Sign In": "Connexion",
  "Create Account": "Créer un compte",
  "Verify Phone": "Vérifier le téléphone",
  "Forgot Password": "Mot de passe oublié",
  "Reset Password": "Réinitialiser le mot de passe",
  "Invite Member": "Inviter un membre",
  Transactions: "Transactions",
  Payouts: "Paiements",
  Members: "Membres",
  Debts: "Dettes",
  Cycles: "Cycles",
  Contribute: "Contribuer",
  Tontine: "Tontine",
  Cycle: "Cycle",

  "Welcome back": "Bon retour",
  there: "vous",
  "Welcome back, {{name}}": "Bon retour, {{name}}",
  "Sign in to Cercora": "Connectez-vous à Cercora",
  "Pick up where you left off with your phone number and password.":
    "Reprenez là où vous vous êtes arrêté avec votre numéro de téléphone et votre mot de passe.",
  Phone: "Téléphone",
  Password: "Mot de passe",
  Needed: "Requis",
  Ready: "Prêt",
  Entered: "Saisi",
  "Your account": "Votre compte",
  "Use the same phone number you registered with to access your tontines, reminders, and profile.":
    "Utilisez le même numéro de téléphone que lors de votre inscription pour accéder à vos tontines, rappels et profil.",
  "Phone number": "Numéro de téléphone",
  "Sign in with {{label}}": "Se connecter avec {{label}}",
  "Use international format (e.g. +237670000000)":
    "Utilisez le format international (par ex. +237670000000)",
  "Local phone number": "Numéro local",
  "Choose country code": "Choisissez l'indicatif pays",
  "Search countries or code": "Rechercher un pays ou un indicatif",
  "No matching country": "Aucun pays correspondant",
  "Try a country name, dial code, or ISO code.":
    "Essayez un nom de pays, un indicatif ou un code ISO.",
  Show: "Afficher",
  Hide: "Masquer",
  "Password strength": "Niveau du mot de passe",
  "Create a password you will remember": "Créez un mot de passe que vous retiendrez",
  "8+ characters": "8+ caractères",
  "Strong password": "Mot de passe fort",
  "Getting stronger": "En bonne voie",
  "Add a little more security": "Ajoutez un peu plus de sécurité",
  "Enter the full {{count}}-digit code": "Entrez le code complet à {{count}} chiffres",
  "{{count}} of {{total}} digits entered": "{{count}} sur {{total}} chiffres saisis",
  "Enter your password": "Entrez votre mot de passe",
  "Sign in": "Se connecter",
  "Need help getting in?": "Besoin d'aide pour vous connecter ?",
  "Reset your password if you forgot it, or create a new account if this is your first time.":
    "Réinitialisez votre mot de passe si vous l'avez oublié, ou créez un compte si c'est votre première visite.",
  "Forgot password": "Mot de passe oublié",
  "Create an account": "Créer un compte",
  "Your device will use its enrolled biometric method automatically. You can still sign in with your phone number and password below.":
    "Votre appareil utilisera automatiquement sa méthode biométrique configurée. Vous pouvez toujours vous connecter avec votre numéro de téléphone et votre mot de passe ci-dessous.",
  "Use biometric sign-in next time":
    "Utiliser la connexion biométrique la prochaine fois",
  "Save this login securely so your device can use its enrolled biometric method the next time you open Cercora.":
    "Enregistrez cette connexion de façon sécurisée afin que votre appareil puisse utiliser sa méthode biométrique configurée la prochaine fois que vous ouvrirez Cercora.",
  "Choose how you want to sign in next time":
    "Choisissez comment vous voulez vous connecter la prochaine fois",
  "Your phone decides whether that means Face ID, fingerprint, or another enrolled biometric.":
    "Votre téléphone décide s'il faut utiliser Face ID, l'empreinte digitale ou une autre biométrie configurée.",
  "Use password": "Utiliser le mot de passe",
  "Use {{label}}": "Utiliser {{label}}",
  "Biometric sign-in will be ready after this login":
    "La connexion biométrique sera prête après cette connexion",
  "Password sign-in stays as your default":
    "La connexion par mot de passe reste votre option par défaut",
  "We will securely save this login so your device can unlock Cercora with {{label}} next time.":
    "Nous enregistrerons cette connexion de façon sécurisée afin que votre appareil puisse ouvrir Cercora avec {{label}} la prochaine fois.",
  "You can still turn on biometric sign-in later whenever you are ready.":
    "Vous pourrez toujours activer la connexion biométrique plus tard quand vous serez prêt.",

  "We could not find your phone number for biometric setup.":
    "Nous n'avons pas pu trouver votre numero de telephone pour configurer la connexion biometrigue.",
  "Enter your current password to enable biometric sign-in.":
    "Entrez votre mot de passe actuel pour activer la connexion biometrigue.",
  "Biometric sign in is not available on this device.":
    "La connexion biometrigue n'est pas disponible sur cet appareil.",
  "Biometric sign-in is active on this device":
    "La connexion biometrigue est active sur cet appareil",
  "Password sign-in is active on this device":
    "La connexion par mot de passe est active sur cet appareil",
  "You can use {{label}} from the sign-in screen instead of typing your password.":
    "Vous pouvez utiliser {{label}} depuis l'ecran de connexion au lieu de saisir votre mot de passe.",
  "Confirm your password to turn on biometric sign-in for this device.":
    "Confirmez votre mot de passe pour activer la connexion biometrigue sur cet appareil.",
  "Enable {{label}}": "Activer {{label}}",
  "Turn off {{label}}": "Desactiver {{label}}",
  "Reordering applies to upcoming cycles.":
    "La reorganisation s'applique aux cycles a venir.",
  "Only active members can be reordered.":
    "Seuls les membres actifs peuvent etre reordonnes.",
  "Saving order...": "Enregistrement de l'ordre...",
  "Move earlier": "Avancer",
  "Move later": "Reculer",

  "Get started": "Commencer",
  "Create your Cercora account": "Créez votre compte Cercora",
  "Set up your profile, confirm your phone number, and get ready to join or manage a tontine.":
    "Configurez votre profil, confirmez votre numéro et préparez-vous à rejoindre ou gérer une tontine.",
  Name: "Nom",
  "Registration details": "Détails de l'inscription",
  "We will send a one-time verification code to your phone after registration.":
    "Nous enverrons un code de vérification à usage unique sur votre téléphone après l'inscription.",
  "Full name": "Nom complet",
  "Your name": "Votre nom",
  "Your full name": "Votre nom complet",
  "This will appear on your Cercora profile.":
    "Ce nom apparaîtra sur votre profil Cercora.",
  "Enter at least 2 characters.": "Entrez au moins 2 caractères.",
  "You can keep going with one name, but full names are easier for groups to recognize.":
    "Vous pouvez continuer avec un seul nom, mais les noms complets sont plus faciles à reconnaître dans les groupes.",
  "Looks good": "C'est bon",
  "Create a password": "Créer un mot de passe",
  Continue: "Continuer",
  "Already have an account? Sign in": "Vous avez déjà un compte ? Connectez-vous",

  Verification: "Vérification",
  "Confirm your phone number": "Confirmez votre numéro de téléphone",
  "Enter the six-digit code we sent you. If it did not arrive, you can resend it from here.":
    "Entrez le code à six chiffres que nous vous avons envoyé. S'il n'est pas arrivé, vous pouvez le renvoyer ici.",
  Code: "Code",
  "Verification code": "Code de vérification",
  "Use the same phone number you registered with so the verification can complete cleanly.":
    "Utilisez le même numéro que lors de l'inscription afin que la vérification se termine correctement.",
  "Verify phone": "Vérifier le téléphone",
  "Resend code": "Renvoyer le code",

  "Account recovery": "Récupération du compte",
  "Reset your password": "Réinitialisez votre mot de passe",
  "We will send a reset code to your phone so you can securely set a new password.":
    "Nous enverrons un code de réinitialisation sur votre téléphone afin que vous puissiez définir un nouveau mot de passe en toute sécurité.",
  "Recovery details": "Détails de récupération",
  "Enter the phone number attached to your account and we will guide you to the reset step.":
    "Entrez le numéro associé à votre compte et nous vous guiderons vers l'étape de réinitialisation.",
  "Send reset code": "Envoyer le code",
  "Back to sign in": "Retour à la connexion",

  "Finish reset": "Terminer la réinitialisation",
  "Choose a new password": "Choisissez un nouveau mot de passe",
  "Enter the reset code you received, then set the password you want to use the next time you sign in.":
    "Entrez le code de réinitialisation reçu, puis définissez le mot de passe que vous souhaitez utiliser lors de votre prochaine connexion.",
  "Reset details": "Détails de réinitialisation",
  "Make sure the phone number and reset code match the one you requested from the recovery screen.":
    "Assurez-vous que le numéro de téléphone et le code correspondent bien à ceux demandés depuis l'écran de récupération.",
  "Reset code": "Code de réinitialisation",
  "Create a new password": "Créer un nouveau mot de passe",
  "Reset password": "Réinitialiser le mot de passe",
  "Enter your phone number first.": "Entrez d'abord votre numéro de téléphone.",
  "A new reset code was sent if that phone number exists.":
    "Un nouveau code de réinitialisation a été envoyé si ce numéro existe.",
  "Enter a tontine name.": "Entrez un nom de tontine.",
  "Use at least 3 characters for the tontine name.":
    "Utilisez au moins 3 caractères pour le nom de la tontine.",
  "Enter a valid contribution amount.": "Entrez un montant de contribution valide.",
  "Enter a valid total cycle count.": "Entrez un nombre total de cycles valide.",

  "Cercora dashboard": "Tableau de bord Cercora",
  "System pulse": "État du système",
  "Live health and delivery controls": "Santé en direct et contrôles de diffusion",
  "Your reminders": "Vos rappels",
  "No reminder": "Aucun rappel",
  "Upcoming contributions that need attention": "Contributions à venir qui demandent votre attention",
  "Admin command": "Commande admin",
  "Operational visibility for the whole platform": "Visibilité opérationnelle sur toute la plateforme",
  "Global admin": "Admin global",
  "Phone verified": "Téléphone vérifié",
  "Phone unverified": "Téléphone non vérifié",
  "Global admin session": "Session admin globale",
  On: "Activé",
  Off: "Désactivé",
  Clear: "Rien",
  "Web only": "Web uniquement",
  None: "Aucun",
  unsupported: "non pris en charge",
  Active: "Actif",
  active: "actif",
  pending: "en attente",
  Pending: "En attente",
  draft: "brouillon",
  Draft: "Brouillon",
  completed: "terminé",
  Completed: "Terminé",
  open: "ouvert",
  Open: "Ouvert",
  closed: "fermé",
  Closed: "Fermé",
  Admin: "Admin",
  admin: "admin",
  member: "membre",
  Member: "Membre",
  Owner: "Propriétaire",
  owner: "propriétaire",
  "Checking backend": "Vérification du backend",
  "Backend live": "Backend actif",
  "Backend issue": "Problème backend",
  granted: "accordée",
  denied: "refusée",
  default: "par défaut",
  "Pending reminders": "Rappels en attente",
  "Push status": "Statut push",
  "Next deadline": "Prochaine échéance",
  "Checking your upcoming contribution windows.":
    "Vérification de vos prochaines fenêtres de contribution.",
  "Reminder feed needs attention right now.": "Le flux de rappels demande votre attention pour le moment.",
  "You are clear for now. No upcoming reminders.": "Vous êtes tranquille pour l'instant. Aucun rappel à venir.",
  "You are clear for now. No outstanding reminders.": "Vous êtes tranquille pour l'instant. Aucun rappel en attente.",
  "1 reminder waiting across your groups.": "1 rappel vous attend dans vos groupes.",
  "{{count}} reminders waiting across your groups.": "{{count}} rappels vous attendent dans vos groupes.",
  "1 overdue reminder needs attention.": "1 rappel en retard demande votre attention.",
  "{{count}} overdue reminders need attention.": "{{count}} rappels en retard demandent votre attention.",
  "{{overdue}} overdue and {{upcoming}} upcoming reminders.":
    "{{overdue}} rappels en retard et {{upcoming}} rappels à venir.",
  "Backend status": "Statut du backend",
  "API endpoint": "Point d'accès API",
  Checking: "Vérification",
  Connected: "Connecté",
  Attention: "Attention",
  "Core services are ready for auth, payments tracking, reminders, and admin monitoring.":
    "Les services principaux sont prêts pour l'authentification, le suivi des paiements, les rappels et la supervision admin.",
  "Push notifications": "Notifications push",
  "Available on secure web only.": "Disponible uniquement sur le web sécurisé.",
  "Native mobile delivery": "Diffusion mobile native",
  "Notification permission not granted.": "Autorisation de notification non accordée.",
  "Native push requires a physical device.": "Les notifications push natives nécessitent un appareil physique.",
  "Missing EAS project ID for push registration.": "ID de projet EAS manquant pour l'enregistrement des notifications push.",
  "Native push is not supported on this platform.": "Les notifications push natives ne sont pas prises en charge sur cette plateforme.",
  "This APK does not support native push yet.": "Cette APK ne prend pas encore en charge les notifications push natives.",
  "Web push works on the Cercora web app. Native mobile push is not wired yet for the APK.":
    "Le web push fonctionne sur l'application web Cercora. Les notifications push mobiles natives ne sont pas encore connectées pour cette APK.",
  "Use the web app if you want push notifications today.":
    "Utilisez l'application web si vous souhaitez des notifications push dès aujourd'hui.",
  Disable: "Désactiver",
  Enable: "Activer",
  "Send test push": "Envoyer une notification test",
  "Native soon": "Mobile bientôt",
  "Fill in the payment details below.": "Remplissez les détails du paiement ci-dessous.",
  "Nothing urgent right now": "Rien d'urgent pour l'instant",
  "You are fully caught up. This area will surface the next contribution windows automatically.":
    "Vous êtes à jour. Cette zone affichera automatiquement les prochaines fenêtres de contribution.",
  "Users": "Utilisateurs",
  "Open debts": "Dettes ouvertes",
  "Blocked cycles": "Cycles bloqués",
  "Tontine status mix": "Répartition des statuts des tontines",
  "Reminder operations": "Opérations de rappel",
  "Preview and trigger pre-deadline SMS from mobile":
    "Prévisualiser et déclencher les SMS avant échéance depuis le mobile",
  Refresh: "Actualiser",
  "Send now": "Envoyer maintenant",
  Targets: "Cibles",
  Lookahead: "Horizon",
  "No reminder preview available.": "Aucun aperçu de rappel disponible.",
  "No admin overview available.": "Aucun aperçu admin disponible.",
  "Permission: {{permission}}{{subscription}}": "Permission : {{permission}}{{subscription}}",
  "New users 7d: {{count}}": "Nouveaux utilisateurs 7 j : {{count}}",
  "New tontines 7d: {{count}}": "Nouvelles tontines 7 j : {{count}}",
  "Contribution volume 30d: {{amount}}": "Volume de contribution 30 j : {{amount}}",
  "Payout volume 30d: {{amount}}": "Volume de paiement 30 j : {{amount}}",
  "1 recipient": "1 destinataire",
  "{{count}} recipients": "{{count}} destinataires",
  "Last send: {{sent}} sent, {{failed}} failed, {{marked}} cycle(s) marked.":
    "Dernier envoi : {{sent}} envoyés, {{failed}} échoués, {{marked}} cycle(s) marqués.",

  Reliability: "Fiabilité",
  Invites: "Invitations",
  Account: "Compte",
  Excellent: "Excellent",
  Strong: "Solide",
  Fair: "Moyen",
  "Needs work": "À améliorer",
  "Your current contribution and repayment posture":
    "Votre situation actuelle en matière de contribution et de remboursement",
  "Loading your score...": "Chargement de votre score...",
  "Based on on-time contributions, completed due cycles, and debt repayment behavior.":
    "Basé sur les contributions à temps, les cycles dus terminés et le comportement de remboursement des dettes.",
  "On time": "À temps",
  Late: "En retard",
  Missed: "Manqué",
  "No score available yet.": "Aucun score disponible pour le moment.",
  "Join new circles directly from your profile": "Rejoignez de nouveaux cercles directement depuis votre profil",
  "Loading invites...": "Chargement des invitations...",
  "No pending invites": "Aucune invitation en attente",
  "New tontine invitations will appear here with quick accept and reject actions.":
    "Les nouvelles invitations à des tontines apparaîtront ici avec des actions rapides pour accepter ou refuser.",
  "Pending invitation": "Invitation en attente",
  Accept: "Accepter",
  Reject: "Refuser",
  "Manage session access and irreversible account actions":
    "Gérez l'accès à votre session et les actions de compte irréversibles",
  "Delete account": "Supprimer le compte",
  "This only succeeds if you do not own or belong to an active tontine and no protected financial records block removal.":
    "Cela ne réussit que si vous ne possédez pas ou n'appartenez pas à une tontine active et qu'aucun enregistrement financier protégé n'empêche la suppression.",
  "Sign out": "Se déconnecter",
  "Delete account if the backend allows it. Continue?":
    "Supprimer votre compte si le backend l'autorise. Continuer ?",
  Cancel: "Annuler",
  Delete: "Supprimer",

  "Reminder center": "Centre des rappels",
  "Stay ahead of every deadline": "Gardez une longueur d'avance sur chaque échéance",
  "Manage your upcoming contribution reminders, web push delivery, and platform reminder operations in one place.":
    "Gérez vos rappels de contribution à venir, la diffusion web push et les opérations de rappel de la plateforme au même endroit.",
  queued: "en file",
  "Push on": "Push actif",
  "Push off": "Push inactif",
  "Next urgency": "Prochaine urgence",
  "No due date": "Aucune échéance",
  "Secure web delivery": "Diffusion web sécurisée",
  Permission: "Permission",
  subscribed: "abonné",
  PermissionGranted: "accordée",
  "Delivery state": "État de diffusion",
  Subscribed: "Abonné",
  Idle: "Inactif",
  "Disable push": "Désactiver le push",
  "Enable push": "Activer le push",
  "Checking feed": "Vérification du flux",
  upcoming: "à venir",
  "Overdue": "En retard",
  "Due now": "À échéance",
  "{{count}}h left": "Plus que {{count}} h",
  "{{count}}h late": "{{count}} h de retard",
  Deadline: "Échéance",
  "Tontine ID": "ID de tontine",
  "Admin reminder operations": "Opérations de rappel admin",
  "Platform-wide delivery controls": "Contrôles de diffusion à l'échelle de la plateforme",
  "Loading admin reminder preview...": "Chargement de l'aperçu des rappels admin...",
  "Cycles in window": "Cycles dans la fenêtre",
  "Members targeted": "Membres ciblés",
  "Window ": "Fenêtre ",
  " to ": " à ",
  "Send reminder batch": "Envoyer le lot de rappels",
  "Last batch result": "Résultat du dernier lot",
  "SMS configured: ": "SMS configuré : ",
  Yes: "Oui",
  No: "Non",
  "Cycles checked: ": "Cycles vérifiés : ",
  "Cycles marked: ": "Cycles marqués : ",
  "SMS sent: ": "SMS envoyés : ",
  "SMS failed: ": "SMS échoués : ",
  "No preview data available.": "Aucune donnée d'aperçu disponible.",
  "Due ": "Échéance ",
  " +": " +",
  " more": " autres",

  "New savings circle": "Nouveau cercle d'épargne",
  "Create a tontine that feels ready from day one":
    "Créez une tontine prête dès le premier jour",
  "Define the amount, rhythm, and number of cycles now. You can invite members right after creation.":
    "Définissez dès maintenant le montant, le rythme et le nombre de cycles. Vous pourrez inviter des membres juste après la création.",
  Contribution: "Contribution",
  Cadence: "Cadence",
  Structure: "Structure",
  Monthly: "Mensuel",
  Weekly: "Hebdomadaire",
  "Set your cycle count": "Définissez le nombre de cycles",
  Configuration: "Configuration",
  "Give the group a clear identity and simple contribution plan.":
    "Donnez au groupe une identité claire et un plan de contribution simple.",
  "Contribution amount": "Montant de contribution",
  Frequency: "Fréquence",
  "Faster rotations": "Rotations plus rapides",
  "Lower pressure cadence": "Rythme moins contraignant",
  "Total cycles": "Nombre total de cycles",
  "Create tontine": "Créer la tontine",
  "Cycle setup happens after creation":
    "La configuration des cycles se fait après la création",
  "Just like the web page, this creates the tontine as a draft first. You can invite members and shape the cycle flow from the tontine workspace afterward.":
    "Comme sur la page web, cette action crée d'abord la tontine en brouillon. Vous pourrez ensuite inviter des membres et organiser le déroulement des cycles depuis l'espace tontine.",
  "What happens next": "Ce qui se passe ensuite",
  "After creation, you can invite members, generate cycles, and start collecting contributions from the tontine workspace.":
    "Après la création, vous pourrez inviter des membres, générer des cycles et commencer à collecter les contributions depuis l'espace tontine.",
  "Family circle": "Cercle familial",
  "{{count}} cycle": "{{count}} cycle",
  "{{count}} cycles": "{{count}} cycles",
  "Configure your group with a streamlined setup, then refine membership and cycle planning from the tontine workspace.":
    "Configurez votre groupe avec une mise en place simplifiee, puis affinez les membres et la planification des cycles depuis l'espace tontine.",
  "Setup details": "Details de configuration",
  "Name the group, choose the contribution amount, and set the contribution rhythm.":
    "Nommez le groupe, choisissez le montant de contribution et definissez le rythme des contributions.",

  "Tontine workspace": "Espace tontine",
  "Invalid tontine id.": "ID de tontine invalide.",
  "Review group performance, member activity, cycle progress, and debt status from one integrated workspace.":
    "Consultez la performance du groupe, l'activité des membres, l'avancement des cycles et l'état des dettes depuis un espace de travail intégré.",
  "Current cycle: {{current}}/{{total}}": "Cycle actuel : {{current}}/{{total}}",
  "You can remove this tontine only when no financial activity has been recorded yet.":
    "Vous pouvez supprimer cette tontine uniquement lorsqu'aucune activité financière n'a encore été enregistrée.",
  "Generate cycles to activate this tontine flow.":
    "Générez des cycles pour activer le fonctionnement de cette tontine.",
  "Activate tontine": "Activer la tontine",
  "Repair cycle plan": "Réparer le plan des cycles",
  "Generate cycles first": "Générez d'abord les cycles",
  "Debt flags": "Alertes dette",
  "Open debt": "Dette ouverte",
  "No dept": "Aucune dette",
  "No cycles created yet.": "Aucun cycle créé pour le moment.",
  "Cycle #{{number}}": "Cycle #{{number}}",
  "No debts recorded for this tontine.": "Aucune dette enregistrée pour cette tontine.",
  "Cycle {{cycle}}: {{name}}": "Cycle {{cycle}} : {{name}}",
  "Covered by {{name}} - {{amount}}": "Couvert par {{name}} - {{amount}}",
  "Payout member: {{name}}": "Bénéficiaire : {{name}}",
  "{{status}} - {{start}} to {{end}}": "{{status}} - {{start}} à {{end}}",
  "Your tontines": "Vos tontines",
  "Manage invites, track your reliability, and open every savings group from one place.":
    "Gérez les invitations, suivez votre fiabilité et ouvrez chaque groupe d'épargne depuis un seul endroit.",
  "Keep your groups and invites in sync":
    "Gardez vos groupes et vos invitations synchronisés",
  "Access your reliability profile, pending invites, creation tools, and active groups from one streamlined workspace.":
    "Accédez à votre profil de fiabilité, à vos invitations en attente, aux outils de création et à vos groupes actifs depuis un espace de travail unifié.",
  Groups: "Groupes",
  "Reliability profile": "Profil de fiabilité",
  "The same score summary from the web tontines page, adapted for mobile.":
    "Le même résumé de score que sur la page web des tontines, adapté au mobile.",
  Score: "Score",
  "Late payments": "Paiements en retard",
  "Pending invites": "Invitations en attente",
  "Accept or reject invitations without leaving the tontines home screen.":
    "Acceptez ou refusez les invitations sans quitter l'écran d'accueil des tontines.",
  "Tontine ID #{{id}}": "ID tontine #{{id}}",
  "Create a new tontine": "Créer une nouvelle tontine",
  "Start a new savings group, then invite members and generate cycles from its workspace.":
    "Démarrez un nouveau groupe d'épargne, puis invitez des membres et générez les cycles depuis son espace de travail.",
  "Go to create form": "Aller au formulaire de création",
  "Your groups": "Vos groupes",
  "Loading your tontines...": "Chargement de vos tontines...",
  "No tontines yet": "Aucune tontine pour le moment",
  "Create your first savings group to invite members and start building your rotation.":
    "Créez votre premier groupe d'épargne pour inviter des membres et commencer à construire votre rotation.",
  "Custom contribution cadence": "Cadence de contribution personnalisée",
  "{{frequency}} contribution cadence": "Cadence de contribution {{frequency}}",
  "Contribution: {{amount}}": "Contribution : {{amount}}",
  "Cycle: {{current}}/{{total}}": "Cycle : {{current}}/{{total}}",
  "Open group": "Ouvrir le groupe",
  "Invite accepted.": "Invitation acceptée.",
  "Invite rejected.": "Invitation refusée.",
  "Track progress, invite members, and manage the full savings cycle from one place.":
    "Suivez la progression, invitez des membres et gérez le cycle complet d'épargne depuis un seul endroit.",
  "Cercora member": "Membre Cercora",
  "Cycle progress": "Progression des cycles",
  "Active members": "Membres actifs",
  "Invite member": "Inviter un membre",
  "View all": "Voir tout",
  "No cycles generated yet": "Aucun cycle généré pour le moment",
  "Go to Cycles and generate them to start tracking contributions and payouts.":
    "Allez dans Cycles et générez-les pour commencer à suivre les contributions et les paiements.",
  "Ask the owner to generate cycles to begin tracking payments.":
    "Demandez au propriétaire de générer les cycles pour commencer le suivi des paiements.",
  Submitted: "Soumises",
  Confirmed: "Confirmées",
  Collected: "Collecté",
  "Open current cycle": "Ouvrir le cycle en cours",
  "Members snapshot": "Aperçu des membres",
  "Can manage": "Peut gérer",
  "Explore this tontine": "Explorer cette tontine",
  "Review payout history and processed totals.":
    "Consultez l'historique des paiements et les totaux traités.",
  "Track open debt coverage and repayment flow.":
    "Suivez la couverture des dettes ouvertes et leur remboursement.",

  Roster: "Roster",
  "Members and roles": "Membres et rôles",
  "Keep track of who is active, who is still pending, and who helps manage the tontine.":
    "Suivez qui est actif, qui est encore en attente et qui aide à gérer la tontine.",
  admins: "admins",
  "Total members": "Nombre total de membres",
  "Can invite": "Peut inviter",
  "Your role": "Votre rôle",
  "Only the owner or an admin can send invites for this tontine.":
    "Seul le propriétaire ou un admin peut envoyer des invitations pour cette tontine.",
  "Team overview": "Vue d'ensemble de l'équipe",
  people: "personnes",
  "active first": "actifs d'abord",
  "No members yet": "Aucun membre pour le moment",
  "Invite someone to join this tontine and start building the rotation.":
    "Invitez quelqu'un à rejoindre cette tontine et commencez à construire la rotation.",
  "Payout order": "Ordre de paiement",
  Rotation: "Rotation",
  Joined: "Inscrit",

  "New invitation": "Nouvelle invitation",
  "Bring someone into the circle": "Faites entrer quelqu'un dans le cercle",
  "Invite by phone number and choose whether they join as a standard member or as an admin.":
    "Invitez par numéro de téléphone et choisissez s'il s'agit d'un membre standard ou d'un admin.",
  "Selected role": "Rôle sélectionné",
  "Invite details": "Détails de l'invitation",
  "The invited person will see a pending invite after they sign in with this phone number.":
    "La personne invitée verra une invitation en attente après s'être connectée avec ce numéro.",
  "Access level": "Niveau d'accès",
  "Joins cycles, contributes, and participates in the payout rotation.":
    "Participe aux cycles, contribue et prend part à la rotation des paiements.",
  "Can help manage members and operational actions inside the tontine.":
    "Peut aider à gérer les membres et les actions opérationnelles dans la tontine.",
  "Send invite": "Envoyer l'invitation",

  "Cycle planner": "Planificateur de cycles",
  "Track the full rotation, open the current cycle, and generate the schedule when the owner is ready.":
    "Suivez la rotation complète, ouvrez le cycle en cours et générez le calendrier lorsque le propriétaire est prêt.",
  "Owner controls": "Contrôles propriétaire",
  "Generated cycles": "Cycles générés",
  Progress: "Progression",
  "Current focus": "Point d'attention",
  "Generate cycles": "Générer les cycles",
  "Cycle overview": "Aperçu des cycles",
  "Open now": "Ouverts",
  Archived: "Archivés",
  "Current payout": "Paiement actuel",
  "All cycles": "Tous les cycles",
  total: "total",
  "No cycles yet": "Aucun cycle pour le moment",
  "Generate cycles to begin contributions, payouts, and the full rotation.":
    "Générez les cycles pour commencer les contributions, les paiements et la rotation complète.",
  "Ask the owner to generate cycles before contributions can start.":
    "Demandez au propriétaire de générer les cycles avant le début des contributions.",
  "Closed at": "Fermé le",
  "Still open": "Toujours ouvert",
  Unassigned: "Non attribué",

  "Cycle workspace": "Espace cycle",
  "Cycle {{number}}": "Cycle {{number}}",
  "{{name}} cycle {{number}}": "{{name}} cycle {{number}}",
  "Keep contribution approvals, payout assignment, and cycle readiness in one place.":
    "Gardez au même endroit les validations de contribution, l'attribution du paiement et l'état de préparation du cycle.",
  "Monitor funding progress, member activity, review actions, and debt context from one consolidated cycle workspace.":
    "Suivez le financement, l'activité des membres, les actions de validation et le contexte des dettes depuis un espace cycle unifié.",
  "Funding progress, payout readiness, and member payment status for this cycle.":
    "Progression du financement, préparation du paiement et statut des paiements des membres pour ce cycle.",
  "Current cycle": "Cycle actuel",
  schedule: "calendrier",
  Received: "Reçu",
  "Paid members": "Membres payés",
  "Funding status": "Statut du financement",
  "Expected total": "Total attendu",
  Missing: "Manquant",
  "Cycle window": "Fenêtre du cycle",
  "{{start}} to {{end}}": "{{start}} à {{end}}",
  "Beneficiary for this cycle does not contribute.":
    "Le bénéficiaire de ce cycle ne contribue pas.",
  "Expected per member": "Attendu par membre",
  "Confirmed members": "Membres confirmés",
  "Submitted volume": "Volume soumis",
  "Cycle pulse": "État du cycle",
  "Start date": "Date de début",
  "End date": "Date de fin",
  "Payout member": "Bénéficiaire",
  "Add contribution": "Ajouter une contribution",
  "This cycle is already closed for new contributions.":
    "Ce cycle est déjà fermé pour les nouvelles contributions.",
  "Contributions only stay open on the current cycle.":
    "Les contributions ne restent ouvertes que sur le cycle en cours.",
  "Manage cycle": "Gérer le cycle",
  "Choose the payout member, then close the cycle once every active member is confirmed.":
    "Choisissez le bénéficiaire, puis fermez le cycle une fois que chaque membre actif est confirmé.",
  "Rotation is automatic. Close the cycle once every non-beneficiary active member is funded.":
    "La rotation est automatique. Fermez le cycle une fois que chaque membre actif non bénéficiaire est financé.",
  Waiting: "En attente",
  "Close readiness": "Prêt à fermer",
  "Your access": "Votre accès",
  "Assign payout member": "Attribuer le bénéficiaire",
  "Assign payout": "Attribuer le paiement",
  "Close cycle": "Clore le cycle",
  "Closing...": "Clôture...",
  "Only the owner can close the cycle.": "Seul le propriétaire peut clore le cycle.",
  "Only the current cycle can be closed.": "Seul le cycle en cours peut être clos.",
  "Contributions": "Contributions",
  entries: "entrées",
  "{{count}} entries": "{{count}} entrées",
  "Member payment status": "Statut des paiements des membres",
  "No confirmed payment yet": "Aucun paiement confirmé pour le moment",
  "No payment roster available yet.": "Aucune liste de paiements disponible pour le moment.",
  "Submitted contributions": "Contributions soumises",
  "No contributions yet": "Aucune contribution pour le moment",
  "As members submit payments, they will appear here with review status and proof details.":
    "Au fur et à mesure que les membres soumettent des paiements, ils apparaîtront ici avec leur statut de validation et les détails des preuves.",
  "As members submit payments, they will appear here with review status.":
    "Au fur et à mesure que les membres soumettent des paiements, ils apparaîtront ici avec leur statut de validation.",
  "Paid {{date}}": "Payé le {{date}}",
  "Amount": "Montant",
  "Ledger entry": "Écriture comptable",
  confirmed: "confirmé",
  rejected: "rejeté",
  Repaid: "Remboursé",
  "No reference": "Aucune référence",
  "Reference: {{reference}}": "Référence : {{reference}}",
  "Proof: {{proof}}": "Preuve : {{proof}}",
  "Reference: ": "Référence : ",
  "Proof: none attached": "Preuve : aucune pièce jointe",
  "Beneficiary review": "Validation du bénéficiaire",
  "Confirm submitted payments after checking the screenshot proof and transaction reference.":
    "Confirmez les paiements soumis après avoir vérifié la preuve de capture et la référence de transaction.",
  "No pending reviews right now.": "Aucune validation en attente pour le moment.",
  "No proof screenshot provided.": "Aucune capture de preuve fournie.",
  Confirm: "Confirmer",
  "Working...": "Traitement...",
  "Debt snapshot": "Aperçu des dettes",
  "No debts linked to this cycle.": "Aucune dette liée à ce cycle.",

  "Coverage ledger": "Registre de couverture",
  "{{tontine}} debt flow": "Flux des dettes de {{tontine}}",
  "Track when someone covers a missed payment and follow repayment back to resolution.":
    "Suivez lorsqu'une personne couvre un paiement manqué et le remboursement jusqu'à sa résolution.",
  "Manage debt coverage, open balances, and repayment history from one dedicated workspace.":
    "Gérez la couverture des dettes, les soldes ouverts et l'historique des remboursements depuis un espace de travail dédié.",
  repaid: "remboursé",
  "Total debts": "Total des dettes",
  "Tracked amount": "Montant suivi",
  "Standard contribution": "Contribution standard",
  "Select a cycle.": "Sélectionnez un cycle.",
  "Select debtor and coverer.": "Sélectionnez le débiteur et le couvrant.",
  "Debtor and coverer must be different.": "Le débiteur et le couvrant doivent être différents.",
  "Cover payment recorded. Debt created.": "Couverture enregistrée. Dette créée.",
  "Debt marked as repaid.": "Dette marquée comme remboursée.",
  "Debt ledger": "Grand livre des dettes",
  "No open cycles available.": "Aucun cycle ouvert disponible.",
  "Saving...": "Enregistrement...",
  "Record cover payment": "Enregistrer une couverture",
  "{{debtor}} owes {{coverer}}": "{{debtor}} doit à {{coverer}}",
  "{{debtor}} repaid {{coverer}}": "{{debtor}} a remboursé {{coverer}}",
  "Cycle {{number}} - Repaid {{date}}": "Cycle {{number}} - Remboursé le {{date}}",
  "This creates a confirmed contribution for the missed cycle and opens a debt for repayment.":
    "Cela crée une contribution confirmée pour le cycle manqué et ouvre une dette à rembourser.",
  "Open cycle": "Cycle ouvert",
  Debtor: "Débiteur",
  Coverer: "Couvrant",
  "Selected cycle": "Cycle sélectionné",
  "Debt amount": "Montant de la dette",
  Notes: "Notes",
  "Reason or context for this cover payment":
    "Raison ou contexte de cette couverture",
  "No open debts": "Aucune dette ouverte",
  "When a member covers someone else, unresolved debts will show up here.":
    "Lorsqu'un membre couvre quelqu'un d'autre, les dettes non résolues apparaîtront ici.",
  owes: "doit à",
  "Created": "Créé",
  "Mark repaid": "Marquer comme remboursé",
  "Repaid history": "Historique des remboursements",
  resolved: "résolues",
  "Repaid debts will appear here once they are closed out.":
    "Les dettes remboursées apparaîtront ici une fois clôturées.",
  "Payout history": "Historique des paiements",
  "Member payouts": "Paiements des membres",
  "Review who received each payout, what is still pending, and how much has moved out of the tontine.":
    "Voyez qui a reçu chaque paiement, ce qui est encore en attente et combien est sorti de la tontine.",
  processed: "traité",
  "Total payouts": "Total des paiements",
  "Total value": "Valeur totale",
  "Processed rate": "Taux de traitement",
  "Payout pulse": "État des paiements",
  "Last payout": "Dernier paiement",
  "Still pending": "Toujours en attente",
  History: "Historique",
  records: "enregistrements",
  "No payouts yet": "Aucun paiement pour le moment",
  "Payout records will appear here as cycles close and beneficiaries are processed.":
    "Les enregistrements de paiement apparaîtront ici à mesure que les cycles se ferment et que les bénéficiaires sont traités.",
  "Processed on": "Traité le",
  "Created on": "Créé le",

  Ledger: "Grand livre",
  "Transaction flow": "Flux des transactions",
  "Follow every contribution, payout, fee, and adjustment moving through this tontine.":
    "Suivez chaque contribution, paiement, frais et ajustement dans cette tontine.",
  "Current balance": "Solde actuel",
  Entries: "Entrées",
  "Ledger pulse": "État du grand livre",
  Fees: "Frais",
  "Last entry": "Dernière entrée",
  transactions: "transactions",
  "No transactions yet": "Aucune transaction pour le moment",
  "Ledger activity will appear here as contributions, payouts, and fees are recorded.":
    "L'activité du grand livre apparaîtra ici lorsque des contributions, paiements et frais seront enregistrés.",
  contribution: "contribution",
  payout: "paiement",
  fee: "frais",
  refund: "remboursement",
  adjustment: "ajustement",
  "General entry": "Entrée générale",
  "Posted on": "Enregistré le",

  "Submit your cycle payment": "Soumettez votre paiement de cycle",
  "Add the transfer amount, reference, and proof link so the contribution can be reviewed quickly.":
    "Ajoutez le montant du transfert, la référence et le lien de preuve afin que la contribution soit examinée rapidement.",
  "Expected amount": "Montant attendu",
  "Target cycle": "Cycle visé",
  "Payment details": "Détails du paiement",
  "{{tontine}} expects {{amount}} for this cycle.":
    "{{tontine}} attend {{amount}} pour ce cycle.",
  "Transaction reference": "Référence de transaction",
  "Proof screenshot URL": "URL de capture de preuve",
  "Before you submit": "Avant de soumettre",
  "Make sure the amount matches your cycle contribution and the reference is the one used for the transfer.":
    "Assurez-vous que le montant correspond à votre contribution de cycle et que la référence est bien celle du transfert.",
  "Submit contribution": "Soumettre la contribution",

  "This will permanently delete your account if the backend allows it. Continue?":
    "Cela supprimera définitivement votre compte si le backend l'autorise. Continuer ?",
  "Loading reminder feed...": "Chargement du flux de rappels...",
  "Loading admin data...": "Chargement des données admin...",
  "Global admin session active": "Session admin globale active",
  English: "Anglais",
  French: "Français",
  Language: "Langue",
  "Choose your app language": "Choisissez la langue de l'application",
  "The app will immediately switch between English and French.":
    "L'application basculera immédiatement entre l'anglais et le français.",
  "The request timed out. Please try again.":
    "La requête a expiré. Veuillez réessayer.",
  "Unable to reach the server. Check your connection and try again.":
    "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
  "Invalid route params.": "Paramètres de route invalides.",
  "Cycle closed successfully.": "Cycle clôturé avec succès.",
  "Contribution confirmed.": "Contribution confirmée.",
  "Contribution rejected.": "Contribution rejetée.",
  "Your session has expired. Please sign in again.":
    "Votre session a expiré. Veuillez vous reconnecter.",
  "You do not have permission to perform this action.":
    "Vous n'avez pas l'autorisation d'effectuer cette action.",
  "The server hit a problem. Please try again in a moment.":
    "Le serveur a rencontré un problème. Veuillez réessayer dans un instant.",
  "Something went wrong. Please try again.":
    "Une erreur s'est produite. Veuillez réessayer.",
  "{{name}} cycles": "Cycles de {{name}}",
  "{{count}} open": "{{count}} ouverts",
  "{{count}} closed": "{{count}} fermes",
  "{{count}} total": "{{count}} total",
  "{{count}} active": "{{count}} actifs",
  "{{count}} pending": "{{count}} en attente",
  "{{count}} admins": "{{count}} admins",
  "{{count}} people": "{{count}} personnes",
  "{{count}} active first": "{{count}} actifs d'abord",
  "{{count}} processed": "{{count}} traites",
  "{{count}} records": "{{count}} enregistrements",
  "{{count}} transactions": "{{count}} transactions",
  "Invite sent.": "Invitation envoyee.",
  "Generating...": "Generation...",
  "Payout ledger": "Grand livre des paiements",
  "The mobile payout view now follows the rebuilt tontine workflow, with summary, processing state, and full payout history in one place.":
    "La vue mobile des paiements suit desormais le flux de tontine reconstruit, avec le resume, l'etat de traitement et l'historique complet des paiements au meme endroit.",
  "Processed entries": "Entrees traitees",
  "Awaiting processing": "En attente de traitement",
  "Transaction ledger": "Grand livre des transactions",
  "This view stays linked to the backend ledger routes while matching the newer tontine workspace structure.":
    "Cette vue reste liee aux routes du grand livre backend tout en correspondant a la nouvelle structure de l'espace tontine.",
  "Contribution volume": "Volume des contributions",
  "Payout volume": "Volume des paiements",
  "transactions.export_csv": "Exporter CSV",
  "transactions.exporting": "Export en cours...",
  "transactions.export_title": "Export du grand livre de la tontine",
  "Make sure the amount matches your cycle contribution and the reference matches the transfer. Add screenshot proof if you have it for beneficiary review.":
    "Assurez-vous que le montant correspond a votre contribution de cycle et que la reference correspond au transfert. Ajoutez une capture de preuve si vous en avez une pour la validation du beneficiaire.",
  "Submitting...": "Envoi...",
  Admins: "Admins",
};

let currentLocale: SupportedLocale = "en";

function detectLocale(): SupportedLocale {
  const rawLocale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
  return rawLocale.startsWith("fr") ? "fr" : "en";
}

function setCurrentLocale(locale: SupportedLocale) {
  currentLocale = locale;
}

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template;
  return Object.entries(params).reduce(
    (value, [key, replacement]) => value.replaceAll(`{{${key}}}`, String(replacement)),
    template
  );
}

function translate(locale: SupportedLocale, key: string, params?: TranslationParams) {
  const template =
    locale === "fr"
      ? frTranslations[key] ?? enTranslations[key] ?? key
      : enTranslations[key] ?? key;
  return interpolate(template, params);
}

type I18nContextValue = {
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => Promise<void>;
  t: (key: string, params?: TranslationParams) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(detectLocale());

  useEffect(() => {
    void (async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "fr") {
        setLocaleState(stored);
        setCurrentLocale(stored);
        return;
      }
      setCurrentLocale(detectLocale());
    })();
  }, []);

  useEffect(() => {
    setCurrentLocale(locale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: async (nextLocale) => {
        setLocaleState(nextLocale);
        setCurrentLocale(nextLocale);
        await AsyncStorage.setItem(STORAGE_KEY, nextLocale);
      },
      t: (key, params) => translate(locale, key, params),
    }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

export function translateText(text: string) {
  return translate(currentLocale, text);
}

export function getCurrentLocale() {
  return currentLocale;
}
