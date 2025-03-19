import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-8 animate-fadeIn">
      <h1 className="text-4xl font-bold mb-4 animate-slideUp">Добро пожаловать в ZVK Requests</h1>
      <p className="mb-8 text-center animate-slideUp delay-100">
        Управляйте своими заявками легко и просто. Пожалуйста, войдите или зарегистрируйтесь для доступа к функционалу.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 animate-slideUp delay-200">
        <div className="tooltip">
          <Link
            href="/login"
            className="px-6 py-3 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors duration-300 transform hover:scale-105"
          >
            Войти
          </Link>
        </div>
        <div className="tooltip">
          <Link
            href="/register"
            className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 transition-colors duration-300 transform hover:scale-105"
          >
            Регистрация
          </Link>
        </div>
      </div>
    </main>
  );
}