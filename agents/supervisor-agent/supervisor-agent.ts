import { writeAgentLog } from "../shared/logger";

export type SupervisorRisk = "low" | "medium" | "high" | "critical";

export interface SupervisorInput {
  action: string;
  target?: string;
  details?: string;
}

export interface SupervisorDecision {
  approved: boolean;
  requiresHumanApproval: boolean;
  risk: SupervisorRisk;
  reason: string;
}

const HIGH_RISK_PATTERNS = [
  /budget/i,
  /pause.*campaign/i,
  /publish.*ad/i,
  /mass.*message/i,
  /delete|drop|truncate|rm -rf/i,
  /permission|role|access/i
];

const CRITICAL_PATTERNS = [/delete.*database/i, /payment|charge|invoice/i, /wire|pix/i];

export function evaluateAction(input: SupervisorInput): SupervisorDecision {
  const joined = `${input.action} ${input.target ?? ""} ${input.details ?? ""}`.trim();

  if (CRITICAL_PATTERNS.some((pattern) => pattern.test(joined))) {
    return {
      approved: false,
      requiresHumanApproval: true,
      risk: "critical",
      reason: "Ação crítica detectada; bloqueada até aprovação humana explícita."
    };
  }

  if (HIGH_RISK_PATTERNS.some((pattern) => pattern.test(joined))) {
    return {
      approved: false,
      requiresHumanApproval: true,
      risk: "high",
      reason: "Ação sensível detectada; exige aprovação humana."
    };
  }

  if (/login|token|secret|password/i.test(joined)) {
    return {
      approved: false,
      requiresHumanApproval: true,
      risk: "medium",
      reason: "Operação com credenciais/sessão; exige revisão humana."
    };
  }

  return {
    approved: true,
    requiresHumanApproval: false,
    risk: "low",
    reason: "Ação de baixo risco autorizada automaticamente."
  };
}

function main(): void {
  const action = process.argv[2];
  const target = process.argv[3];
  const details = process.argv.slice(4).join(" ");

  if (!action) {
    console.error("Uso: npm run agent:supervisor -- <action> [target] [details]");
    process.exit(1);
  }

  const decision = evaluateAction({ action, target, details });
  writeAgentLog("supervisor-agent", "info", "Decision generated", {
    action,
    target,
    decision
  });
  console.log(JSON.stringify(decision, null, 2));
}

if (require.main === module) {
  main();
}
