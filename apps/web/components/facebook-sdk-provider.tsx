"use client";

import Script from "next/script";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { META_API_VERSION, META_APP_ID, META_LOGIN_SCOPES } from "../lib/meta-config";
import type { FacebookLoginStatusResponse, FacebookSDK } from "../types/facebook-sdk";

type SdkState = "loading" | "ready" | "error";

interface FacebookSdkContextValue {
  sdkState: SdkState;
  isReady: boolean;
  getLoginStatus: () => Promise<FacebookLoginStatusResponse>;
  login: () => Promise<FacebookLoginStatusResponse>;
  logout: () => Promise<void>;
}

const FacebookSdkContext = createContext<FacebookSdkContextValue | null>(null);

function getFb(): FacebookSDK {
  if (!window.FB) {
    throw new Error("SDK do Facebook ainda não carregou.");
  }
  return window.FB;
}

function promisifyStatus(fn: (cb: (r: FacebookLoginStatusResponse) => void) => void): Promise<FacebookLoginStatusResponse> {
  return new Promise((resolve, reject) => {
    try {
      fn((response) => resolve(response));
    } catch (error) {
      reject(error);
    }
  });
}

export function FacebookSdkProvider({ children }: { children: ReactNode }) {
  const [sdkState, setSdkState] = useState<SdkState>("loading");

  useEffect(() => {
    if (!META_APP_ID) {
      setSdkState("error");
      return;
    }

    window.fbAsyncInit = function fbAsyncInit() {
      getFb().init({
        appId: META_APP_ID,
        cookie: true,
        xfbml: true,
        version: META_API_VERSION
      });
      getFb().AppEvents.logPageView();
      setSdkState("ready");
    };

    if (window.FB) {
      window.fbAsyncInit();
    }
  }, []);

  const getLoginStatus = useCallback(async () => {
    return promisifyStatus((cb) => getFb().getLoginStatus(cb));
  }, []);

  const login = useCallback(async () => {
    return new Promise<FacebookLoginStatusResponse>((resolve, reject) => {
      try {
        getFb().login(
          (response) => {
            if (response.status === "connected" && response.authResponse?.accessToken) {
              resolve({
                status: "connected",
                authResponse: response.authResponse
              });
              return;
            }
            resolve({
              status: response.status ?? "unknown",
              authResponse: response.authResponse
            });
          },
          { scope: META_LOGIN_SCOPES, auth_type: "rerequest" }
        );
      } catch (error) {
        reject(error);
      }
    });
  }, []);

  const logout = useCallback(async () => {
    return new Promise<void>((resolve) => {
      getFb().logout(() => resolve());
    });
  }, []);

  const value: FacebookSdkContextValue = {
    sdkState,
    isReady: sdkState === "ready",
    getLoginStatus,
    login,
    logout
  };

  return (
    <FacebookSdkContext.Provider value={value}>
      <Script
        id="facebook-jssdk"
        strategy="afterInteractive"
        src="https://connect.facebook.net/pt_BR/sdk.js"
        onLoad={() => {
          if (window.FB && window.fbAsyncInit) {
            window.fbAsyncInit();
          }
        }}
        onError={() => setSdkState("error")}
      />
      {children}
    </FacebookSdkContext.Provider>
  );
}

export function useFacebookSdk(): FacebookSdkContextValue {
  const ctx = useContext(FacebookSdkContext);
  if (!ctx) {
    throw new Error("useFacebookSdk deve ser usado dentro de FacebookSdkProvider.");
  }
  return ctx;
}
