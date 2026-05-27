import axios, { type AxiosError } from "axios";
import { env } from "../../../config/env";
import { logger } from "../../../common/logger";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number | undefined): boolean {
  if (status === undefined) return true;
  if (status === 429) return true;
  if (status >= 500) return true;
  return false;
}

export interface MetaGraphErrorPayload {
  message?: string;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export class MetaGraphRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly payload?: MetaGraphErrorPayload
  ) {
    super(message);
    this.name = "MetaGraphRequestError";
  }
}

export async function postMetaGraphJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const token = env.META_ACCESS_TOKEN;
  if (!token) {
    throw new MetaGraphRequestError("META_ACCESS_TOKEN não configurado.");
  }

  const attempts = Math.max(1, env.META_HTTP_RETRIES + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await axios.post<T>(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        timeout: env.META_HTTP_TIMEOUT_MS,
        validateStatus: () => true
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      const payload = response.data as MetaGraphErrorPayload | undefined;
      const msg =
        payload?.error?.message ??
        payload?.message ??
        `Graph API retornou HTTP ${response.status}`;

      if (!isRetryableStatus(response.status) || attempt === attempts) {
        throw new MetaGraphRequestError(msg, response.status, payload);
      }

      logger.warn(
        { url, status: response.status, attempt, attempts },
        "Meta Graph: resposta não bem-sucedida, tentando novamente."
      );
    } catch (error) {
      lastError = error;
      if (error instanceof MetaGraphRequestError) {
        throw error;
      }

      const ax = error as AxiosError;
      const status = ax.response?.status;
      if (!isRetryableStatus(status) || attempt === attempts) {
        const payload = ax.response?.data as MetaGraphErrorPayload | undefined;
        throw new MetaGraphRequestError(
          ax.message || "Falha de rede ao chamar Graph API",
          status,
          payload
        );
      }

      logger.warn({ url, status, attempt, attempts }, "Meta Graph: erro de rede, tentando novamente.");
    }

    await sleep(400 * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Falha desconhecida ao chamar Graph API");
}
