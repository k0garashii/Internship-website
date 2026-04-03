import type { ProfileOnboardingInput } from "@/lib/profile/schema";

export const personaSeedPassword = "PersonaTest123!";

export type PersonaFavoriteCompany = {
  name: string;
  rationale: string;
};

export type PersonaVerificationCriterion = {
  label: string;
  expectedSignals: string[];
};

export type TestPersona = {
  slug: string;
  firstName: string;
  lastName: string;
  age: number;
  searchSector: string;
  preferredSubsector: string;
  city: string;
  countryCode: string;
  headline: string;
  summaryLead: string;
  personality: string;
  personalityTraits: string[];
  school: string;
  degree: string;
  graduationYear: string;
  remotePreference: NonNullable<ProfileOnboardingInput["remotePreference"]>;
  experienceLevel: NonNullable<ProfileOnboardingInput["experienceLevel"]>;
  availabilityDate: string;
  availabilityEndDate: string;
  employmentTypes: NonNullable<ProfileOnboardingInput["employmentTypes"]>;
  hardSkills: string[];
  softSkills: string[];
  experiences: string[];
  applicationDomains: string[];
  certifications: string[];
  workEnvironmentPreferences: string[];
  targetRoles: string[];
  searchKeywords: string[];
  preferredLocations: string[];
  preferredDomains: Array<{
    label: string;
    rationale: string;
  }>;
  languages: string[];
  favoriteCompanies: PersonaFavoriteCompany[];
  verificationChecklist: PersonaVerificationCriterion[];
};

