# Workspaces Et Entitlements

Le projet reste mono-tenant dans l usage courant, mais chaque utilisateur dispose maintenant d un `Workspace` personnel provisionne automatiquement.

Elements mis en place:

- `Workspace`, `WorkspaceMember`, `Plan`, `WorkspaceSubscription`, `WorkspaceEntitlement`
- bootstrap automatique du workspace personnel a l inscription ou a la premiere session
- abonnement `FREE` cree automatiquement
- resolution des features via le plan actif + overrides eventuels

Features actuellement resolues:

- `SEARCH_DISCOVERY`
- `EMAIL_DRAFT_GENERATION`
- `EMAIL_GMAIL_SYNC`
- `EMAIL_GMAIL_SEND`
- `COMPANY_TARGETING`
- `PROFILE_ENRICHMENT`
- `API_ACCESS`

Les routes critiques utilisent deja ces verifications avant execution.
