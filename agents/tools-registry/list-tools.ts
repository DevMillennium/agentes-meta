import { listRegisteredTools } from "./tools-registry";

function main(): void {
  const tools = listRegisteredTools();
  console.log(JSON.stringify({ total: tools.length, items: tools }, null, 2));
}

main();