export const testPersonas: TestPersona[] = [
  {
    slug: "camille-arnaud",
    firstName: "Camille",
    lastName: "Arnaud",
    age: 29,
    searchSector: "Sante publique, coordination clinique et recherche medicale",
    preferredSubsector: "Coordination de parcours et recherche clinique en prevention",
    city: "Paris",
    countryCode: "FR",
    headline:
      "Medecin junior orientee coordination clinique, prevention et projets de sante publique",
    summaryLead:
      "Profil medical qui cherche un poste en coordination de parcours, recherche clinique ou pilotage d actions de prevention.",
    personality:
      "Calme, tres pedagogue et orientee impact patient, Camille aime les environnements ou elle peut faire le lien entre le soin, les donnees terrain et les equipes pluridisciplinaires.",
    personalityTraits: [
      "Empathique",
      "Rassurante",
      "Structurante",
      "Tres terrain",
    ],
    school: "Universite Paris Cite",
    degree: "Diplome d Etat de docteure en medecine",
    graduationYear: "2025",
    remotePreference: "HYBRID",
    experienceLevel: "MID",
    availabilityDate: "2026-06-01",
    availabilityEndDate: "2027-06-30",
    employmentTypes: ["FULL_TIME", "PART_TIME"],
    hardSkills: [
      "Consultation clinique",
      "Coordination de parcours",
      "Education therapeutique",
      "Protocoles de soins",
      "Recherche clinique",
      "Analyse epidemiologique",
      "Triage",
      "Dossier patient",
      "Prevention sante",
    ],
    softSkills: [
      "Empathie",
      "Sang froid",
      "Pedagogie",
      "Rigueur",
      "Coordination pluridisciplinaire",
    ],
    experiences: [
      "Internat en medecine generale avec coordination de parcours complexes en hopital public.",
      "Mission de prevention sante dans un centre municipal avec ateliers collectifs et suivi de patients chroniques.",
      "Participation a un protocole de recherche clinique sur l observance therapeutique et la qualite de vie.",
    ],
    applicationDomains: [
      "Sante publique",
      "Recherche clinique",
      "Parcours de soins",
      "Prevention",
    ],
    certifications: [
      "Diplome d Etat de docteure en medecine",
      "AFGSU niveau 2",
      "Formation bonnes pratiques cliniques",
    ],
    workEnvironmentPreferences: [
      "Hopitaux",
      "Centres de sante",
      "Associations de prevention",
      "Organismes de recherche clinique",
    ],
    targetRoles: [
      "Medecin coordonnateur",
      "Charge de mission sante publique",
      "Coordinateur de recherche clinique",
      "Medical Advisor Junior",
    ],
    searchKeywords: [
      "medecin",
      "sante publique",
      "coordination clinique",
      "prevention",
      "recherche clinique",
      "parcours de soins",
      "education therapeutique",
    ],
    preferredLocations: ["Paris", "Ile-de-France", "Lyon", "Lille"],
    preferredDomains: [
      {
        label: "Sante publique",
        rationale: "Son experience combine terrain clinique et actions collectives de prevention.",
      },
      {
        label: "Recherche clinique",
        rationale: "Elle veut rester proche de protocoles medicaux et d etudes en vie reelle.",
      },
      {
        label: "Parcours de soins",
        rationale: "La coordination entre soignants et patients est un fil rouge de ses experiences.",
      },
      {
        label: "Prevention et accompagnement",
        rationale: "Elle souhaite des postes avec impact direct sur l education et le suivi des patients.",
      },
    ],
    languages: ["Francais courant", "Anglais professionnel"],
    favoriteCompanies: [
      {
        name: "Institut Curie",
        rationale: "Pour combiner parcours de soins, recherche clinique et coordination.",
      },
      {
        name: "Gustave Roussy",
        rationale: "Pour les environnements cliniques a forte exigence scientifique.",
      },
      {
        name: "AP-HP",
        rationale: "Pour les postes de coordination et de sante publique a grande echelle.",
      },
    ],
    verificationChecklist: [
      {
        label: "Les offres doivent mentionner coordination, parcours, essai clinique ou prevention.",
        expectedSignals: ["coordination", "parcours", "recherche clinique", "prevention"],
      },
      {
        label: "Les entreprises proposees doivent appartenir au soin, a la recherche medicale ou a la sante publique.",
        expectedSignals: ["hopital", "centre de sante", "institut", "sante"],
      },
    ],
  },
  {
    slug: "lea-morvan",
    firstName: "Lea",
    lastName: "Morvan",
    age: 24,
    searchSector: "Espaces verts, paysage et entretien du patrimoine vegetal",
    preferredSubsector: "Amenagement paysager durable pour collectivites et sites patrimoniaux",
    city: "Rennes",
    countryCode: "FR",
    headline:
      "Ouvriere paysagiste junior orientee entretien, plantations et gestion durable des espaces verts",
    summaryLead:
      "Profil terrain qui cherche un poste en espaces verts, paysagisme ou gestion de chantiers vegetaux.",
    personality:
      "Lea est energique, tres concrete et heureuse quand elle voit le resultat de son travail dans l espace public. Elle prefere les equipes de terrain ou l entraide et la qualite d execution comptent vraiment.",
    personalityTraits: ["Dynamique", "Endurante", "Consciencieuse", "Fiable"],
    school: "CFAA du Rheu",
    degree: "BTS amenagements paysagers",
    graduationYear: "2026",
    remotePreference: "ONSITE",
    experienceLevel: "JUNIOR",
    availabilityDate: "2026-07-01",
    availabilityEndDate: "2027-03-31",
    employmentTypes: ["FULL_TIME", "APPRENTICESHIP"],
    hardSkills: [
      "Reconnaissance des vegetaux",
      "Plantation",
      "Taille",
      "Entretien de massifs",
      "Irrigation",
      "Lecture de plans",
      "Conduite de mini engins",
      "Debroussaillage",
      "Securite chantier",
    ],
    softSkills: [
      "Endurance",
      "Sens du detail",
      "Travail en equipe",
      "Ponctualite",
      "Respect des consignes",
    ],
    experiences: [
      "Alternance dans une entreprise du paysage avec entretien de parcs prives et de residences collectives.",
      "Chantier ecole sur la requalification d un square urbain avec plantations et mise en place d arrosage.",
      "Mission saisonniere en collectivite pour l entretien des massifs et le suivi de l etat phytosanitaire.",
    ],
    applicationDomains: [
      "Espaces verts urbains",
      "Paysagisme",
      "Patrimoine vegetal",
      "Arrosage et entretien",
    ],
    certifications: ["Certiphyto operateur", "CACES A mini engins"],
    workEnvironmentPreferences: [
      "Collectivites",
      "Entreprises du paysage",
      "Sites patrimoniaux",
      "Residences et bureaux",
    ],
    targetRoles: [
      "Ouvrier paysagiste",
      "Technicien espaces verts",
      "Chef d equipe espaces verts junior",
      "Conducteur de travaux paysagers junior",
    ],
    searchKeywords: [
      "espaces verts",
      "paysagiste",
      "entretien",
      "plantation",
      "taille",
      "irrigation",
      "patrimoine vegetal",
    ],
    preferredLocations: ["Rennes", "Nantes", "Saint-Malo", "Bretagne"],
    preferredDomains: [
      {
        label: "Espaces verts",
        rationale: "Ses experiences sont centrees sur l entretien et l amenagement d espaces vegetaux.",
      },
      {
        label: "Paysagisme",
        rationale: "Elle veut evoluer sur des chantiers visibles avec une composante terrain forte.",
      },
      {
        label: "Patrimoine vegetal",
        rationale: "Le suivi durable des vegetaux est l un de ses points d interet principaux.",
      },
      {
        label: "Amenagement exterieur",
        rationale: "Elle aime les postes ou il faut preparer, planter et maintenir des espaces de vie.",
      },
    ],
    languages: ["Francais courant", "Anglais scolaire"],
    favoriteCompanies: [
      {
        name: "ID Verde",
        rationale: "Pour les chantiers multi-sites et l entretien d espaces verts de grande ampleur.",
      },
      {
        name: "Mairie de Rennes",
        rationale: "Pour les espaces verts urbains et la gestion durable en collectivite.",
      },
      {
        name: "Breizh Jardin",
        rationale: "Pour une structure plus terrain avec forte composante amenagement exterieur.",
      },
    ],
    verificationChecklist: [
      {
        label: "Les offres doivent parler de plantation, entretien, taille, chantier ou amenagement.",
        expectedSignals: ["plantation", "entretien", "taille", "chantier", "amenagement"],
      },
      {
        label: "Les entreprises proposees doivent etre ancrees dans le paysage, les espaces verts ou les collectivites.",
        expectedSignals: ["paysage", "espaces verts", "collectivite", "jardin"],
      },
    ],
  },
  {
    slug: "malik-benali",
    firstName: "Malik",
    lastName: "Benali",
    age: 26,
    searchSector: "Ressources humaines, recrutement et developpement des talents",
    preferredSubsector: "Talent acquisition et integration dans des structures en croissance",
    city: "Lille",
    countryCode: "FR",
    headline:
      "Generaliste RH junior focalise recrutement, integration et accompagnement des collaborateurs",
    summaryLead:
      "Profil RH qui cherche des offres en recrutement, talent acquisition, formation ou administration RH.",
    personality:
      "Malik est sociable, organise et tres a l aise pour mettre les gens en confiance. Il prefere les environnements ou le recrutement ne se limite pas au sourcing mais va jusqu a l integration et au developpement des talents.",
    personalityTraits: ["Chaleureux", "Diplomate", "Structure", "Curieux"],
    school: "IAE Lille",
    degree: "Master gestion des ressources humaines",
    graduationYear: "2026",
    remotePreference: "HYBRID",
    experienceLevel: "JUNIOR",
    availabilityDate: "2026-09-01",
    availabilityEndDate: "2027-04-30",
    employmentTypes: ["FULL_TIME", "APPRENTICESHIP"],
    hardSkills: [
      "Recrutement",
      "Conduite d entretiens",
      "SIRH",
      "Onboarding",
      "Droit social",
      "Marque employeur",
      "Relations ecoles",
      "Plan de formation",
      "Tableaux de bord RH",
    ],
    softSkills: [
      "Ecoute active",
      "Discretion",
      "Organisation",
      "Diplomatie",
      "Sens du service",
    ],
    experiences: [
      "Alternance au sein d un service RH de groupe retail avec gestion de recrutements magasin et siege.",
      "Projet ecole sur la refonte d un parcours d integration et la mesure de retention a 90 jours.",
      "Mission associative d accompagnement a la preparation d entretiens pour des jeunes diplomes.",
    ],
    applicationDomains: [
      "Ressources humaines",
      "Recrutement",
      "Formation",
      "Experience collaborateur",
    ],
    certifications: [
      "Certification LinkedIn Recruiter",
      "MOOC fondamentaux du droit du travail",
    ],
    workEnvironmentPreferences: [
      "ETI",
      "Groupes multi sites",
      "Cabinets de recrutement",
      "Structures en croissance",
    ],
    targetRoles: [
      "Charge de recrutement",
      "Generaliste RH junior",
      "Talent Acquisition Specialist Junior",
      "Charge de formation",
    ],
    searchKeywords: [
      "rh",
      "recrutement",
      "talent acquisition",
      "onboarding",
      "formation",
      "sirh",
      "experience collaborateur",
    ],
    preferredLocations: ["Lille", "Paris", "Roubaix", "Remote France"],
    preferredDomains: [
      {
        label: "Ressources humaines",
        rationale: "C est le coeur de son parcours et de ses experiences professionnelles.",
      },
      {
        label: "Recrutement",
        rationale: "Il se sent a l aise sur l evaluation de profils et la conduite d entretiens.",
      },
      {
        label: "Formation et integration",
        rationale: "Il veut suivre le collaborateur apres l embauche et structurer son integration.",
      },
      {
        label: "People operations",
        rationale: "Les volets process, outils et tableaux de bord l interessent aussi beaucoup.",
      },
    ],
    languages: ["Francais courant", "Anglais professionnel", "Arabe conversationnel"],
    favoriteCompanies: [
      {
        name: "Decathlon",
        rationale: "Pour des recrutements volumineux et une culture d integration terrain.",
      },
      {
        name: "Kiabi",
        rationale: "Pour les environnements retail multi-sites avec vrais enjeux RH.",
      },
      {
        name: "Page Personnel",
        rationale: "Pour apprendre vite sur le recrutement et la relation candidat.",
      },
    ],
    verificationChecklist: [
      {
        label: "Les offres doivent mentionner recrutement, entretiens, onboarding, formation ou SIRH.",
        expectedSignals: ["recrutement", "entretien", "onboarding", "formation", "sirh"],
      },
      {
        label: "Les entreprises proposees doivent avoir une fonction RH ou talent forte et visible.",
        expectedSignals: ["rh", "talent", "people", "recrutement"],
      },
    ],
  },
  {
    slug: "nora-silva",
    firstName: "Nora",
    lastName: "Silva",
    age: 25,
    searchSector: "Logistique, supply chain et planification operationnelle",
    preferredSubsector: "Pilotage de flux et approvisionnement sur reseaux multi-sites",
    city: "Lyon",
    countryCode: "FR",
    headline:
      "Coordinatrice logistique junior orientee approvisionnement, pilotage de flux et excellence operationnelle",
    summaryLead:
      "Profil supply chain qui cherche des offres en logistique, planification, ordonnancement ou approvisionnement.",
    personality:
      "Nora aime que les choses avancent sans friction. Elle est tres reactive, aime les environnements complexes mais concrets et prend naturellement le reflexe de prioriser ce qui bloque les operations.",
    personalityTraits: ["Reactive", "Methodique", "Collective", "Orientee solution"],
    school: "KEDGE Business School",
    degree: "Master supply chain et achats",
    graduationYear: "2026",
    remotePreference: "HYBRID",
    experienceLevel: "JUNIOR",
    availabilityDate: "2026-08-15",
    availabilityEndDate: "2027-03-31",
    employmentTypes: ["FULL_TIME", "APPRENTICESHIP"],
    hardSkills: [
      "Gestion de stocks",
      "SAP",
      "WMS",
      "Approvisionnement",
      "Planification transport",
      "Excel avance",
      "Inventaires",
      "KPI logistique",
      "Lean management",
    ],
    softSkills: [
      "Reactivite",
      "Priorisation",
      "Fiabilite",
      "Communication terrain",
      "Sens du collectif",
    ],
    experiences: [
      "Alternance dans un entrepot e-commerce avec suivi des ruptures et pilotage des flux entrants.",
      "Projet de fin d etudes sur la reduction du taux d erreur de preparation et la refonte des indicateurs de service.",
      "Mission courte de planification transport sur un reseau multi agences avec coordination de prestataires.",
    ],
    applicationDomains: [
      "Logistique",
      "Supply chain",
      "Distribution",
      "E-commerce",
    ],
    certifications: ["Green Belt Lean Six Sigma", "Formation SAP MM debutant"],
    workEnvironmentPreferences: [
      "Entrepots",
      "Sites industriels",
      "Retail",
      "Reseaux multi sites",
    ],
    targetRoles: [
      "Coordinateur logistique",
      "Approvisionneur",
      "Assistant supply chain",
      "Planificateur operationnel",
    ],
    searchKeywords: [
      "logistique",
      "supply chain",
      "approvisionnement",
      "planification",
      "sap",
      "wms",
      "flux",
    ],
    preferredLocations: ["Lyon", "Saint-Etienne", "Grenoble", "Paris"],
    preferredDomains: [
      {
        label: "Logistique",
        rationale: "La gestion de flux et la coordination d operations sont ses points forts.",
      },
      {
        label: "Supply chain",
        rationale: "Elle veut garder une vision plus large que le seul entrepot.",
      },
      {
        label: "Distribution",
        rationale: "Ses stages dans des reseaux multi sites l ont bien preparee a ce contexte.",
      },
      {
        label: "Excellence operationnelle",
        rationale: "Elle aime les postes ou l on optimise des process concrets.",
      },
    ],
    languages: ["Francais courant", "Anglais professionnel", "Portugais conversationnel"],
    favoriteCompanies: [
      {
        name: "GEODIS",
        rationale: "Pour l ampleur operationnelle et les enjeux transport / supply chain.",
      },
      {
        name: "FM Logistic",
        rationale: "Pour les postes orientes flux, entrepot et excellence operationnelle.",
      },
      {
        name: "Leroy Merlin",
        rationale: "Pour la planification et l approvisionnement sur reseaux multi-sites.",
      },
    ],
    verificationChecklist: [
      {
        label: "Les offres doivent parler de flux, planification, stocks, approvisionnement ou transport.",
        expectedSignals: ["flux", "planification", "stocks", "approvisionnement", "transport"],
      },
      {
        label: "Les entreprises proposees doivent avoir une activite logistique, distribution ou supply chain forte.",
        expectedSignals: ["logistique", "distribution", "supply chain", "entrepot"],
      },
    ],
  },
  {
    slug: "yanis-dupont",
    firstName: "Yanis",
    lastName: "Dupont",
    age: 24,
    searchSector: "Hotellerie, evenementiel et relation client premium",
    preferredSubsector: "Hospitality premium et coordination d evenements corporate",
    city: "Paris",
    countryCode: "FR",
    headline:
      "Coordinateur hotellerie et evenementiel junior oriente accueil premium et organisation d evenements",
    summaryLead:
      "Profil service et operations qui cherche des offres en hotellerie, evenementiel, guest relations ou exploitation.",
    personality:
      "Yanis aime les contextes ou l experience client se joue dans les details. Il est tres presentable, garde son calme en pic d activite et prefere les environnements premium avec une forte exigence de service.",
    personalityTraits: ["Elegant", "Calme", "Adaptable", "Sens du service"],
    school: "Ferrandi Paris",
    degree: "Bachelor management hotelier et evenementiel",
    graduationYear: "2026",
    remotePreference: "ONSITE",
    experienceLevel: "JUNIOR",
    availabilityDate: "2026-07-01",
    availabilityEndDate: "2027-02-28",
    employmentTypes: ["FULL_TIME", "INTERNSHIP"],
    hardSkills: [
      "Gestion de reservations",
      "Coordination evenementielle",
      "Service client premium",
      "CRM hotelier",
      "Planification des equipes",
      "Budgets evenementiels",
      "Accueil VIP",
      "Upsell",
      "Suivi prestataires",
    ],
    softSkills: [
      "Presentation",
      "Adaptabilite",
      "Calme",
      "Sens du detail",
      "Communication",
    ],
    experiences: [
      "Stage en hotel quatre etoiles avec gestion du front office et coordination d arrivées groupes.",
      "Organisation d evenements corporate pour une ecole avec gestion des prestataires et du planning jour J.",
      "Mission saisonniere en guest relations dans un site touristique haut de gamme.",
    ],
    applicationDomains: [
      "Hotellerie",
      "Evenementiel",
      "Tourisme",
      "Hospitality premium",
    ],
    certifications: ["HACCP", "Certificat anglais accueil international"],
    workEnvironmentPreferences: [
      "Hotels",
      "Lieux evenementiels",
      "Tourisme haut de gamme",
      "Maisons de luxe",
    ],
    targetRoles: [
      "Charge d evenementiel",
      "Coordinateur banquets",
      "Guest Relations Officer",
      "Assistant exploitation hoteliere",
    ],
    searchKeywords: [
      "hotellerie",
      "evenementiel",
      "guest relations",
      "front office",
      "banquet",
      "hospitality",
      "service client premium",
    ],
    preferredLocations: ["Paris", "Versailles", "Lille", "Cote d Azur"],
    preferredDomains: [
      {
        label: "Hotellerie",
        rationale: "Ses stages l ont deja expose aux operations d accueil et de service.",
      },
      {
        label: "Evenementiel",
        rationale: "Il aime coordonner des equipes et des prestataires dans un cadre rythme.",
      },
      {
        label: "Tourisme et loisirs",
        rationale: "Le contact client et l experience visiteur sont des moteurs forts pour lui.",
      },
      {
        label: "Luxe et premium",
        rationale: "Il apprecie les standards eleves de service et le soin du detail.",
      },
    ],
    languages: ["Francais courant", "Anglais courant", "Espagnol conversationnel"],
    favoriteCompanies: [
      {
        name: "Accor",
        rationale: "Pour l exposition a l hotellerie structurée et aux operations premium.",
      },
      {
        name: "Viparis",
        rationale: "Pour la coordination evenementielle sur grands sites parisiens.",
      },
      {
        name: "Barriere",
        rationale: "Pour les standards de service haut de gamme et l exploitation multi-metiers.",
      },
    ],
    verificationChecklist: [
      {
        label: "Les offres doivent mentionner accueil, guest relations, evenementiel, front office ou coordination.",
        expectedSignals: ["accueil", "guest relations", "evenementiel", "front office", "coordination"],
      },
      {
        label: "Les entreprises proposees doivent avoir une vraie dimension hospitality, tourisme ou premium.",
        expectedSignals: ["hotel", "hospitality", "event", "tourisme", "premium"],
      },
    ],
  },
  {
    slug: "ines-morel",
    firstName: "Ines",
    lastName: "Morel",
    age: 25,
    searchSector: "Qualite agroalimentaire, hygiene et securite des productions",
    preferredSubsector: "Securite alimentaire et audits qualite sur sites de production",
    city: "Nantes",
    countryCode: "FR",
    headline:
      "Technicienne qualite junior orientee securite alimentaire, audits terrain et amelioration continue",
    summaryLead:
      "Profil qualite qui cherche des offres en agroalimentaire, hygiene, securite alimentaire ou controle qualite.",
    personality:
      "Ines est rigoureuse, tres terrain et aime faire progresser les standards sans perdre les equipes. Elle prefere les roles ou il faut autant controler que convaincre et former.",
    personalityTraits: ["Rigoureuse", "Pedagogue", "Terrain", "Exigeante"],
    school: "ESA Angers",
    degree: "Master qualite et securite des aliments",
    graduationYear: "2026",
    remotePreference: "ONSITE",
    experienceLevel: "JUNIOR",
    availabilityDate: "2026-08-01",
    availabilityEndDate: "2027-03-31",
    employmentTypes: ["FULL_TIME", "APPRENTICESHIP"],
    hardSkills: [
      "HACCP",
      "Audits terrain",
      "Traçabilite",
      "Gestion des non conformites",
      "ISO 22000",
      "IFS Food",
      "Plan de nettoyage",
      "Sensibilisation des equipes",
      "Controle qualite",
    ],
    softSkills: [
      "Rigueur",
      "Pedagogie",
      "Fermete bienveillante",
      "Esprit terrain",
      "Organisation",
    ],
    experiences: [
      "Alternance sur un site de production agroalimentaire avec suivi des audits internes et gestion des actions correctives.",
      "Projet ecole sur la reduction des non conformites d emballage et l amelioration de la traçabilite.",
      "Mission qualite dans une cuisine centrale avec mise a jour des procedures hygiene et sensibilisation des equipes.",
    ],
    applicationDomains: [
      "Agroalimentaire",
      "Securite alimentaire",
      "Hygiene",
      "Amelioration continue",
    ],
    certifications: ["HACCP", "Initiation IFS Food", "Sensibilisation ISO 22000"],
    workEnvironmentPreferences: [
      "Sites de production",
      "Laboratoires qualite",
      "Restauration collective",
      "Industries alimentaires",
    ],
    targetRoles: [
      "Technicien qualite agroalimentaire",
      "Assistant qualite",
      "Coordinateur securite alimentaire junior",
      "Charge hygiene et qualite",
    ],
    searchKeywords: [
      "qualite agroalimentaire",
      "haccp",
      "securite alimentaire",
      "hygiene",
      "audit terrain",
      "traceabilite",
      "ifs food",
    ],
    preferredLocations: ["Nantes", "Angers", "Rennes", "Cholet"],
    preferredDomains: [
      {
        label: "Qualite agroalimentaire",
        rationale: "C est le coeur de son parcours et le secteur ou elle est la plus rapidement operationnelle.",
      },
      {
        label: "Securite alimentaire",
        rationale: "Elle aime les postes ou les exigences de conformite ont un impact direct sur le produit final.",
      },
      {
        label: "Hygiene et process",
        rationale: "La mise en place de routines terrain et de bonnes pratiques lui convient bien.",
      },
      {
        label: "Amelioration continue",
        rationale: "Elle cherche des environnements ou l on peut faire progresser concretement les standards qualite.",
      },
    ],
    languages: ["Francais courant", "Anglais professionnel"],
    favoriteCompanies: [
      {
        name: "Fleury Michon",
        rationale: "Pour les enjeux qualite et securite alimentaire sur production industrielle.",
      },
      {
        name: "Sodebo",
        rationale: "Pour les roles qualite terrain avec impact direct sur les process.",
      },
      {
        name: "Lactalis",
        rationale: "Pour les environnements exigeants en hygiene, audit et conformite.",
      },
    ],
    verificationChecklist: [
      {
        label: "Les offres doivent mentionner HACCP, audit, hygiene, non conformites ou traceabilite.",
        expectedSignals: ["haccp", "audit", "hygiene", "non conformite", "traceabilite"],
      },
      {
        label: "Les entreprises proposees doivent relever de l agroalimentaire, de la production ou de la restauration collective.",
        expectedSignals: ["agroalimentaire", "production", "qualite", "alimentaire"],
      },
    ],
  },
];

