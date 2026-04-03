import { runWorkerOnce, runWorkerUntilDrained } from "../src/server/application/jobs/job-worker-service";

async function main() {
  const runOnce = process.argv.includes("--once");

  if (runOnce) {
    const result = await runWorkerOnce();
    console.log(JSON.stringify(result));
    return;
  }

  const result = await runWorkerUntilDrained();
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
