"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getStoredAuthToken, getApiKey } from "../lib/auth-client";

const PUBLIC_PATHS = ["/login"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
    if (isPublic) {
      setReady(true);
      return;
    }

    const hasAuth = Boolean(getStoredAuthToken() || getApiKey());
    if (!hasAuth) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <main className="content auth-guard-loading">
        <p className="muted">Carregando sessão…</p>
      </main>
    );
  }

  return <>{children}</>;
}
