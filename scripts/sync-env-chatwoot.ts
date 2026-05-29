/**
 * Atualiza variáveis CHATWOOT_* no .env sem apagar outras linhas.
 * Uso: npx tsx scripts/sync-env-chatwoot.ts KEY=VALUE KEY2=VALUE2
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

const updates: Record<string, string> = {};
for (const arg of process.argv.slice(2)) {
  const eq = arg.indexOf("=");
  if (eq <= 0) continue;
  updates[arg.slice(0, eq)] = arg.slice(eq + 1);
}

if (!Object.keys(updates).length) {
  console.error("Nenhuma variável informada.");
  process.exit(1);
}

let lines: string[] = [];
if (fs.existsSync(envPath)) {
  lines = fs.readFileSync(envPath, "utf8").split("\n");
}

const touched = new Set<string>();

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const m = line.match(/^([A-Z0-9_]+)=/);
  if (!m) continue;
  const key = m[1];
  if (key in updates) {
    const val = updates[key];
    lines[i] = `${key}=${val.includes(" ") || val.includes("#") ? `"${val}"` : val}`;
    touched.add(key);
  }
}

for (const [key, val] of Object.entries(updates)) {
  if (touched.has(key)) continue;
  lines.push(`${key}=${val.includes(" ") || val.includes("#") ? `"${val}"` : val}`);
}

fs.writeFileSync(envPath, lines.filter((l, i, arr) => !(i === arr.length - 1 && l === "")).join("\n") + "\n");
console.log("Atualizado .env:", Object.keys(updates).join(", "));
