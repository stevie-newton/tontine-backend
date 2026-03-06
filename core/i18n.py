from __future__ import annotations

import re
from typing import Any

from fastapi import Request


_EXACT_FR: dict[str, str] = {
    "Not authenticated": "Non authentifie",
    "Could not validate credentials": "Impossible de valider les identifiants",
    "Token has expired": "Le jeton a expire",
    "Inactive user": "Utilisateur inactif",
    "Phone number already registered": "Numero de telephone deja enregistre",
    "Invalid phone or password": "Telephone ou mot de passe invalide",
    "Invalid or expired reset code": "Code de reinitialisation invalide ou expire",
    "Tontine not found": "Tontine introuvable",
    "Cycle not found": "Cycle introuvable",
    "Cycle is closed": "Le cycle est cloture",
    "Cycle already closed": "Le cycle est deja cloture",
    "Associated tontine not found": "Tontine associee introuvable",
    "Membership not found": "Adhesion introuvable",
    "Contribution not found": "Contribution introuvable",
    "User not found": "Utilisateur introuvable",
    "Payout not found": "Paiement introuvable",
    "You don't have access to this tontine": "Vous n'avez pas acces a cette tontine",
    "You don't have access to this cycle": "Vous n'avez pas acces a ce cycle",
    "You don't have access to this payout": "Vous n'avez pas acces a ce paiement",
    "You don't have access to these payouts": "Vous n'avez pas acces a ces paiements",
    "You don't have access to this cycle's contributions": "Vous n'avez pas acces aux contributions de ce cycle",
    "Only owner can close cycle": "Seul le proprietaire peut cloturer le cycle",
    "Only owner can generate cycles": "Seul le proprietaire peut generer des cycles",
    "Only owner or admin can perform this action": "Seul le proprietaire ou un admin peut effectuer cette action",
    "Only owner or admin can update memberships": "Seul le proprietaire ou un admin peut modifier les adhesions",
    "Only owner or admin can assign payout members": "Seul le proprietaire ou un admin peut assigner les beneficiaires",
    "Only owner or admin can send reminders": "Seul le proprietaire ou un admin peut envoyer des rappels",
    "Only owner or admin can update cycle deadline": "Seul le proprietaire ou un admin peut modifier la date limite du cycle",
    "Only owner or admin can create manual transactions": "Seul le proprietaire ou un admin peut creer des transactions manuelles",
    "Only owner or admin can create payouts": "Seul le proprietaire ou un admin peut creer des paiements",
    "Only owner or admin can update payouts": "Seul le proprietaire ou un admin peut modifier des paiements",
    "Only owner or admin can delete payouts": "Seul le proprietaire ou un admin peut supprimer des paiements",
    "Only this cycle beneficiary can confirm/reject": "Seul le beneficiaire de ce cycle peut confirmer ou rejeter",
    "Beneficiary is not assigned for this cycle": "Aucun beneficiaire n'est assigne pour ce cycle",
    "Decision must be either 'confirm' or 'reject'": "La decision doit etre 'confirm' ou 'reject'",
    "Contribution already submitted": "Contribution deja soumise",
    "You have already contributed to this cycle": "Vous avez deja contribue a ce cycle",
    "User is already a member of this tontine": "L'utilisateur est deja membre de cette tontine",
    "Self-join is disabled. Ask tontine owner/admin to add you.": "L'adhesion directe est desactivee. Demandez au proprietaire/admin de vous ajouter.",
    "You can only accept your own invite": "Vous pouvez seulement accepter votre propre invitation",
    "You don't have permission to remove this member": "Vous n'avez pas la permission de retirer ce membre",
    "A member can leave only before the tontine starts": "Un membre peut quitter uniquement avant le debut de la tontine",
    "Member cannot be removed because financial records exist": "Le membre ne peut pas etre retire car des enregistrements financiers existent",
    "Cannot set payout_position after tontine has started": "Impossible de definir payout_position apres le debut de la tontine",
    "Cannot change payout_position after tontine has started": "Impossible de modifier payout_position apres le debut de la tontine",
    "Member not found in this tontine": "Membre introuvable dans cette tontine",
    "Member with open debt cannot be selected as beneficiary": "Un membre avec une dette ouverte ne peut pas etre choisi comme beneficiaire",
    "No beneficiary-eligible members (all have open debts)": "Aucun membre eligible comme beneficiaire (tous ont des dettes ouvertes)",
    "Cannot freeze rotation without active members": "Impossible de figer la rotation sans membres actifs",
    "Current cycle not found": "Cycle actuel introuvable",
    "Cannot update deadline for closed cycle": "Impossible de modifier la date limite d'un cycle cloture",
    "User is not an active member": "L'utilisateur n'est pas un membre actif",
    "You are not an active member of this tontine": "Vous n'etes pas un membre actif de cette tontine",
    "transaction_reference is required": "transaction_reference est obligatoire",
    "Tontine cannot be deleted after it has started with contributions": "La tontine ne peut pas etre supprimee apres son demarrage avec contributions",
    "Tontine cannot be deleted due to dependent records": "La tontine ne peut pas etre supprimee a cause d'enregistrements dependants",
}


def get_locale_from_request(request: Request) -> str:
    header = (
        request.headers.get("x-locale")
        or request.headers.get("accept-language")
        or ""
    ).lower()
    return "fr" if header.startswith("fr") else "en"


def _translate_dynamic_fr(text: str) -> str | None:
    m = re.fullmatch(r"Cycle (\d+) is already closed", text)
    if m:
        return f"Le cycle {m.group(1)} est deja cloture"

    m = re.fullmatch(r"Payout already exists for cycle (\d+)", text)
    if m:
        return f"Un paiement existe deja pour le cycle {m.group(1)}"

    m = re.fullmatch(r"Contribution amount must be (.+)", text)
    if m:
        return f"Le montant de contribution doit etre {m.group(1)}"

    m = re.fullmatch(r"Contribution must be exactly (.+) \(provided: (.+)\)", text)
    if m:
        return f"La contribution doit etre exactement {m.group(1)} (fourni: {m.group(2)})"

    m = re.fullmatch(r"Cover amount must equal cycle contribution amount \((.+)\)", text)
    if m:
        return f"Le montant de couverture doit etre egal au montant de contribution du cycle ({m.group(1)})"

    m = re.fullmatch(r"Missing contributions from: (.+)", text)
    if m:
        return f"Contributions manquantes de: {m.group(1)}"

    m = re.fullmatch(r"payout_position must be between 1 and (\d+)", text)
    if m:
        return f"payout_position doit etre entre 1 et {m.group(1)}"

    m = re.fullmatch(r"Duplicate payout_position override: (\d+)", text)
    if m:
        return f"Override payout_position duplique: {m.group(1)}"

    return None


def translate_detail(detail: Any, locale: str) -> Any:
    if locale != "fr":
        return detail
    if not isinstance(detail, str):
        return detail

    exact = _EXACT_FR.get(detail)
    if exact:
        return exact

    dynamic = _translate_dynamic_fr(detail)
    if dynamic:
        return dynamic

    return detail
