import {
  buildPersonaEmail,
  buildPersonaFavoriteCompaniesSummary,
  buildPersonaFullName,
  buildPersonaVerificationSummary,
  personaSeedPassword,
  testPersonas,
  type TestPersona,
} from "../src/lib/testing/personas";

const NOTION_API_BASE_URL = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2022-06-28";
const DEFAULT_PARENT_PAGE_ID = "3279cc42-cbc8-8023-98c6-fc25a63bc90c";
const PERSONAS_PAGE_TITLE = "Personas de test multi-secteurs";

type NotionPage = {
  id: string;
  parent?: {
    type?: string;
    page_id?: string;
  };
  properties?: Record<string, unknown>;
};

type NotionBlock = {
  object: "block";
  type: string;
  [key: string]: unknown;
};

function getNotionToken() {
  const token = process.env.NOTION_TOKEN_CODEX?.trim();

  if (!token) {
    throw new Error("NOTION_TOKEN_CODEX is required to sync personas to Notion.");
  }

  return token;
}

function getParentPageId() {
  return (
    process.env.NOTION_PERSONAS_PARENT_PAGE_ID?.trim() || DEFAULT_PARENT_PAGE_ID
  );
}

function getRequestHeaders() {
  return {
    Authorization: `Bearer ${getNotionToken()}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_API_VERSION,
  };
}

async function notionRequest<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${NOTION_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...getRequestHeaders(),
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Notion API ${path} failed (${response.status}): ${body}`);
  }

  return (await response.json()) as T;
}

function readPageTitle(page: NotionPage) {
  const titleProperty = Object.values(page.properties ?? {}).find((property) => {
    return (
      typeof property === "object" &&
      property !== null &&
      "type" in property &&
      (property as { type?: string }).type === "title"
    );
  }) as { title?: Array<{ plain_text?: string }> } | undefined;

  return titleProperty?.title?.map((item) => item.plain_text ?? "").join("") ?? "";
}

async function findExistingPageByTitle(title: string, parentPageId: string) {
  const result = await notionRequest<{ results: NotionPage[] }>("/search", {
    method: "POST",
    body: JSON.stringify({
      query: title,
      filter: {
        property: "object",
        value: "page",
      },
    }),
  });

  return (
    result.results.find(
      (page) =>
        readPageTitle(page) === title &&
        page.parent?.type === "page_id" &&
        page.parent.page_id === parentPageId,
    ) ??
    result.results.find((page) => readPageTitle(page) === title) ??
    null
  );
}

async function createPage(parentPageId: string, title: string) {
  return notionRequest<NotionPage>("/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: {
        type: "page_id",
        page_id: parentPageId,
      },
      properties: {
        title: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
      },
    }),
  });
}

