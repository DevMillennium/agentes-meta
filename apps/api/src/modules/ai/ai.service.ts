import OpenAI from "openai";
import { env } from "../../config/env";
import { logger } from "../../common/logger";

export type AiProvider = "openai" | "ollama" | "fallback";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiStatus {
  provider: AiProvider;
  openaiConfigured: boolean;
  ollamaConfigured: boolean;
  ollamaModel: string;
  ollamaReachable: boolean;
}

let openaiClient: OpenAI | null = null;

function getOpenAiClient(): OpenAI | null {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key || key.includes("placeholder")) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: key });
  return openaiClient;
}

function preferOpenAi(): boolean {
  return env.AI_PROVIDER === "openai" || env.AI_PROVIDER === "auto";
}

function preferOllama(): boolean {
  return env.AI_PROVIDER === "ollama" || env.AI_PROVIDER === "auto";
}

export async function probeOllama(): Promise<boolean> {
  const base = env.OLLAMA_BASE_URL.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getAiStatus(): Promise<AiStatus> {
  const openaiConfigured = Boolean(getOpenAiClient());
  const ollamaConfigured = preferOllama() && Boolean(env.OLLAMA_BASE_URL?.trim());
  const ollamaReachable = ollamaConfigured ? await probeOllama() : false;

  let provider: AiProvider = "fallback";
  if (env.AI_PROVIDER === "openai" && openaiConfigured) provider = "openai";
  else if (env.AI_PROVIDER === "ollama" && ollamaReachable) provider = "ollama";
  else if (env.AI_PROVIDER === "auto") {
    if (openaiConfigured) provider = "openai";
    else if (ollamaReachable) provider = "ollama";
  }

  return {
    provider,
    openaiConfigured,
    ollamaConfigured,
    ollamaModel: env.OLLAMA_MODEL,
    ollamaReachable
  };
}

async function chatWithOpenAi(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string | null> {
  const openai = getOpenAiClient();
  if (!openai || !preferOpenAi()) return null;

  try {
    const response = await openai.chat.completions.create(
      {
        model: env.OPENAI_MODEL,
        messages,
        max_tokens: options?.maxTokens ?? 500,
        temperature: options?.temperature ?? 0.7
      },
      { timeout: 25_000 }
    );
    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    logger.warn({ error }, "OpenAI indisponível.");
    return null;
  }
}

async function chatWithOllama(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string | null> {
  if (!preferOllama()) return null;

  const base = env.OLLAMA_BASE_URL.replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 500
        }
      }),
      signal: AbortSignal.timeout(60_000)
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { message?: { content?: string } };
    return data.message?.content?.trim() || null;
  } catch (error) {
    logger.warn({ error }, "Ollama indisponível.");
    return null;
  }
}

export function staticFallback(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const lower = lastUser.toLowerCase();

  if (/\b(comprar|preço|preco|valor|pix)\b/.test(lower)) {
    return "Ótimo! Temos pronta entrega na Phoenix Global. Me confirma sua cidade e o modelo que você quer para eu passar valor e condições.";
  }
  if (/\b(airpods|iphone|samsung|xiaomi)\b/.test(lower)) {
    return "Trabalhamos com Apple, Samsung e Xiaomi com garantia e nota. Qual modelo você busca e em qual cidade?";
  }
  return "Olá! Sou da Phoenix Global Imports. Qual produto você procura e sua cidade para eu te ajudar com disponibilidade e preço?";
}

export async function generateChatCompletion(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  if (env.AI_PROVIDER === "ollama") {
    const ollama = await chatWithOllama(messages, options);
    if (ollama) return ollama;
    const openai = await chatWithOpenAi(messages, options);
    if (openai) return openai;
    return staticFallback(messages);
  }

  const openai = await chatWithOpenAi(messages, options);
  if (openai) return openai;

  const ollama = await chatWithOllama(messages, options);
  if (ollama) return ollama;

  return staticFallback(messages);
}

export async function generateJsonCompletion<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T | null> {
  const jsonSystem = `${systemPrompt}\nResponda APENAS com um objeto JSON válido, sem markdown.`;
  const raw = await generateChatCompletion(
    [
      { role: "system", content: jsonSystem },
      { role: "user", content: userPrompt }
    ],
    { maxTokens: 900, temperature: 0.4 }
  );

  const openai = getOpenAiClient();
  if (openai && preferOpenAi() && env.AI_PROVIDER !== "ollama") {
    try {
      const response = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        max_tokens: 800,
        temperature: 0.5
      });
      const structured = response.choices[0]?.message?.content;
      if (structured) return JSON.parse(structured) as T;
    } catch {
      /* tenta parse abaixo */
    }
  }

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
