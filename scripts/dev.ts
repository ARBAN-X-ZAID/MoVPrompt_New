import { createServer } from "node:net";

const rootDirectory = import.meta.dir.replace(/\/scripts$/, "");

async function assertPortAvailable(label: string, port: number) {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();

    probe.unref();
    probe.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(
          `[MovPrompt] Cannot start: ${label} port ${port} is already in use.\n` +
          "[MovPrompt] Another local dev stack may already be running. Stop it with Ctrl+C, then run bun run dev again.",
        ));
        return;
      }
      reject(error);
    });
    probe.listen({ host: "::", port, exclusive: true }, () => {
      probe.close((error) => error ? reject(error) : resolve());
    });
  });
}

async function assertRequiredPortsAvailable() {
  const apiPort = Number.parseInt(process.env.API_PORT?.trim() || "8787", 10);
  await Promise.all([
    assertPortAvailable("web", 8080),
    assertPortAvailable("API", apiPort),
  ]);
}

async function runDatabaseCheck() {
  const check = Bun.spawn(["bun", "scripts/dev-database-status.ts"], {
    cwd: rootDirectory,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
  await check.exited;
}

function start(label: string, command: string[]) {
  console.log(`[MovPrompt] Starting ${label}`);
  return Bun.spawn(command, {
    cwd: rootDirectory,
    env: process.env,
    stdout: "inherit",
    stderr: "inherit",
  });
}

async function waitForApi() {
  const apiOrigin = process.env.API_ORIGIN?.trim() || "http://localhost:8787";
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${apiOrigin}/api/v1/feature-flags`, {
        signal: AbortSignal.timeout(1_500),
      });
      if (response.ok) {
        const body = await response.json() as { features?: { authentication?: boolean } };
        if (body.features?.authentication) {
          console.log("[MovPrompt] API ready: authentication and MongoDB are active");
          return;
        }
        console.warn("[MovPrompt] API started, but authentication is disabled. Check FEATURE_AUTHENTICATION in .env");
        return;
      }
    } catch {
      // The API watcher may still be compiling.
    }
    await Bun.sleep(300);
  }
  console.warn("[MovPrompt] API did not become ready within 20 seconds. Check the API output above.");
}

try {
  await assertRequiredPortsAvailable();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

await runDatabaseCheck();

const children = [
  start("API on http://localhost:8787", ["bun", "run", "--cwd", "apps/api", "dev"]),
  start("web app on http://localhost:8080", ["bun", "run", "--cwd", "apps/web", "dev"]),
];

if (process.env.FEATURE_GENERATION?.trim().toLowerCase() === "true") {
  children.push(start("generation worker", ["bun", "run", "--cwd", "apps/worker", "dev"]));
} else {
  console.log("[MovPrompt] Generation worker skipped: FEATURE_GENERATION=false");
}

void waitForApi();

let stopping = false;
function stop(signal: NodeJS.Signals) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

const exitCode = await Promise.race(children.map((child) => child.exited));
stop("SIGTERM");
await Promise.allSettled(children.map((child) => child.exited));
process.exitCode = exitCode;
