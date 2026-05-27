import { AsyncLocalStorage } from "node:async_hooks";
import type { MetaAssetsConfig } from "../config/meta-assets.store";

export interface RequestContextStore {
  userId: string;
  metaAccessToken?: string;
  metaAssets?: MetaAssetsConfig;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestUserId(): string | undefined {
  return requestContext.getStore()?.userId;
}

export function getRequestMetaAssets(): MetaAssetsConfig | undefined {
  return requestContext.getStore()?.metaAssets;
}

export function runWithUserContext<T>(
  userId: string,
  meta: { metaAccessToken?: string; metaAssets?: MetaAssetsConfig },
  fn: () => T
): T {
  return requestContext.run({ userId, ...meta }, fn);
}
