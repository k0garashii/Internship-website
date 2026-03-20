# Classement Des Offres

## Objectif

La tache `310` classe les offres dedupliquees selon ce qui compte vraiment pour l utilisateur.

## Ordre De Tri

Le tri final applique:

1. `matching.score`
2. `priorityScore` issu des requetes utilisateur
3. score de collecte source
4. fraicheur

## Pourquoi

- le matching mesure la proximite reelle entre le profil et l offre
- la priorite conserve l intention utilisateur sur les roles / variantes de recherche
- le score source garde un signal utile quand deux offres sont proches

## Effet Produit

- l API `/api/search/discovery` renvoie deja les offres dans cet ordre
- l ecran `/workspace/search` affiche le `Match` et la `Priorite`
- le `rank` persiste dans `SearchRunOffer` suit le meme ordre
