# Recherche Initiale D Offres

## Objectif

La tache `240` introduit la premiere collecte internet reelle d offres a partir du profil utilisateur. Cette etape ne persiste pas encore les offres en base: elle produit une previsualisation dedupliquee exploitable pour verifier que le moteur de recherche suit bien le profil et les preferences.

## Sources actives

- `Welcome to the Jungle`
  Type: job board public
  Methode: interrogation de l index public Algolia utilise par le front public WTTJ
- `LinkedIn Jobs`
  Type: job board public direct
  Methode: interrogation du endpoint public guest `jobs-guest/jobs/api/seeMoreJobPostings/search`, puis parsing des cartes HTML
- `Indeed`
  Type: job board public best effort via recherche web
  Methode: recherche web classifiee et filtrage des liens `indeed.*`
- `Autres job boards / ATS / pages carrieres`
  Type: recherche web approfondie
  Methode: recherche Bing RSS large, puis filtrage et classification des resultats
- `Pages carrieres d entreprises cibles`
  Type: lecture directe de sources premier parti
  Methode: generation d entreprises cibles, detection du point d entree carriere / ATS, puis lecture directe des offres

## Entree

- profil exporte depuis la base via `exportUserConfig`
- plan de requetes genere par `buildSearchQueryPlan`
- filtres legers derives des preferences:
  - pays cibles si disponibles
  - types de contrat
- en cas de zero resultat, fallback automatique vers une variante de requete plus courte sur WTTJ
- interrogation directe de LinkedIn Jobs avec `keywords + location`
- lecture directe d un sous-ensemble de pages carrieres / ATS detectees sur les entreprises les plus pertinentes
- pour la recherche web:
  - requete large orientee profil
  - requete ciblee LinkedIn
  - requete ciblee Indeed
  - requete ciblee pages carrieres / ATS

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
  - site source reel
  - resume brut
  - requetes du profil ayant match

## Limites actuelles

- LinkedIn est lu via son endpoint guest public, sans API partenaire officielle
- Indeed et plusieurs job boards tiers restent en best effort via recherche web publique
- les metadonnees detaillees dependent de ce qui est visible dans les cartes publiques ou les snippets publics
- les pages tres protegees ou chargees uniquement en JS restent moins bien couvertes
- la collecte reste centree sur les sources web publiques et les pages carrieres detectables

## Prochaines taches

- `250`: normaliser les offres dans un format interne stable
- `260`: persister les offres et les runs de recherche
- `270`: dedupliquer par empreinte inter-sources
- `280` et `290`: scoring et matching par rapport au profil
