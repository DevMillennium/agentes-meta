import { mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";

export type AgentLogLevel = "info" | "warn" | "error";

function ensureDir(dirPath: string): void {
  mkdirSync(dirPath, { recursive: true });
}

function resolveLogDir(kind: "actions" | "errors"): string {
  return path.resolve(__dirname, "..", "logs", kind);
}

export function resolveScreenshotsDir(): string {
  const dir = path.resolve(__dirname, "..", "logs", "screenshots");
  ensureDir(dir);
  return dir;
}

export function writeAgentLog(
  source: string,
  level: AgentLogLevel,
  message: string,
  data?: Record<string, unknown>
): void {
  const kind = level === "error" ? "errors" : "actions";
  const logDir = resolveLogDir(kind);
  ensureDir(logDir);

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    source,
    level,
    message,
    data: data ?? null
  });

  const file = path.join(logDir, `${new Date().toISOString().slice(0, 10)}.log`);
  appendFileSync(file, `${line}\n`, { encoding: "utf8" });
}
