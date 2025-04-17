"use client"; // Этот компонент использует хуки, поэтому он клиентский

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link'; // Для логотипа/ссылки на главную

export default function Header() {
  // Получаем состояние аутентификации и функцию logout из контекста
  const { isAuthenticated, logout, userRole, userId } = useAuth();
  const router = useRouter();

  // Функция обработки нажатия кнопки "Выйти"
  const handleLogout = async () => {
    await logout(); // Вызываем функцию logout из контекста
    // После выхода перенаправляем пользователя на страницу входа
    router.push('/login');
  };

  // Определяем текст роли для отображения
  const roleText = () => {
     if (userRole === 1 || userRole === 'Пользователь') return 'Пользователь';
     if (userRole === 2 || userRole === 'Менеджер') return 'Менеджер';
     return 'Неизвестно';
  };

  // Отображаем шапку только если пользователь аутентифицирован
  if (!isAuthenticated) {
    return null; // Не показываем шапку на страницах входа/регистрации
  }

  return (
    <header className="bg-discord-card shadow-md w-full">
      <nav className="container mx-auto px-6 py-3 flex justify-between items-center">
        {/* Логотип или название */}
        <Link href="/" className="text-xl font-bold text-discord-text hover:text-discord-accent transition-colors">
          ЗВК-Заявки
        </Link>

        {/* Информация о пользователе и кнопка выхода */}
        <div className="flex items-center space-x-4">
           <span className="text-discord-text-secondary text-sm hidden sm:inline">
             ID: {userId ?? 'N/A'} | Роль: {roleText()}
           </span>
           <button
             onClick={handleLogout}
             className="bg-discord-button-danger hover:bg-opacity-80 text-white text-sm font-medium px-4 py-2 rounded-md transition duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-discord-card focus:ring-discord-danger"
           >
             Выйти
           </button>
        </div>
      </nav>
    </header>
  );
} 