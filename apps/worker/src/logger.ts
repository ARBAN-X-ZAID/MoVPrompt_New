export type LogFields = Record<string, unknown>;

export interface WorkerLogger {
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

function write(level: "info" | "warn" | "error", message: string, fields: LogFields = {}) {
  const record = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") console.error(record);
  else if (level === "warn") console.warn(record);
  else console.info(record);
}

export const jsonWorkerLogger: WorkerLogger = {
  info: (message, fields) => write("info", message, fields),
  warn: (message, fields) => write("warn", message, fields),
  error: (message, fields) => write("error", message, fields),
};
