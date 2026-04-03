import assert from "node:assert/strict";
import {
  spawn,
  spawnSync,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import test, { after } from "node:test";

let port = 3031;
let baseUrl = `http://127.0.0.1:${port}`;
const NPM_CMD = "C:\\nvm4w\\nodejs\\npm.cmd";
const SESSION_COOKIE_NAME = "internship_scrapper_session";

let serverProcess: ChildProcessWithoutNullStreams | null = null;
let serverOutput = "";

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);

      if (response.ok) {
        return;
      }
    } catch {}

    await delay(1000);
  }

  throw new Error(`Server did not start in time.\n${serverOutput}`);
}

async function reserveOpenPort() {
  return new Promise<number>((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to reserve an open port for e2e tests."));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
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
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const rawBody = await response.text();
  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (error) {
    const excerpt = rawBody.slice(0, 600);
    throw new Error(
      [
        `Expected JSON from ${pathname} but received non-JSON content.`,
        `Status: ${response.status}`,
        `Body excerpt:`,
        excerpt,
        `Server output:`,
        serverOutput.slice(-4000),
      ].join("\n"),
      {
        cause: error,
      },
    );
  }

  return {
    response,
    payload,
  };
}

test("full user flow covers auth, onboarding, search, feedback and draft generation", async (t) => {
  port = await reserveOpenPort();
  baseUrl = `http://127.0.0.1:${port}`;
  serverProcess = spawn(
    "cmd.exe",
    [
      "/c",
      NPM_CMD,
      "run",
      "start",
      "--",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
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

    const workspacePage = await fetch(`${baseUrl}/workspace`, {
      headers: {
        Cookie: sessionCookie,
      },
      redirect: "manual",
    });

    assert.equal(workspacePage.status, 200);

    const workspaceControlPage = await fetch(`${baseUrl}/workspace/workspace`, {
      headers: {
        Cookie: sessionCookie,
      },
      redirect: "manual",
    });

    assert.equal(workspaceControlPage.status, 200);

    const workspaceApi = await requestJson("/api/workspace", {
      cookie: sessionCookie,
    });

    assert.equal(workspaceApi.response.status, 200);

    const invitedEmail = `test-flow-invite-${stamp}@example.com`;
    const invitation = await requestJson("/api/workspace/invitations", {
      method: "POST",
      cookie: sessionCookie,
      body: {
        email: invitedEmail,
        role: "MEMBER",
      },
    });

    assert.equal(invitation.response.status, 201);
    const inviteLink = (invitation.payload.invitation as { inviteLink: string }).inviteLink;
    assert.ok(inviteLink);
    const inviteToken = new URL(inviteLink).searchParams.get("token");
    assert.ok(inviteToken);

    const invitedRegister = await requestJson("/api/auth/register", {
      method: "POST",
      body: {
        fullName: "Invited Flow",
        email: invitedEmail,
        password,
      },
    });

    assert.equal(invitedRegister.response.status, 201);
    const invitedCookie = extractSessionCookie(invitedRegister.response);
    assert.ok(invitedCookie);

    const invitationAcceptance = await requestJson("/api/workspace/invitations/accept", {
      method: "POST",
      cookie: invitedCookie,
      body: {
        token: inviteToken,
      },
    });

    assert.equal(invitationAcceptance.response.status, 200);

    const invitedWorkspace = await requestJson("/api/workspace", {
      cookie: invitedCookie,
    });

    assert.equal(invitedWorkspace.response.status, 200);
    assert.equal(
      (invitedWorkspace.payload.currentWorkspace as { name: string | null }).name,
      (workspaceApi.payload.currentWorkspace as { name: string | null }).name,
    );

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
