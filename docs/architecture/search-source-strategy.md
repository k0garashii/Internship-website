# Strategie de recherche par type de source

## Objectif

Definir, pour chaque type de source, la methode de recherche a utiliser avant l implementation de la collecte.

## 1. Pages careers des entreprises

Strategie:

- partir de la watchlist et des entreprises decouvertes via les plateformes
- acceder directement aux pages `careers`, `jobs`, `join-us` ou `work-with-us`
- prioriser recherche simple et extraction ciblee sur pages first-party

Technique privilegiee:

- navigation web simple
- parsing HTML cible
- scraping limite aux pages de l entreprise

Gemini:

- non necessaire pour la collecte
- utile seulement pour classer l entreprise ou enrichir le contexte ensuite

## 2. Job boards structures

Concerne:

- LinkedIn Jobs
- Welcome to the Jungle
- JobTeaser
- Apec
- Indeed

Strategie:

- utiliser d abord les pages de recherche et filtres publics
- construire des requetes a partir du plan de recherche
- extraire seulement les metadonnees utiles a la suite:
  - titre
  - entreprise
  - localisation
  - url source
  - date si disponible

Technique privilegiee:

- recherche web ou navigation ciblee par plateforme
- scraping modere et stable sur pages liste
- approfondissement sur la fiche detail seulement pour les offres prometteuses

Gemini:

- ne doit pas servir a remplacer la collecte
- peut aider a reformuler les requetes ou classer les resultats

## 3. Recherche web generaliste

Strategie:

- utiliser le web search comme filet de decouverte supplementaire
- s en servir surtout pour trouver:
  - pages careers non encore connues
  - entreprises pertinentes par domaine
  - offres non visibles sur les plateformes prioritaires

Technique privilegiee:

- requetes explicites basees sur `role + domaine + localisation + site`
- pas de scraping massif en premiere intention

Gemini:

- utile pour proposer des variations de requetes
- utile pour elargir les synonymes de roles ou de domaines

## 4. Regles de decision

1. Si la source est une page first-party entreprise, preferer extraction directe.
2. Si la source est une plateforme structuree, commencer par les pages de recherche publiques.
3. Si la source n est pas structuree ou peu fiable, passer par la recherche web generaliste pour retrouver une source plus propre.
4. Utiliser Gemini seulement comme assistant de formulation, de regroupement ou de priorisation, jamais comme source d offre.

## 5. Ce que cela prepare

- `240` recherche initiale d offres sur internet
- `250` normalisation dans un format commun
- `260` persistance des offres et de leur source