export function buildPersonaFullName(persona: TestPersona) {
  return `${persona.firstName} ${persona.lastName}`;
}

export function buildPersonaEmail(persona: TestPersona) {
  return `${persona.firstName}.${persona.lastName}.persona@example.com`
    .toLowerCase()
    .replace(/[^a-z0-9.@_-]+/g, "");
}

export function buildPersonaSummary(persona: TestPersona) {
  return [
    persona.summaryLead,
    `Personnalite: ${persona.personality}`,
    `Experiences clefs: ${persona.experiences.join(" ")}`,
    `Domaines d application: ${persona.applicationDomains.join(", ")}.`,
    `Soft skills: ${persona.softSkills.join(", ")}.`,
    `Certifications: ${persona.certifications.join(", ")}.`,
    `Environnements vises: ${persona.workEnvironmentPreferences.join(", ")}.`,
    `Langues: ${persona.languages.join(", ")}.`,
  ].join(" ");
}

export function buildPersonaPreferencesNotes(persona: TestPersona) {
  return [
    `Secteur prioritaire: ${persona.searchSector}.`,
    `Sous-secteur de predilection: ${persona.preferredSubsector}.`,
    `Traits de personnalite: ${persona.personalityTraits.join(", ")}.`,
    `Soft skills: ${persona.softSkills.join(", ")}.`,
    `Domaines d application: ${persona.applicationDomains.join(", ")}.`,
    `Certifications clefs: ${persona.certifications.slice(0, 2).join(", ")}.`,
    `Entreprises favorites: ${persona.favoriteCompanies
      .map((company) => company.name)
      .join(", ")}.`,
    `Environnements vises: ${persona.workEnvironmentPreferences.join(", ")}.`,
    `Experiences: ${persona.experiences.slice(0, 2).join(" | ")}.`,
  ].join(" ");
}

