export const AUTH_PROVIDER_IDS = {
  EMAIL_PASSWORD: "email_password",
  GOOGLE_OAUTH: "google_oauth",
} as const;

export type AuthProviderId =
  (typeof AUTH_PROVIDER_IDS)[keyof typeof AUTH_PROVIDER_IDS];

export type AuthProviderDefinition = {
  id: AuthProviderId;
  label: string;
  category: "first_party" | "oauth";
  managesIdentity: boolean;
};

export const AUTH_PROVIDER_CATALOG: AuthProviderDefinition[] = [
  {
    id: AUTH_PROVIDER_IDS.EMAIL_PASSWORD,
    label: "Email et mot de passe",
    category: "first_party",
    managesIdentity: true,
  },
  {
    id: AUTH_PROVIDER_IDS.GOOGLE_OAUTH,
    label: "Google OAuth",
    category: "oauth",
    managesIdentity: false,
  },
];
