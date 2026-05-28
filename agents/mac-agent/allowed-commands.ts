import os from "node:os";
import path from "node:path";

export interface AllowedCommand {
  command: string;
  args: string[];
}

const BLOCKED_TOKENS = [
  "rm ",
  "sudo ",
  "chmod ",
  "chown ",
  "curl ",
  "| bash",
  "killall",
  "dd ",
  "mkfs",
  "shutdown",
  "reboot"
];

function assertSafeInput(value: string, field: string): void {
  const lowered = value.toLowerCase();
  for (const token of BLOCKED_TOKENS) {
    if (lowered.includes(token.trim())) {
      throw new Error(`Entrada bloqueada para ${field}: contém padrão proibido (${token.trim()}).`);
    }
  }
}

function getAllowedBaseDirs(): string[] {
  const envDirs = (process.env.MAC_AGENT_ALLOWED_DIRS ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (envDirs.length > 0) return envDirs;
  return [process.cwd(), path.join(os.homedir(), "Desktop")];
}

function assertAllowedDirectory(targetPath: string): void {
  const resolved = path.resolve(targetPath);
  const allowed = getAllowedBaseDirs().some((base) => resolved.startsWith(path.resolve(base)));
  if (!allowed) {
    throw new Error(
      `Diretório não permitido: ${resolved}. Ajuste MAC_AGENT_ALLOWED_DIRS para autorizar explicitamente.`
    );
  }
}

function assertHttpUrl(url: string): void {
  assertSafeInput(url, "url");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL inválida.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Apenas URLs http/https são permitidas.");
  }
}

export function buildAllowedCommand(action: string, value?: string): AllowedCommand {
  const safeValue = value?.trim();

  switch (action) {
    case "openChrome":
      return { command: "open", args: ["-a", "Google Chrome"] };
    case "openSafari":
      return { command: "open", args: ["-a", "Safari"] };
    case "openFinder":
      return { command: "open", args: ["-a", "Finder"] };
    case "openUrlChrome":
      if (!safeValue) throw new Error("Informe uma URL para openUrlChrome.");
      assertHttpUrl(safeValue);
      return { command: "open", args: ["-a", "Google Chrome", safeValue] };
    case "openUrlSafari":
      if (!safeValue) throw new Error("Informe uma URL para openUrlSafari.");
      assertHttpUrl(safeValue);
      return { command: "open", args: ["-a", "Safari", safeValue] };
    case "openFolder":
      if (!safeValue) throw new Error("Informe um caminho para openFolder.");
      assertSafeInput(safeValue, "path");
      assertAllowedDirectory(safeValue);
      return { command: "open", args: [path.resolve(safeValue)] };
    case "notify":
      if (!safeValue) throw new Error("Informe a mensagem da notificação.");
      assertSafeInput(safeValue, "message");
      return {
        command: "osascript",
        args: ["-e", `display notification "${safeValue}" with title "Phoenix Mac Agent"`]
      };
    case "now":
      return { command: "date", args: [] };
    case "listDir":
      if (!safeValue) throw new Error("Informe um diretório para listDir.");
      assertSafeInput(safeValue, "path");
      assertAllowedDirectory(safeValue);
      return { command: "ls", args: ["-la", path.resolve(safeValue)] };
    default:
      throw new Error(`Ação não permitida: ${action}`);
  }
}
