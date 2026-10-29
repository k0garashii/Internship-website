import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const MIN_SECRET_LENGTH = 32;
const DEVELOPMENT_FALLBACK_SECRET =
  "internship-scrapper-development-only-secret-do-not-use-in-production";
const KEY_DERIVATION_SALT = "internship-scrapper";
const ENCRYPTED_VALUE_PREFIX = "enc:v1:";

export type SecretPurpose = "oauth-state" | "token-encryption";

export class MissingAppSecretError extends Error {
  constructor() {
    super(
      `APP_SECRET must be set to a random string of at least ${MIN_SECRET_LENGTH} characters`,
    );
    this.name = "MissingAppSecretError";
  }
}

function getAppSecret() {
  const secret = process.env.APP_SECRET?.trim();

  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new MissingAppSecretError();
  }

  return DEVELOPMENT_FALLBACK_SECRET;
}

function deriveKey(purpose: SecretPurpose) {
  return Buffer.from(
    hkdfSync("sha256", getAppSecret(), KEY_DERIVATION_SALT, purpose, 32),
  );
}

function computeSignature(value: string, purpose: SecretPurpose) {
  return createHmac("sha256", deriveKey(purpose)).update(value).digest("base64url");
}

export function safeEqualStrings(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function signValue(value: string, purpose: SecretPurpose) {
  return `${value}.${computeSignature(value, purpose)}`;
}

export function verifySignedValue(
  signedValue: string | null | undefined,
  purpose: SecretPurpose,
) {
  if (!signedValue) {
    return null;
  }

  const separatorIndex = signedValue.lastIndexOf(".");

  if (separatorIndex <= 0) {
    return null;
  }

  const value = signedValue.slice(0, separatorIndex);
  const signature = signedValue.slice(separatorIndex + 1);

  return safeEqualStrings(signature, computeSignature(value, purpose)) ? value : null;
}

export function isEncryptedSecret(value: string | null | undefined) {
  return Boolean(value?.startsWith(ENCRYPTED_VALUE_PREFIX));
}

export function encryptSecret(value: string): string;
export function encryptSecret(value: string | null | undefined): string | null;
export function encryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (isEncryptedSecret(value)) {
    return value;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey("token-encryption"), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_VALUE_PREFIX}${[iv, authTag, ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".")}`;
}

// Values written before encryption was introduced are returned as-is so that
// existing Gmail connections keep working until their next token refresh.
export function decryptSecret(value: string): string;
export function decryptSecret(value: string | null | undefined): string | null;
export function decryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  if (!isEncryptedSecret(value)) {
    return value;
  }

  const [iv, authTag, ciphertext] = value
    .slice(ENCRYPTED_VALUE_PREFIX.length)
    .split(".")
    .map((part) => Buffer.from(part, "base64url"));

  if (!iv || !authTag || !ciphertext) {
    throw new Error("Malformed encrypted secret");
  }

  const decipher = createDecipheriv("aes-256-gcm", deriveKey("token-encryption"), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
