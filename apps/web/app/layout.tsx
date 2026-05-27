import type { Metadata } from "next";
import "./globals.css";
import { AuthGuard } from "../components/auth-guard";

export const metadata: Metadata = {
  title: "Phoenix Global Market Automat",
  description: "Dashboard da operacao multiagente de marketing Meta."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
