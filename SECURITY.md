# Politique de sécurité — PedaClic

## Versions supportées

| Version | Support sécurité |
| ------- | ---------------- |
| 1.x     | ✅ Oui           |
| < 1.0   | ❌ Non           |

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique pour une faille de sécurité.

Privilégiez l'un de ces canaux :

1. **Private vulnerability reporting** de GitHub : onglet *Security* → *Report a vulnerability* (à activer dans les réglages du dépôt).
2. **E-mail** : `security@pedaclic.sn` (ou `kadersow@gmail.com`).

Merci d'inclure : description de la faille, étapes de reproduction, impact potentiel, et version concernée.

**Délais indicatifs :** accusé de réception sous 72 h, premier diagnostic sous 7 jours, correctif selon la gravité. Merci de respecter une divulgation responsable (ne pas rendre la faille publique avant le correctif).

## Bonnes pratiques appliquées au projet

- Aucune **clé serveur / service account / clé privée** n'est versionnée. Seules les variables `VITE_*` (publiques par conception) sont utilisées côté client.
- Les fichiers `.env` sont exclus du dépôt (voir `.gitignore`) ; un `.env.example` documente les variables attendues.
- La sécurité des données repose sur les **règles Firestore** (`firestore.rules`) et **Storage** (`storage.rules`), pas sur le secret des clés client.
- Les **clés API Firebase** sont restreintes dans Google Cloud Console (restrictions par référent HTTP + APIs autorisées).
- **Secret scanning** et **Dependabot** sont activés sur le dépôt GitHub.

## En cas de fuite d'un secret

1. Révoquer / régénérer immédiatement le secret à la source (Google Cloud, Firebase, prestataire de paiement…).
2. Restreindre la clé concernée (référents HTTP, quotas, APIs).
3. Purger le secret de l'historique Git (`git filter-repo` ou BFG) puis `git push --force`.
4. Marquer l'alerte comme résolue dans GitHub.
