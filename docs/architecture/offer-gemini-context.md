# Offer Gemini Context

## Purpose

Formalize the minimal context sent to Gemini when the product needs to generate a
personalized email from a retained offer.

## Current contract

The context is defined in `apps/web/src/lib/email/gemini-offer-context.ts` and validated
with `offerGeminiContextSchema`.

It contains three blocks:

- `candidate`
- `offer`
- `signals`

## Candidate block

Minimal user data required to personalize a draft without reopening the whole account:

- identity and positioning: `fullName`, `headline`, `summary`
- academic context: `school`, `degree`, `graduationYear`
- location and timing: `city`, `countryCode`, `availabilityDate`, `availabilityEndDate`
- fit signals: `skills`, `targetRoles`, `preferredDomains`, `preferredLocations`
- search framing: `searchKeywords`, `employmentTypes`, `preferencesNotes`
- supporting links: `linkedinUrl`, `githubUrl`, `portfolioUrl`, `resumeUrl`

## Offer block

Minimal offer payload required for draft generation:

- identity: `jobOfferId`, `title`, `companyName`
- source: `sourceSite`, `sourceUrl`
- placement: `locationLabel`
- lifecycle: `lifecycleStatus`
- filters: `contractType`, `workMode`
- freshness: `postedAt`
- substance: `summary`, `description`

## Signals block

Operational state attached to the offer:

- latest match quality: `latestMatchScore`, `latestRank`, `matchExplanation`
- latest search provenance: `latestSearchLabel`, `latestSearchStatus`
- user feedback: `latestFeedbackDecision`, `latestFeedbackNote`
- shortlist state: `isShortlisted`

## Builder behavior

`buildOfferGeminiContext(userId, jobOfferId)` loads:

- the authenticated user profile
- active targets, domains and preferred locations
- the selected persisted offer
- the latest `SearchRunOffer`
- the latest `OfferFeedback`

The function then returns a validated payload that can be reused by the next steps:

- system prompt design
- draft generation
- review UI
