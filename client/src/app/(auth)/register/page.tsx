"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, SubmitHandler } from "react-hook-form";
import ProtectedRoute from "@/components/ProtectedRoute";

type FormInputs = {
  login: string;
  password: string;
  confirmPassword: string;
};

const getFriendlyErrorMessage = (error: string): string => {
  if (error.includes("Invalid request body")) return "Неверно сформирован запрос";
  if (error.includes("duplicate key")) return "Пользователь с таким логином уже существует";
  if (error.includes("Registration failed")) return "Ошибка регистрации. Проверьте введённые данные.";
  return "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.";
};

export default function RegisterPage() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormInputs>();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const password = watch("password");

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    if (data.password !== data.confirmPassword) {
      setError("Пароли не совпадают");
      return;
    }

    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            login: data.login,
            password: data.password,
            password_confirmation: data.confirmPassword,
          }),
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

      setSuccess("Регистрация прошла успешно. Перенаправление на страницу входа...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
      console.error("Ошибка регистрации:", err);
      if (err instanceof Error) {
        setError(getFriendlyErrorMessage(err.message));
      } else {
        setError("Неизвестная ошибка");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute isPublicPage={true}>
      <div className="min-h-screen flex items-center justify-center p-6 bg-discord-background">
        <div className="bg-discord-card rounded-lg shadow-lg w-full max-w-md p-6">
          <h1 className="text-2xl font-bold text-discord-text flex items-center mb-6">
            <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
            Регистрация
          </h1>
          
          {(error || success) && (
            <div className="mb-5 text-center">
              {error && (
                <div className="p-3 bg-discord-danger/10 rounded-lg border border-discord-danger/30">
                  <p className="text-discord-danger text-sm">{error}</p>
                </div>
              )}
              {success && (
                <div className="p-3 bg-discord-success/10 rounded-lg border border-discord-success/30">
                  <p className="text-discord-success text-sm">{success}</p>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="login" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                Логин <span className="text-discord-danger">*</span>
              </label>
              <input
                id="login"
                type="text"
                placeholder="Введите логин"
                className={`block w-full px-4 py-2 rounded-md bg-discord-input border text-discord-text placeholder:text-discord-text-muted focus:outline-none focus:ring-2 focus:ring-discord-accent focus:border-transparent transition duration-150 ${errors.login ? 'border-discord-danger' : 'border-discord-border'}`}
                {...register("login", { 
                  required: "Логин обязателен", 
                  minLength: {
                    value: 3,
                    message: "Логин должен содержать минимум 3 символа"
                  }
                })}
              />
              {errors.login && <p className="text-discord-danger text-xs mt-1">{errors.login.message}</p>}
            </div>

            <div className="relative">
              <label htmlFor="password" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                Пароль <span className="text-discord-danger">*</span>
              </label>
              <input
                id="password"
                type="password"
                placeholder="Введите пароль"
                className={`block w-full px-4 py-2 rounded-md bg-discord-input border text-discord-text placeholder:text-discord-text-muted focus:outline-none focus:ring-2 focus:ring-discord-accent focus:border-transparent transition duration-150 ${errors.password ? 'border-discord-danger' : 'border-discord-border'}`}
                {...register("password", { 
                  required: "Пароль обязателен", 
                  minLength: {
                    value: 8,
                    message: "Пароль должен содержать минимум 8 символов"
                  },
                  pattern: {
                    value: /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])/,
                    message: "Пароль должен содержать минимум 1 заглавную букву, 1 цифру и 1 спецсимвол"
                  }
                })}
              />
              {errors.password && <p className="text-discord-danger text-xs mt-1">{errors.password.message}</p>}
              <p className="text-discord-text-muted text-xs mt-1">
                Требования: минимум 8 символов, 1 заглавная буква, 1 цифра и 1 спецсимвол (!@#$%^&*)
              </p>
            </div>

            <div className="relative">
              <label htmlFor="confirmPassword" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                Подтвердите пароль <span className="text-discord-danger">*</span>
              </label>
              <input
                id="confirmPassword"
                type="password"
                placeholder="Повторите пароль"
                className={`block w-full px-4 py-2 rounded-md bg-discord-input border text-discord-text placeholder:text-discord-text-muted focus:outline-none focus:ring-2 focus:ring-discord-accent focus:border-transparent transition duration-150 ${errors.confirmPassword ? 'border-discord-danger' : 'border-discord-border'}`}
                {...register("confirmPassword", { 
                  required: "Подтверждение пароля обязательно",
                  validate: value => value === password || "Пароли не совпадают"
                })}
              />
              {errors.confirmPassword && <p className="text-discord-danger text-xs mt-1">{errors.confirmPassword.message}</p>}
            </div>

            {isLoading && (
              <div className="w-full bg-discord-input rounded-full h-2 overflow-hidden">
                <div className="h-full bg-discord-accent rounded-full animate-pulse"></div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`relative w-full py-3 px-4 rounded-md text-white font-bold transition duration-150 ${isLoading ? 'bg-discord-button-primary/70 cursor-not-allowed' : 'bg-discord-button-primary hover:bg-opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-discord-card focus:ring-discord-accent'}`}
            >
              {isLoading ? (
                <>
                  <span className="opacity-0">Зарегистрироваться</span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Регистрация...</span>
                  </span>
                </>
              ) : (
                "Зарегистрироваться"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-discord-text-muted text-sm">
            Уже зарегистрированы?{" "}
            <Link href="/login" className="text-discord-accent hover:underline transition-colors duration-200">
              Войти
            </Link>
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}
