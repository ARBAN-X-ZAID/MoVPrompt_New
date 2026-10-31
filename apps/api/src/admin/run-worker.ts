import { createWalletWorkerRuntime } from "./wallet-worker-runtime.js";
import { createPaymentsConfigFromEnvironment } from "../payments/providers.js";
import { createRuntimeServices } from "../runtime-services.js";
import { loadApiConfig } from "../config.js";
import { createAdminOperationWorker } from "./operation-worker.js";
import { ensureAdminIndexes } from "./security.js";

if (process.env.FEATURE_OWNER_ADMIN !== "true")
  throw new Error("The admin worker requires FEATURE_OWNER_ADMIN=true");
const walletOnly = process.env.ADMIN_READ_ONLY === "true";
const runtime = walletOnly ? createWalletWorkerRuntime(process.env) : createRuntimeServices(loadApiConfig());
if (!runtime.admin)
  throw new Error("Owner administration runtime is unavailable");
await runtime.admin.database.connect();
await ensureAdminIndexes(runtime.admin.database);
const worker = createAdminOperationWorker({
  ...runtime.admin,
  ...("generationService" in runtime && runtime.generationService
    ? { generation: runtime.generationService }
    : {}),
  ...("generationAvailability" in runtime && runtime.generationAvailability
    ? { generationAvailability: runtime.generationAvailability }
    : {}),
  provider: !walletOnly || (process.env.ADMIN_REFUNDS_ENABLED === "true" && process.env.ADMIN_REFUND_ACCEPTANCE_VERIFIED === "true")
    ? createPaymentsConfigFromEnvironment(process.env).provider : null,
  environment: process.env,
});
worker.start();
// The standalone worker owns a referenced lifetime, unlike the reusable timer.
const lifetime = setInterval(() => undefined, 60000);
async function stop() {
  clearInterval(lifetime);
  await worker.stop();
  await runtime.close();
}
process.once("SIGINT", () => {
  void stop();
});
process.once("SIGTERM", () => {
  void stop();
});
console.info(JSON.stringify({ message: "admin_operation_worker_started" }));
