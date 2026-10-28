import { spawn } from "node:child_process";

const entries = ["apps/worker/dist/main.js"];
if (process.env.FEATURE_OWNER_ADMIN === "true")
  entries.push("apps/api/dist/admin/run-worker.js");
const children = entries.map((entry) =>
  spawn(process.execPath, [entry], { stdio: "inherit", env: process.env }),
);
let stopping = false;
function stop(signal = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill(signal);
  const deadline = setTimeout(() => {
    for (const child of children)
      if (child.exitCode === null) child.kill("SIGKILL");
  }, 15000);
  deadline.unref();
}
for (const child of children) {
  child.on("error", (error) => {
    console.error(
      JSON.stringify({
        message: "worker_process_failed",
        error: error.message,
      }),
    );
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (!stopping) {
      process.exitCode = code || 1;
      stop();
    }
  });
}
process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
