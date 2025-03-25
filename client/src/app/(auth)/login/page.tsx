"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const getFriendlyErrorMessage = (error: string, status?: number): string => {
  if (status === 401) return "Неверный email или пароль";
  if (error.includes("Invalid credentials")) return "Неверный логин или пароль";
  if (error.includes("Invalid email format")) return "Неверный формат email";
  if (error.includes("Invalid request body")) return "Неверно сформирован запрос";
  if (error.includes("Network Error")) return "Проблема с сетью. Проверьте подключение.";
  return "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.";
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setIsLoading(true);

      try {
        const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const responseText = await res.text();
          let message = responseText || "Ошибка входа";
          try {
            const data = JSON.parse(responseText);
            message = data.error || data.message || "Ошибка входа";
          } catch {
            // Если не JSON
          }
          throw new Error(message, { cause: res.status });
        }

        const data = await res.json();

        if (data.role === "Менеджер") {
          router.push("/manager");
        } else if (data.role) {
          router.push("/requests");
        } else {
          setError("Роль пользователя не определена. Обратитесь в поддержку.");
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(getFriendlyErrorMessage(err.message, (err.cause as number) || undefined));
        } else {
          setError("Неизвестная ошибка");
        }
        console.error("Ошибка входа:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [email, password, router]
  );

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Вход в систему</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          {error && <p className="text-red-400 text-center">{error}</p>}
          <div>
            <label htmlFor="email" className="block text-gray-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="Введите email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
              aria-required="true"
            />
          </div>
          <div className="relative">
            <label htmlFor="password" className="block text-gray-300 mb-1">
              Пароль
            </label>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              aria-required="true"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-10 text-gray-400"
            >
              {showPassword ? "Скрыть" : "Показать"}
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 ${isLoading ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700"} rounded text-white font-semibold transition-colors`}
          >
            {isLoading ? "Загрузка..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}