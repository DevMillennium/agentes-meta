export type ToolRisk = "low" | "medium" | "high";

export interface RegisteredTool {
  id: string;
  description: string;
  owner: "browser-agent" | "mac-agent" | "supervisor-agent";
  risk: ToolRisk;
  requiresHumanApproval: boolean;
}

const TOOLS: RegisteredTool[] = [
  {
    id: "browser.open_url",
    description: "Abre URL em browser automatizado (Playwright).",
    owner: "browser-agent",
    risk: "low",
    requiresHumanApproval: false
  },
  {
    id: "browser.screenshot",
    description: "Captura screenshot de página.",
    owner: "browser-agent",
    risk: "low",
    requiresHumanApproval: false
  },
  {
    id: "browser.extract_text",
    description: "Extrai texto de seletor CSS.",
    owner: "browser-agent",
    risk: "low",
    requiresHumanApproval: false
  },
  {
    id: "mac.open_app",
    description: "Abre aplicativo local permitido.",
    owner: "mac-agent",
    risk: "low",
    requiresHumanApproval: false
  },
  {
    id: "mac.open_url",
    description: "Abre URL em Safari/Chrome.",
    owner: "mac-agent",
    risk: "low",
    requiresHumanApproval: false
  },
  {
    id: "mac.listdir",
    description: "Lista arquivos de diretório permitido.",
    owner: "mac-agent",
    risk: "medium",
    requiresHumanApproval: false
  },
  {
    id: "mac.run_applescript",
    description: "Executa ação AppleScript permitida por whitelist.",
    owner: "mac-agent",
    risk: "high",
    requiresHumanApproval: true
  }
];

export function listRegisteredTools(): RegisteredTool[] {
  return [...TOOLS];
}

export function getToolById(toolId: string): RegisteredTool | undefined {
  return TOOLS.find((tool) => tool.id === toolId);
}
