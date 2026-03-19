# Champs profil utiles a la recherche

## Objectif

Definir un noyau de champs suffisant pour:

- guider les futures recherches d'offres
- alimenter le matching et le scoring
- fournir un contexte exploitable par Gemini pour la personnalisation

## Noyau retenu

### Identite et contexte candidat

- `User.fullName`
- `UserProfile.headline`
- `UserProfile.summary`

### Formation et disponibilite

- `UserProfile.school`
- `UserProfile.degree`
- `UserProfile.graduationYear`
- `UserProfile.availabilityDate`

### Localisation et modalites

- `UserProfile.city`
- `UserProfile.countryCode`
- `UserProfile.remotePreference`
- `UserProfile.visaNeedsSponsorship`
- `SearchLocation[]`

### Experience et attentes

- `UserProfile.experienceLevel`
- `UserProfile.salaryExpectationMin`
- `UserProfile.salaryExpectationMax`
- `UserProfile.constraints.preferencesNotes`

### Presence professionnelle

- `UserProfile.linkedinUrl`
- `UserProfile.githubUrl`
- `UserProfile.portfolioUrl`
- `UserProfile.resumeUrl`

### Signal metier pour la recherche

- `ProfileSkill[]`
- `SearchTarget[]`
- `SearchDomain[]`
- `constraints.employmentTypes`

## Pourquoi ce noyau

- il couvre les besoins cites dans la backlog: etudes, competences, localisation, type de poste et contraintes
- il reste directement persistable et rechargeable par utilisateur
- il est exploitable a la fois par le matching regle + score et par Gemini

## Hors scope pour l'instant

- historique detaille d'experience
- langues
- portfolio de projets structure
- upload de CV binaire
- regles de scoring personnalisees

## Fichiers relies

- `apps/web/prisma/schema.prisma`
- `apps/web/src/lib/profile/onboarding.ts`
- `apps/web/src/app/workspace/onboarding/page.tsx`
