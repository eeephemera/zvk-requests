"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const getFriendlyErrorMessage = (error: string): string => {
  if (error.includes("Invalid email format")) return "Неверный формат email";
  if (error.includes("Registration failed")) return "Ошибка регистрации. Проверьте введённые данные.";
  if (error.includes("Invalid request body")) return "Неверно сформирован запрос";
  return "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.";
};

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        }
      );

      if (!res.ok) {
        const responseText = await res.text();
        let message = responseText || "Ошибка регистрации";
        try {
          const data = JSON.parse(responseText);
          message = data.error || data.message || "Ошибка регистрации";
        } catch {
          // Если распарсить не удалось, оставляем текстовое сообщение
        }
        throw new Error(message);
      }

      const data = await res.json();
      console.log("Registered:", data);
      setSuccess("Регистрация прошла успешно. Теперь вы можете войти.");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(getFriendlyErrorMessage(err.message));
      } else {
        setError("Неизвестная ошибка");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">Регистрация</h1>
        <form onSubmit={handleRegister} className="space-y-4">
          {error && <p className="text-red-400 text-center">{error}</p>}
          {success && <p className="text-green-400 text-center">{success}</p>}
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
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-gray-300 mb-1">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              placeholder="Введите пароль"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold transition-colors"
          >
            Зарегистрироваться
          </button>
        </form>
        <p className="mt-4 text-center">
          Уже зарегистрированы?{" "}
          <Link href="/login" className="text-blue-400 hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
