# Modele de profil declare et profil infere

## Objectif

Poser un cadre stable pour personnaliser la recherche sans melanger:

- ce que l utilisateur declare explicitement
- ce que l application observe pendant la recherche
- ce qui reste interdit a l apprentissage automatique

## Trois couches distinctes

### 1. Profil declare

Le profil declare reste la source de verite produit.

Il provient de:

- l onboarding
- les preferences
- les editions manuelles du profil

Il contient:

- roles cibles
- domaines preferes
- mots-cles cibles
- technologies et competences explicites
- zones geographiques
- types de contrat
- mode de travail
- contraintes de disponibilite
- besoin ou non de sponsorship

### 2. Profil infere

Le profil infere sert a reprioriser la recherche, pas a redefinir l utilisateur.

Il se construit a partir de:

- recherches executees
- offres ouvertes
- feedbacks explicites
- entreprises consultees
- brouillons generes
- emails envoyes et reponses recues
- signaux outcome comme entretien, refus, offre acceptee

Le profil infere est exprime comme une liste de preferences calculees:

- axe (`ROLE`, `DOMAIN`, `KEYWORD`, `TECHNOLOGY`, `COMPANY`, etc.)
- valeur
- polarite positive ou negative
- score brut d accumulation interne
- intensite de lecture pour l interface
- niveau de confiance
- sources de signal
- nombre d evenements de soutien
- derniere observation

### 3. Garde-fous

Les garde-fous arbitrent le conflit entre profil declare et profil infere.

Ils disent pour chaque axe si l apprentissage peut:

- ne jamais modifier l explicite
- seulement booster certaines pistes
- ouvrir de l exploration
- demander une confirmation humaine
- produire du negatif uniquement avec un signal fort

## Regles retenues pour la v1

### Axes verrouilles par l explicite

- `EMPLOYMENT_TYPE`
- `LOCATION`
- `WORK_MODE`

### Axes augmentes par l implicite

- `ROLE`
- `DOMAIN`
- `KEYWORD`
- `TECHNOLOGY`
- `COMPANY`

### Axes sensibles

- `COMPANY_TYPE`
- `OUTCOME`

## Evidence vs preference

Le projet contient deja un enrichissement `portfolio / GitHub / CV`.

Ces donnees ne sont pas encore du profil infere.

Elles sont traitees comme:

- de la preuve technique
- du contexte de scoring
- une source d evidence supplementaire pour confirmer certaines preferences

Elles ne doivent pas a elles seules faire changer la cible de recherche.

## Ce qui alimente concretement l inference

Les signaux aujourd hui pris en compte sont:

- plan de recherche consulte
- recherche executee
- offre ouverte
- offre lue assez longtemps pour depasser un simple clic
- entreprise cible ouverte
- portail carriere / ATS ouvert
- feedback explicite positif ou negatif sur une offre
- offre shortlistée ou supprimee
- brouillon genere
- email envoye
- reponse recue
- issue metier comme entretien, refus ou offre acceptee

## Comment lire le score

Le moteur garde un score brut interne par preference.

Ce score:

- additionne des signaux repetes
- pondere selon la force du signal
- pondere selon la recence
- n est pas une probabilite

Il peut donc depasser `1` sans etre incoherent.

Pour l interface utilisateur, il est preferable d afficher:

- une intensite interpretable
- un nombre de signaux de soutien
- un niveau de confiance

## Pourquoi les resultats ne collent pas toujours a 100%

Le produit reste volontairement exploratoire.

Les resultats peuvent encore diverger du profil ideal pour plusieurs raisons:

- les signaux implicites sont encore peu nombreux
- l utilisateur n a pas encore donne de feedback negatif explicite
- les sources d offres et pages carrieres n ont pas toutes la meme qualite
- l inference repriorise la recherche, mais ne remplace pas le profil declare
- une part d exploration est volontairement conservee pour ne pas sur-specialiser trop vite

## Contrat code

Le contrat partage minimal vit maintenant dans:

- `packages/client-common/src/profile-personalization.ts`
- `apps/web/src/lib/profile/personalization-model.ts`

Il couvre:

- le snapshot du profil declare
- la forme cible d une preference inferee
- les garde-fous de personnalisation

## Source de verite

### Declare

- base utilisateur existante (`UserProfile`, `SearchTarget`, `SearchDomain`, `SearchLocation`)

### Infere

- future table d evenements comportementaux
- futur calcul agrege versionne

## Fichiers relies

- `apps/web/src/lib/profile/schema.ts`
- `apps/web/src/lib/profile/enrichment.ts`
- `apps/web/src/lib/search/scoring.ts`
- `packages/client-common/src/profile-personalization.ts`
