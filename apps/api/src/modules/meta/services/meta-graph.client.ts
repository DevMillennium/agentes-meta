import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { getMetaAccessToken } from "../../../config/env";
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

function extractErrorMessage(payload: MetaGraphErrorPayload | undefined, status: number): string {
  return payload?.error?.message ?? payload?.message ?? `Graph API retornou HTTP ${status}`;
}

async function requestMetaGraph<T>(
  config: AxiosRequestConfig,
  requireToken = true
): Promise<T> {
  const token = getMetaAccessToken();
  if (requireToken && !token) {
    throw new MetaGraphRequestError("META_ACCESS_TOKEN não configurado. Use /api/meta/oauth/login.");
  }

  const attempts = Math.max(1, (Number(process.env.META_HTTP_RETRIES) || 2) + 1);
  let lastError: unknown;
  const timeout = Number(process.env.META_HTTP_TIMEOUT_MS) || 15000;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        ...(config.headers as Record<string, string> | undefined)
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.request<T>({
        ...config,
        headers,
        timeout,
        validateStatus: () => true
      });

      if (response.status >= 200 && response.status < 300) {
        return response.data;
      }

      const payload = response.data as MetaGraphErrorPayload | undefined;
      const msg = extractErrorMessage(payload, response.status);

      if (!isRetryableStatus(response.status) || attempt === attempts) {
        throw new MetaGraphRequestError(msg, response.status, payload);
      }

      logger.warn(
        { url: config.url, status: response.status, attempt, attempts },
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

      logger.warn({ url: config.url, status, attempt, attempts }, "Meta Graph: erro de rede, tentando novamente.");
    }

    await sleep(400 * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Falha desconhecida ao chamar Graph API");
}

export async function getMetaGraphJson<T = unknown>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  return requestMetaGraph<T>({ method: "GET", url, params });
}

export async function postMetaGraphJson<T = unknown>(url: string, body: unknown): Promise<T> {
  return requestMetaGraph<T>({
    method: "POST",
    url,
    data: body,
    headers: { "Content-Type": "application/json" }
  });
}

/** Chamadas OAuth / debug sem Bearer do usuário. */
export async function getMetaGraphPublicJson<T = unknown>(
  url: string,
  params?: Record<string, string | number | boolean | undefined>
): Promise<T> {
  return requestMetaGraph<T>({ method: "GET", url, params }, false);
}
