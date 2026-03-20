# Deduplication Des Offres

## Objectif

La tache `270` reduit le bruit dans le produit en evitant de recreer plusieurs `JobOffer` quand une meme opportunite reapparait sur plusieurs runs ou via plusieurs identifiants proches.

## Strategie MVP

La deduplication cote backend repose sur trois niveaux:

1. `fingerprint` exact deja produit par la normalisation
2. alias de source conserves dans `rawPayload.deduplication`
3. heuristique de rapprochement sur:
   - titre
   - entreprise
   - localisation
   - URL source
   - identifiant externe
   - proximite de date de publication

## Effet Produit

- un second run identique met a jour les `JobOffer` existants au lieu d en creer de nouveaux
- chaque run garde toutefois son propre `SearchRun`
- chaque run ne cree qu un seul `SearchRunOffer` par `JobOffer` fusionne

## Limites Volontaires

- la fusion reste heuristique et prudente
- elle n utilise pas encore un score de similarite avance
- elle ne traite pas encore les pieces jointes ou les PDF d annonces

## Suite

- `280`: formule de scoring sur les offres persistantes
- `290`: matching profil offre sur les opportunites deja dedupliquees