export function buildPersonaFavoriteCompaniesSummary(persona: TestPersona) {
  return persona.favoriteCompanies
    .map((company) => `${company.name} (${company.rationale})`)
    .join("; ");
}

export function buildPersonaVerificationSummary(persona: TestPersona) {
  return persona.verificationChecklist
    .map(
      (criterion) =>
        `${criterion.label} Signaux attendus: ${criterion.expectedSignals.join(", ")}.`,
    )
    .join(" ");
}

export function buildPersonaDomainSelections(persona: TestPersona) {
  return persona.preferredDomains.map((domain) => ({
    label: domain.label,
    rationale: domain.rationale,
    source: "MANUAL" as const,
    isValidated: true,
  }));
}

export function buildPersonaOnboardingPayload(
  persona: TestPersona,
): ProfileOnboardingInput & {
  domainSelections: ReturnType<typeof buildPersonaDomainSelections>;
} {
  return {
    fullName: buildPersonaFullName(persona),
    headline: persona.headline,
    summary: buildPersonaSummary(persona),
    school: persona.school,
    degree: persona.degree,
    graduationYear: persona.graduationYear,
    city: persona.city,
    countryCode: persona.countryCode,
    remotePreference: persona.remotePreference,
    experienceLevel: persona.experienceLevel,
    availabilityDate: persona.availabilityDate,
    availabilityEndDate: persona.availabilityEndDate,
    linkedinUrl: "",
    githubUrl: "",
    portfolioUrl: "",
    resumeUrl: "",
    visaNeedsSponsorship: false,
    salaryExpectationMin: null,
    salaryExpectationMax: null,
    skills: persona.hardSkills.join(", "),
    preferencesNotes: buildPersonaPreferencesNotes(persona),
    targetRoles: persona.targetRoles.join(", "),
    searchKeywords: persona.searchKeywords.join(", "),
    preferredLocations: persona.preferredLocations.join(", "),
    preferredDomains: persona.preferredDomains.map((domain) => domain.label).join(", "),
    employmentTypes: persona.employmentTypes,
    domainSelections: buildPersonaDomainSelections(persona),
  };
}
