import { runWhitelistedCommand } from "./command-runner";

function printUsage(): void {
  console.log(`Uso:
npm run agent:mac -- <acao> [valor]

Ações permitidas:
- openChrome
- openSafari
- openFinder
- openUrlChrome <url>
- openUrlSafari <url>
- openFolder <caminho>
- notify <mensagem>
- now
- listDir <caminho>
`);
}

async function main(): Promise<void> {
  const action = process.argv[2];
  const value = process.argv.slice(3).join(" ");

  if (!action) {
    printUsage();
    process.exit(1);
  }

  try {
    const result = await runWhitelistedCommand(action, value || undefined);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido.";
    console.error(`mac-agent error: ${message}`);
    process.exit(1);
  }
}

void main();
