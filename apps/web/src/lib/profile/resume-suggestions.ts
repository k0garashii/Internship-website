// Shared by the resume import API and the profile form (client-safe: no server imports).

export type ResumeProfileSuggestions = {
  headline: string | null;
  summary: string | null;
  school: string | null;
  degree: string | null;
  graduationYear: number | null;
  city: string | null;
  skills: string[];
  targetRoles: string[];
  languages: string[];
  hasDrivingLicense: boolean | null;
};

export type ResumeSuggestionTarget = {
  headline: string;
  summary: string;
  school: string;
  degree: string;
  graduationYear: string;
  city: string;
  skills: string;
  targetRoles: string;
  languages: string;
  hasDrivingLicense: string;
};

function splitList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function mergeList(current: string, additions: string[]) {
  const existing = splitList(current);
  const seen = new Set(existing.map((item) => item.toLowerCase()));
  const merged = [...existing];

  for (const item of additions) {
    const trimmed = item.trim();

    if (trimmed && !seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      merged.push(trimmed);
    }
  }

  return merged.join(", ");
}

// Never overwrites what the user already typed: text fields are only filled
// when empty and lists are merged without duplicates.
export function applyResumeSuggestions<T extends ResumeSuggestionTarget>(
  profile: T,
  suggestions: ResumeProfileSuggestions,
): { profile: T; filledFields: string[] } {
  const next = { ...profile };
  const filledFields: string[] = [];

  const textFields = ["headline", "summary", "school", "degree", "city"] as const;

  for (const field of textFields) {
    const value = suggestions[field];

    if (value && !next[field].trim()) {
      next[field] = value as T[typeof field];
      filledFields.push(field);
    }
  }

  if (suggestions.graduationYear && !next.graduationYear.trim()) {
    next.graduationYear = String(suggestions.graduationYear) as T["graduationYear"];
    filledFields.push("graduationYear");
  }

  const listFields = ["skills", "targetRoles", "languages"] as const;

  for (const field of listFields) {
    const merged = mergeList(next[field], suggestions[field]);

    if (merged !== next[field]) {
      next[field] = merged as T[typeof field];
      filledFields.push(field);
    }
  }

  if (suggestions.hasDrivingLicense !== null && !next.hasDrivingLicense) {
    next.hasDrivingLicense = (suggestions.hasDrivingLicense ? "yes" : "no") as T["hasDrivingLicense"];
    filledFields.push("hasDrivingLicense");
  }

  return { profile: next, filledFields };
}
