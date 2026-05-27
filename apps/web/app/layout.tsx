import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Phoenix Global Marketing AI Team",
  description: "Dashboard inicial da operacao multiagente de marketing."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
