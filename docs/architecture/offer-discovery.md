# Recherche Initiale D Offres

## Objectif

La tache `240` introduit la premiere collecte internet reelle d offres a partir du profil utilisateur. Cette etape ne persiste pas encore les offres en base: elle produit une previsualisation dedupliquee exploitable pour verifier que le moteur de recherche suit bien le profil et les preferences.

## Source active

- Source actuellement implementee: `Welcome to the Jungle`
- Type de source: job board public
- Methode: interrogation de l index public Algolia utilise par le front public WTTJ

## Entree

- profil exporte depuis la base via `exportUserConfig`
- plan de requetes genere par `buildSearchQueryPlan`
- filtres legers derives des preferences:
  - pays cibles si disponibles
  - types de contrat
- en cas de zero resultat, fallback automatique vers une variante de requete plus courte

## Sortie

La route `GET/POST /api/search/discovery` retourne:

- un resume d execution
- les requetes executees
- les avertissements eventuels
- une liste d offres dedupliquees avec:
  - titre
  - entreprise
  - localisation
  - date de publication
  - contrat
  - mode de travail
  - URL source
  - resume brut
  - requetes du profil ayant match

## Limites volontaires du MVP

- une seule source publique est active
- aucune persistance en base a ce stade
- pas de scoring final ni de shortlist
- pas encore de normalisation multi-sources

## Prochaines taches

- `250`: normaliser les offres dans un format interne stable
- `260`: persister les offres et les runs de recherche
- `270`: dedupliquer par empreinte inter-sources
- `280` et `290`: scoring et matching par rapport au profil
