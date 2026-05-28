import { execFile } from "node:child_process";
import { writeAgentLog } from "../shared/logger";
import { buildAllowedCommand } from "./allowed-commands";

export interface CommandRunResult {
  ok: boolean;
  action: string;
  stdout: string;
  stderr: string;
}

export async function runWhitelistedCommand(action: string, value?: string): Promise<CommandRunResult> {
  const { command, args } = buildAllowedCommand(action, value);

  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 15_000 }, (error, stdout, stderr) => {
      if (error) {
        writeAgentLog("mac-agent", "error", "Command failed", {
          action,
          command,
          args,
          error: error.message,
          stderr
        });
        reject(error);
        return;
      }

      const result: CommandRunResult = {
        ok: true,
        action,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      };
      writeAgentLog("mac-agent", "info", "Command executed", {
        action,
        command,
        args,
        stderr: result.stderr || null
      });
      resolve(result);
    });
  });
}
