import assert from "node:assert/strict";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import test, { after } from "node:test";

const PORT = 3031;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const NPM_CMD = "C:\\nvm4w\\nodejs\\npm.cmd";
const SESSION_COOKIE_NAME = "internship_scrapper_session";

let serverProcess: ChildProcessWithoutNullStreams | null = null;
let serverOutput = "";

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {}

    await delay(1000);
  }

  throw new Error(`Server did not start in time.\n${serverOutput}`);
}

function extractSessionCookie(response: Response) {
  const rawCookie = response.headers.get("set-cookie");
  const match = rawCookie?.match(
    new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`),
  );

  return match ? `${SESSION_COOKIE_NAME}=${match[1]}` : null;
}

async function requestJson(
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string | null;
  } = {},
) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = (await response.json()) as Record<string, unknown>;

  return {
    response,
    payload,
  };
}

test("full user flow covers auth, onboarding, search, feedback and draft generation", async (t) => {
  serverProcess = spawn(
    "cmd.exe",
    [
      "/c",
      NPM_CMD,
      "run",
      "dev",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(PORT),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PATH: `C:\\nvm4w\\nodejs;${process.env.PATH ?? ""}`,
      },
      stdio: "pipe",
    },
  );

  serverProcess.stdout.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });
  serverProcess.stderr.on("data", (chunk) => {
    serverOutput += chunk.toString();
  });

  await waitForServer();

  await t.test("registers, searches, stores feedback and generates a draft", async () => {
    const stamp = Date.now();
    const email = `test-flow-${stamp}@example.com`;
    const password = "TempPass123!";

    const register = await requestJson("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Test Flow",
        email,
        password,
      },
    });

    assert.equal(register.response.status, 201);
    const sessionCookie = extractSessionCookie(register.response);
    assert.ok(sessionCookie);

    const onboarding = await requestJson("/api/profile/onboarding", {
      method: "POST",
      cookie: sessionCookie,
      body: {
        fullName: "Test Flow",
        headline: "Software Engineer C++ simulation",
        summary: "Profil oriente C++, simulation numerique et moteur 3D.",
        school: "EPITA",
        degree: "Cycle ingenieur",
        graduationYear: "2027",
        city: "Paris",
        countryCode: "FR",
        remotePreference: "ONSITE",
        experienceLevel: "INTERN",
        availabilityDate: "2026-06-01",
        availabilityEndDate: "2026-12-31",
        linkedinUrl: "https://www.linkedin.com/in/test-flow",
        githubUrl: "https://github.com/test-flow",
        portfolioUrl: "",
        resumeUrl: "",
        visaNeedsSponsorship: false,
        salaryExpectationMin: "1200",
        salaryExpectationMax: "1800",
        skills: "C++, Python, Simulation physique, OpenGL, HPC",
        targetRoles:
          "Software Engineer (C++), Simulation Engineer, Graphics Programmer",
        searchKeywords:
          "C++, simulation numerique, calcul scientifique, moteur 3D, OpenGL",
        preferredLocations: "Paris, Saclay, France entiere",
        preferredDomains:
          "Calcul haute performance, Ingenierie R&D, Simulation numerique",
        preferencesNotes: "Smoke test automatise",
        employmentTypes: ["INTERNSHIP"],
        domainSelections: [
          {
            label: "Calcul haute performance",
            rationale: "Calcul scientifique et optimisation",
            source: "MANUAL",
            isValidated: true,
          },
          {
            label: "Simulation numerique",
            rationale: "Simulation, modelisation et algorithmique",
            source: "MANUAL",
            isValidated: true,
          },
        ],
      },
    });

    assert.equal(onboarding.response.status, 200);

    const discovery = await requestJson("/api/search/discovery", {
      method: "POST",
      cookie: sessionCookie,
    });

    assert.equal(discovery.response.status, 200);
    assert.equal(typeof discovery.payload.offerCount, "number");

    const offers = await requestJson("/api/search/offers", {
      cookie: sessionCookie,
    });

    assert.equal(offers.response.status, 200);
    const firstOffer = (offers.payload.offers as Array<Record<string, unknown>>)[0];
    assert.ok(firstOffer);
    const offerId = firstOffer.id as string;

    const feedback = await requestJson(`/api/search/offers/${offerId}/feedback`, {
      method: "POST",
      cookie: sessionCookie,
      body: {
        decision: "FAVORITE",
        note: "Test favori automatise",
      },
    });

    assert.equal(feedback.response.status, 200);

    const draft = await requestJson("/api/email/drafts/generate", {
      method: "POST",
      cookie: sessionCookie,
      body: {
        jobOfferId: offerId,
      },
    });

    assert.equal(draft.response.status, 200);

    const drafts = await requestJson("/api/email/drafts", {
      cookie: sessionCookie,
    });

    assert.equal(drafts.response.status, 200);
    assert.ok((drafts.payload.drafts as Array<unknown>).length >= 1);
  });
}, { timeout: 240_000 });

after(async () => {
  if (!serverProcess) {
    return;
  }

  if (typeof serverProcess.pid === "number") {
    spawnSync("taskkill", ["/PID", String(serverProcess.pid), "/T", "/F"], {
      stdio: "ignore",
    });
  }

  await delay(1000);
});
