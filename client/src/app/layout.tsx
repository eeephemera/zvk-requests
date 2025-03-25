import { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "ZVK Requests",
  description: "Управление заявками",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-gray-900">
        <div className="flex flex-col min-h-screen">
          <main className="flex-grow relative">{children}</main>
        </div>
      </body>
    </html>
  );
}