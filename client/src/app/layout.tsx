import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

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
      <body className="bg-gray-900">
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <main className="flex-grow relative">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}