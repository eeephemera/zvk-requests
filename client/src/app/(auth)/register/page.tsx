"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, SubmitHandler } from "react-hook-form";

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
            password: data.password 
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

      const responseData = await res.json();
      console.log("Registered:", responseData);
      setSuccess("Регистрация прошла успешно. Перенаправление на страницу входа...");
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: unknown) {
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
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--discord-bg)' }}>
      <div className="discord-card w-full max-w-md p-6 animate-fadeIn">
        <h1 className="text-2xl font-bold text-discord-text flex items-center mb-6">
          <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
          Регистрация
        </h1>
        
        {/* Сообщения */}
        {(error || success) && (
          <div className="mb-5 text-center animate-fadeIn">
            {error && (
              <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30">
                <p className="text-discord-danger">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 bg-discord-success bg-opacity-20 rounded-lg border border-discord-success border-opacity-30">
                <p className="text-discord-success">{success}</p>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="animate-slideUp delay-100">
            <label htmlFor="login" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
              Логин <span className="text-discord-danger">*</span>
            </label>
            <input
              id="login"
              type="text"
              placeholder="Введите логин"
              className={`discord-input w-full ${errors.login ? 'border-discord-danger' : ''}`}
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

          <div className="animate-slideUp delay-200">
            <label htmlFor="password" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
              Пароль <span className="text-discord-danger">*</span>
            </label>
            <input
              id="password"
              type="password"
              placeholder="Введите пароль"
              className={`discord-input w-full ${errors.password ? 'border-discord-danger' : ''}`}
              {...register("password", { 
                required: "Пароль обязателен", 
                minLength: {
                  value: 6,
                  message: "Пароль должен содержать минимум 6 символов"
                }
              })}
            />
            {errors.password && <p className="text-discord-danger text-xs mt-1">{errors.password.message}</p>}
          </div>

          <div className="animate-slideUp delay-300">
            <label htmlFor="confirmPassword" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
              Подтверждение пароля <span className="text-discord-danger">*</span>
            </label>
            <input
              id="confirmPassword"
              type="password"
              placeholder="Повторите пароль"
              className={`discord-input w-full ${errors.confirmPassword ? 'border-discord-danger' : ''}`}
              {...register("confirmPassword", { 
                required: "Подтверждение пароля обязательно",
                validate: value => value === password || "Пароли не совпадают"
              })}
            />
            {errors.confirmPassword && <p className="text-discord-danger text-xs mt-1">{errors.confirmPassword.message}</p>}
          </div>

          {/* Индикатор загрузки */}
          {isLoading && (
            <div className="w-full bg-discord-dark rounded-full h-2 overflow-hidden animate-fadeIn">
              <div className="h-full bg-discord-accent rounded-full animate-pulse" style={{ width: '100%' }}></div>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className={`discord-btn-primary w-full py-3 ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <span className="opacity-0">Зарегистрироваться</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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

        <p className="mt-5 text-center text-discord-text-muted">
          Уже зарегистрированы?{" "}
          <Link href="/login" className="text-discord-accent hover:underline">
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
