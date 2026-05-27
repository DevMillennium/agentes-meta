import OpenAI from "openai";
import { env } from "../../config/env";
import { logger } from "../../common/logger";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key || key.includes("placeholder")) {
    return null;
  }
  if (!client) {
    client = new OpenAI({ apiKey: key });
  }
  return client;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function generateChatCompletion(
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<string> {
  const openai = getClient();
  if (!openai) {
    return fallbackFromMessages(messages);
  }

  try {
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages,
        max_tokens: options?.maxTokens ?? 500,
        temperature: options?.temperature ?? 0.7
      },
      { timeout: 20_000 }
    );
    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      return fallbackFromMessages(messages);
    }
    return text;
  } catch (error) {
    logger.warn({ error }, "OpenAI indisponível; usando fallback.");
    return fallbackFromMessages(messages);
  }
}

function fallbackFromMessages(messages: ChatMessage[]): string {
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

export async function generateJsonCompletion<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T | null> {
  const openai = getClient();
  if (!openai) return null;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 800,
      temperature: 0.5
    });
    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn({ error }, "OpenAI JSON falhou.");
    return null;
  }
}
