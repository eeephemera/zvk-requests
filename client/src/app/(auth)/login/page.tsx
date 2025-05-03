"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm, SubmitHandler } from "react-hook-form";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getHomepageForRole } from "@/utils/navigation";
import { AuthResponse } from "@/context/AuthContext"; // Импортируем тип пользователя из контекста

// Ключ для отслеживания попыток входа
const LOGIN_ATTEMPTS_KEY = 'zvk_login_attempts';
// Максимальное количество попыток автоматического редиректа
const MAX_AUTO_REDIRECTS = 2;

type FormInputs = {
  login: string;
  password: string;
};

// Определяем структуру ответа для LoginUser, которая включает данные пользователя
// (согласовываем с бекендом)
type LoginApiResponse = {
  message: string;
  user: AuthResponse; // Используем тип из AuthContext
};

const getFriendlyErrorMessage = (error: string, status?: number): string => {
  if (status === 401) return "Неверный логин или пароль";
  if (error.includes("Invalid credentials")) return "Неверный логин или пароль";
  if (error.includes("Invalid request body")) return "Неверно сформирован запрос";
  if (error.includes("Network Error")) return "Проблема с сетью. Проверьте подключение.";
  return "Что-то пошло не так. Пожалуйста, попробуйте ещё раз.";
};

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormInputs>();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [skipRedirect, setSkipRedirect] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Получаем функцию updateAuthState из контекста
  const { isAuthenticated, userRole, updateAuthState } = useAuth(); 
  
  // Проверка и инкремент счетчика попыток редиректа
  const shouldSkipRedirect = (): boolean => {
    if (typeof window === 'undefined') return false;
    
    try {
      const attemptsData = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
      const attempts = attemptsData ? JSON.parse(attemptsData) : { count: 0, timestamp: Date.now() };
      
      // Сбрасываем счетчик, если прошло более 10 секунд с последней попытки
      if (Date.now() - attempts.timestamp > 10000) {
        localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify({ count: 1, timestamp: Date.now() }));
        return false;
      }
      
      // Если превышено максимальное количество попыток, пропускаем редирект
      if (attempts.count >= MAX_AUTO_REDIRECTS) {
        return true;
      }
      
      // Инкрементируем счетчик попыток
      localStorage.setItem(LOGIN_ATTEMPTS_KEY, 
        JSON.stringify({ count: attempts.count + 1, timestamp: Date.now() }));
      
      return false;
    } catch (error) {
      return false;
    }
  };
  
  // Проверяем наличие бесконечного цикла редиректов при монтировании
  useEffect(() => {
    setSkipRedirect(shouldSkipRedirect());
  }, []);

  const onSubmit: SubmitHandler<FormInputs> = async (data) => {
    setError("");
    setIsLoading(true);
    console.log("Attempting login...");

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ login: data.login, password: data.password }),
      });

      if (!res.ok) {
        const responseText = await res.text();
        let message = responseText || "Ошибка входа";
        try {
          const errorData = JSON.parse(responseText);
          message = errorData.error || errorData.message || "Ошибка входа";
        } catch {}
        throw new Error(message, { cause: res.status });
      }

      // Получаем данные пользователя напрямую из ответа
      const responseData: LoginApiResponse = await res.json(); 
      // ----- DEBUG LOG ----- 
      console.log("Raw response from /api/login:", JSON.stringify(responseData, null, 2)); 
      // ----- END DEBUG LOG ----- 
      console.log("Login successful, received user data:", responseData.user);
      
      // Обновляем состояние авторизации в контексте
      updateAuthState(responseData.user);
      
      // Получаем путь для редиректа из URL
      const fromPath = searchParams.get('from');
      console.log("Redirect path from URL:", fromPath);
      
      // Используем отдельную функцию для определения домашней страницы на основе роли
      const defaultPath = getHomepageForRole(responseData.user.role);
      console.log("Default path based on role:", defaultPath);
      
      // Определяем конечный путь редиректа
      let returnTo = fromPath || defaultPath;
      
      // Корректируем неверные пути
      if (returnTo === "/requests") {
        returnTo = "/my-requests";
      }
      
      console.log("Final redirect path:", returnTo);

      // Используем replace вместо push для избежания истории навигации
      router.replace(returnTo);

    } catch (err: unknown) {
      console.error("Login error:", err);
      if (err instanceof Error) {
        setError(getFriendlyErrorMessage(err.message, (err.cause as number) || undefined));
      } else {
        setError("Неизвестная ошибка");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Если мы обнаружили, что находимся в бесконечном цикле редиректов,
  // показываем ссылки для ручной навигации вместо автоматического редиректа
  if (skipRedirect && isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-discord-card rounded-lg shadow-lg w-full max-w-md p-6">
          <h1 className="text-2xl font-bold text-discord-text mb-6">
            Обнаружен цикл перенаправлений
          </h1>
          <p className="text-discord-text-muted mb-4">
            Система предотвратила бесконечное перенаправление. Перейдите на нужную страницу вручную:
          </p>
          <div className="space-y-4">
            <a href="/my-requests" className="block w-full py-2 text-center bg-discord-button-primary text-white rounded-md hover:bg-opacity-80">
              Страница запросов
            </a>
            <a href="/manager" className="block w-full py-2 text-center bg-discord-accent text-white rounded-md hover:bg-opacity-80">
              Панель менеджера
            </a>
            <a href="/" className="block w-full py-2 text-center bg-discord-border text-discord-text rounded-md hover:bg-opacity-80">
              Главная страница
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute isPublicPage={true}>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-discord-card rounded-lg shadow-lg w-full max-w-md p-6">
          <h1 className="text-2xl font-bold text-discord-text flex items-center mb-6">
            <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
            Вход в систему
          </h1>
          
          {error && (
            <div className="mb-5 text-center">
              <div className="p-3 bg-discord-danger/10 rounded-lg border border-discord-danger/30">
                <p className="text-discord-danger text-sm">{error}</p>
              </div>
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
                className={`block w-full px-4 py-2 rounded-md bg-discord-input border border-discord-border focus:outline-none focus:ring-2 focus:ring-discord-accent focus:border-transparent transition duration-150 ${errors.login ? 'border-discord-danger' : 'border-discord-border'}`}
                {...register("login", { 
                  required: "Логин обязателен", 
                  minLength: {
                    value: 3,
                    message: "Логин должен содержать минимум 3 символа"
                  }
                })}
                autoFocus
              />
              {errors.login && <p className="text-discord-danger text-xs mt-1">{errors.login.message}</p>}
            </div>

            <div className="relative">
              <label htmlFor="password" className="block text-discord-text-secondary text-sm mb-1.5 font-medium">
                Пароль <span className="text-discord-danger">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Введите пароль"
                  className={`block w-full px-4 py-2 rounded-md bg-discord-input border pr-20 focus:outline-none focus:ring-2 focus:ring-discord-accent focus:border-transparent transition duration-150 ${errors.password ? 'border-discord-danger' : 'border-discord-border'}`}
                  {...register("password", { required: "Пароль обязателен" })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-discord-text-muted hover:text-discord-text transition-colors text-sm"
                >
                  {showPassword ? "Скрыть" : "Показать"}
                </button>
              </div>
              {errors.password && <p className="text-discord-danger text-xs mt-1">{errors.password.message}</p>}
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
                  <span className="opacity-0">Войти</span>
                  <span className="absolute inset-0 flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-white mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Вход...</span>
                  </span>
                </>
              ) : (
                "Войти"
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-discord-text-muted text-sm">
            Нет аккаунта?{" "}
            <Link href="/register" className="text-discord-accent hover:underline">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </ProtectedRoute>
  );
}