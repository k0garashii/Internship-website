# Fiche detail d offre

## But

Offrir une vue detaillee d une opportunite persistée afin de ne pas limiter l utilisateur a une simple carte de liste.

## Entrees

- `GET /api/search/offers/[offerId]`
- lecture serveur directe via `getPersistedOfferDetailForUser`

## Contenu expose

- metadonnees source: titre, entreprise, URL, type, mode, dates, statut
- dernier score et justification du matching
- requetes et mots cles retrouves dans le dernier payload de collecte
- historique des `SearchRunOffer`
- feedback utilisateur historise
- brouillons de candidature deja generes
- etat de deduplication et format commun normalise

## Role produit

Cette page sert de pivot entre:

- la liste des offres persistées
- l historique des runs
- la generation ou relecture des brouillons
- le feedback utilisateur
