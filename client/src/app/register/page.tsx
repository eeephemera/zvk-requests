"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Пользователь");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      // Формируем запрос к API, используя переменную окружения
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password, role }),
        }
      );
      
      if (!res.ok) {
        const data = await res.text();
        throw new Error(data || "Ошибка регистрации");
      }

      const data = await res.json();
      console.log("Registered:", data);
      setSuccess("Регистрация прошла успешно. Теперь вы можете войти.");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Что-то пошло не так");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-6">Регистрация</h1>
      <form onSubmit={handleRegister} className="flex flex-col gap-4 w-full max-w-sm">
        {error && <p className="text-red-500">{error}</p>}
        {success && <p className="text-green-500">{success}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="Пользователь">Пользователь</option>
          <option value="Менеджер">Менеджер</option>
        </select>
        <button type="submit" className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition-colors">
          Зарегистрироваться
        </button>
      </form>
      <p className="mt-4">
        Уже зарегистрированы?{" "}
        <Link href="/login" className="text-blue-500 hover:underline">
          Войти
        </Link>
      </p>
    </div>
  );
}