async function listChildBlocks(blockId: string) {
  const blocks: Array<{ id: string }> = [];
  let nextCursor: string | undefined;

  do {
    const response = await notionRequest<{
      results: Array<{ id: string }>;
      has_more: boolean;
      next_cursor: string | null;
    }>(
      `/blocks/${blockId}/children${nextCursor ? `?start_cursor=${nextCursor}` : ""}`,
      {
        method: "GET",
      },
    );

    blocks.push(...response.results);
    nextCursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (nextCursor);

  return blocks;
}

async function archiveBlock(blockId: string) {
  try {
    await notionRequest(`/blocks/${blockId}`, {
      method: "PATCH",
      body: JSON.stringify({
        archived: true,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Can't edit block that is archived")) {
      return;
    }

    throw error;
  }
}

async function replacePageContent(pageId: string, blocks: NotionBlock[]) {
  const existingBlocks = await listChildBlocks(pageId);

  for (const block of existingBlocks) {
    await archiveBlock(block.id);
  }

  for (let index = 0; index < blocks.length; index += 50) {
    await notionRequest(`/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({
        children: blocks.slice(index, index + 50),
      }),
    });
  }
}

function richText(content: string) {
  return [
    {
      type: "text",
      text: {
        content,
      },
    },
  ];
}

function paragraph(content: string): NotionBlock {
  return {
    object: "block",
    type: "paragraph",
    paragraph: {
      rich_text: richText(content),
    },
  };
}

function heading(level: 1 | 2 | 3, content: string): NotionBlock {
  const type = `heading_${level}`;

  return {
    object: "block",
    type,
    [type]: {
      rich_text: richText(content),
    },
  };
}

function bulletedListItem(content: string): NotionBlock {
  return {
    object: "block",
    type: "bulleted_list_item",
    bulleted_list_item: {
      rich_text: richText(content),
    },
  };
}

function divider(): NotionBlock {
  return {
    object: "block",
    type: "divider",
    divider: {},
  };
}

function formatPersonaDescriptor(persona: TestPersona) {
  return `${persona.age} ans - ${persona.city} - ${persona.school} - ${persona.degree}`;
}

function formatWorkMode(value: TestPersona["remotePreference"]) {
  switch (value) {
    case "REMOTE":
      return "remote";
    case "HYBRID":
      return "hybride";
    case "ONSITE":
      return "sur site";
    case "FLEXIBLE":
      return "flexible";
    default:
      return value.toLowerCase();
  }
}

function formatEmploymentTypes(persona: TestPersona) {
  return persona.employmentTypes
    .map((type) => {
      switch (type) {
        case "INTERNSHIP":
          return "stage";
        case "APPRENTICESHIP":
          return "alternance";
        case "FULL_TIME":
          return "CDI ou premier emploi";
        case "PART_TIME":
          return "temps partiel";
        case "TEMPORARY":
          return "mission temporaire";
        case "FREELANCE":
          return "freelance";
        default:
          return String(type).toLowerCase();
      }
    })
    .join(", ");
}

function buildPersonaBlocks(persona: TestPersona): NotionBlock[] {
  return [
    heading(2, `${buildPersonaFullName(persona)} - ${persona.searchSector}`),
    paragraph(persona.summaryLead),
    bulletedListItem(`Identite et formation: ${formatPersonaDescriptor(persona)}.`),
    bulletedListItem(`Sous-secteur de predilection: ${persona.preferredSubsector}.`),
    bulletedListItem(`Personnalite: ${persona.personality}`),
    bulletedListItem(`Traits dominants: ${persona.personalityTraits.join(", ")}.`),
    bulletedListItem(
      `Recherche: ${formatEmploymentTypes(persona)} en ${formatWorkMode(persona.remotePreference)} a partir du ${persona.availabilityDate}.`,
    ),
    bulletedListItem(`Roles cibles: ${persona.targetRoles.join(", ")}.`),
    heading(3, "Hard skills"),
    paragraph(persona.hardSkills.join(", ")),
    heading(3, "Soft skills"),
    paragraph(persona.softSkills.join(", ")),
    heading(3, "Certifications et habilitations"),
    paragraph(persona.certifications.join(", ")),
    heading(3, "Experiences"),
    ...persona.experiences.map((experience) => bulletedListItem(experience)),
    heading(3, "Domaines d application"),
    paragraph(persona.applicationDomains.join(", ")),
    heading(3, "Entreprises favorites"),
    paragraph(buildPersonaFavoriteCompaniesSummary(persona)),
    heading(3, "Environnements de travail vises"),
    paragraph(persona.workEnvironmentPreferences.join(", ")),
    heading(3, "Recherche detaillee"),
    bulletedListItem(`Mots-cles: ${persona.searchKeywords.join(", ")}.`),
    bulletedListItem(`Zones preferees: ${persona.preferredLocations.join(", ")}.`),
    bulletedListItem(
      `Domaines a explorer: ${persona.preferredDomains
        .map((domain) => `${domain.label} (${domain.rationale})`)
        .join("; ")}.`,
    ),
    bulletedListItem(`Langues: ${persona.languages.join(", ")}.`),
    heading(3, "Checklist de verification"),
    paragraph(buildPersonaVerificationSummary(persona)),
    divider(),
  ];
}

function buildPageBlocks() {
  return [
    heading(1, PERSONAS_PAGE_TITLE),
    paragraph(
      "Cette page centralise les personas de test crees pour valider la personnalisation de la recherche avant le lancement des tests comparatifs dans l application.",
    ),
    paragraph(
      "Le catalogue a ete volontairement diversifie au dela du numerique afin de couvrir des usages comme la sante, les espaces verts, les RH, la logistique, l hotellerie et la qualite agroalimentaire.",
    ),
    paragraph(
      "Les profils sont deja prevus pour etre injectes dans l application, mais les recherches multi-personas ne seront lancees qu apres une revue humaine explicite.",
    ),
    heading(2, "Index rapide"),
    ...testPersonas.map((persona) =>
      bulletedListItem(
        `${buildPersonaFullName(persona)} - ${persona.searchSector}`,
      ),
    ),
    divider(),
    ...testPersonas.flatMap((persona) => buildPersonaBlocks(persona)),
    heading(2, "Acces applicatif"),
    paragraph(
      "Les comptes de test utilisent un mot de passe commun pour accelerer la revue locale. Ils sont reserves au seed de test et ne seront pas utilises pour les tests de recherche avant validation.",
    ),
    bulletedListItem(`Mot de passe commun: ${personaSeedPassword}`),
    ...testPersonas.map((persona) =>
      bulletedListItem(
        `${buildPersonaFullName(persona)} - ${buildPersonaEmail(persona)}`,
      ),
    ),
  ];
}

async function main() {
  const parentPageId = getParentPageId();
  const existingPage = await findExistingPageByTitle(
    PERSONAS_PAGE_TITLE,
    parentPageId,
  );
  const page =
    existingPage ?? (await createPage(parentPageId, PERSONAS_PAGE_TITLE));

  await replacePageContent(page.id, buildPageBlocks());

  console.log(
    JSON.stringify(
      {
        pageId: page.id,
        title: PERSONAS_PAGE_TITLE,
        personaCount: testPersonas.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
