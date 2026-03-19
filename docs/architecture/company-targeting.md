# Ciblage D Entreprises

## Objectif

Avant de collecter des offres sur des plateformes publiques, le moteur doit pouvoir
transformer le profil utilisateur en une liste d entreprises cibles plausibles.
Cette etape repond au cas ou des offres existent surtout sur des sites carrieres
proprietaires ou des portails institutionnels plutot que sur LinkedIn.

## Principe

Le ciblage d entreprises lit:

- le profil utilisateur
- les domaines valides
- les roles cibles
- les localisations
- la watchlist deja existante

Puis il produit une liste priorisee d entreprises a investiguer.

## Sortie

La route `GET/POST /api/profile/company-targets` retourne:

- un resume de generation
- le provider utilise (`gemini` ou `fallback`)
- une liste de suggestions avec:
  - `companyName`
  - `websiteUrl`
  - `careerPageUrl`
  - `notes`
  - `rationale`
  - `priority`
  - `tags`
  - `matchedSignals`

## MVP actuel

- fallback deterministe sur un catalogue cible d entreprises et organismes
- enrichissement Gemini quand une cle est disponible
- exclusion des entreprises deja presentes dans `company_watchlist`
- aucune persistance automatique dans la watchlist a ce stade

## Suite prevue

- decouverte des pages carrieres et ATS pour les entreprises retenues
- integration des suggestions dans `company_watchlist`
- priorisation des collecteurs proprietaires avant les job boards
- extension a l ingestion email pour les alertes et approches recruteurs
