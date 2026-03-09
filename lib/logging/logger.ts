export interface LogContext {
  component?: string;
  stage?: string;
  jobId?: string;
  wallet?: string;
  attempt?: number;
  durationMs?: number;
  errorCode?: string;
  [key: string]: unknown;
}

type LogLevel = "info" | "warn" | "error";

function sanitizeContext(context: LogContext): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  );
}

function emit(level: LogLevel, message: string, context: LogContext): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...sanitizeContext(context),
  };

  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export const logger = {
  info(message: string, context: LogContext = {}) {
    emit("info", message, context);
  },
  warn(message: string, context: LogContext = {}) {
    emit("warn", message, context);
  },
  error(message: string, context: LogContext = {}) {
    emit("error", message, context);
  },
};

