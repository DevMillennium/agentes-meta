export interface FacebookAuthResponse {
  accessToken?: string;
  expiresIn?: number;
  signedRequest?: string;
  userID?: string;
}

export interface FacebookLoginStatusResponse {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: FacebookAuthResponse;
}

export interface FacebookLoginResponse {
  status?: "connected" | "not_authorized" | "unknown";
  authResponse?: FacebookAuthResponse;
}

export interface FacebookSDK {
  init(params: {
    appId: string;
    cookie?: boolean;
    xfbml?: boolean;
    version: string;
  }): void;
  AppEvents: { logPageView(): void };
  getLoginStatus(callback: (response: FacebookLoginStatusResponse) => void): void;
  login(
    callback: (response: FacebookLoginResponse) => void,
    options?: { scope?: string; auth_type?: string }
  ): void;
  logout(callback?: () => void): void;
}

declare global {
  interface Window {
    FB?: FacebookSDK;
    fbAsyncInit?: () => void;
  }
}

export {};
