import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

const root = fileURLToPath(new URL("../", import.meta.url));
const local = parseEnv(readFileSync(resolve(root, ".env.infrastructure"), "utf8"));
const gateway = parseEnv(readFileSync(resolve(root, ".env"), "utf8"));
const env = { ...process.env, ...local, ...gateway };
const command = process.argv[2] || "help";
const compose = ["compose", "--env-file", ".env.infrastructure", "--env-file", ".env", "--profile", "application"];
const commands = {
  up: ["docker", [...compose, "up", "-d", "--build", "--remove-orphans"]],
  down: ["docker", [...compose, "down", "--remove-orphans"]],
  status: ["docker", [...compose, "ps"]],
  web: ["bun", ["run", "dev:web", "--host", "127.0.0.1", "--strictPort"]],
  auth: ["bun", ["run", "--cwd", "apps/worker", "gateway:auth"]],
  readiness: ["bun", ["run", "--cwd", "apps/worker", "gateway:readiness"]],
  models: ["bun", ["run", "--cwd", "apps/worker", "gateway:models"]],
  "test-video": [process.execPath, [resolve(root, ".local-setup/test-video.mjs"), ...process.argv.slice(3)]],
};
if (!commands[command]) {
  console.log("Usage: node .local-setup/run.mjs <up|down|status|web|auth|readiness|models|test-video>");
  process.exit(command === "help" ? 0 : 1);
}
if (env.APP_ENV !== "local") throw new Error("This launcher only runs APP_ENV=local.");
const [program, args] = commands[command];
const child = spawn(program, args, { cwd: root, env, stdio: "inherit" });
child.on("error", (error) => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
