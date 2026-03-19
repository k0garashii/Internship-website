import { z } from "zod";

const prioritySchema = z
  .number()
  .int()
  .min(0)
  .max(100)
  .default(50);

const optionalUrlSchema = z
  .union([z.url(), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export function normalizeCompanyName(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const companyWatchlistItemSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  websiteUrl: optionalUrlSchema.optional().default(null),
  careerPageUrl: optionalUrlSchema.optional().default(null),
  notes: z
    .union([z.string().trim().max(1000), z.literal(""), z.null(), z.undefined()])
    .transform((value) => value || null)
    .default(null),
  priority: prioritySchema,
  isActive: z.boolean().default(true),
});

export const companyWatchlistFileSchema = z
  .object({
    version: z.literal(1).default(1),
    items: z.array(companyWatchlistItemSchema).max(500),
  })
  .superRefine((value, context) => {
    const seen = new Map<string, number>();

    value.items.forEach((item, index) => {
      const normalizedName = normalizeCompanyName(item.companyName);

      if (seen.has(normalizedName)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "companyName"],
          message: `Duplicate company entry for ${item.companyName}`,
        });
        return;
      }

      seen.set(normalizedName, index);
    });
  });

export type CompanyWatchlistItemInput = z.input<typeof companyWatchlistItemSchema>;
export type CompanyWatchlistFileInput = z.input<typeof companyWatchlistFileSchema>;
export type CompanyWatchlistItem = z.output<typeof companyWatchlistItemSchema> & {
  normalizedName: string;
};
export type CompanyWatchlistFile = {
  version: 1;
  items: CompanyWatchlistItem[];
};

export function parseCompanyWatchlistFile(input: unknown): CompanyWatchlistFile {
  const parsed = companyWatchlistFileSchema.parse(input);

  return {
    version: parsed.version,
    items: parsed.items.map((item) => ({
      ...item,
      normalizedName: normalizeCompanyName(item.companyName),
    })),
  };
}

export function getCompanyWatchlistExample(): CompanyWatchlistFileInput {
  return {
    version: 1,
    items: [
      {
        companyName: "Alan",
        websiteUrl: "https://alan.com",
        careerPageUrl: "https://alan.com/careers",
        notes: "Produit B2B SaaS europeen",
        priority: 80,
        isActive: true,
      },
    ],
  };
}
