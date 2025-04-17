import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  title: "ЗВК-Заявки",
  description: "Система работы с заявками ЗВК",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="bg-discord-background text-discord-text">
        <Providers>
          <AuthProvider>
            <div className="flex flex-col min-h-screen">
              <main className="flex-grow relative">{children}</main>
            </div>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}