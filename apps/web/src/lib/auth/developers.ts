// Developer accounts are listed in an environment variable rather than in the
// database, so no user can grant this status to themselves.
export function isDeveloperEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }

  const developerEmails = (process.env.DEVELOPER_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return developerEmails.includes(email.trim().toLowerCase());
}
