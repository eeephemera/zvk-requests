"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getHomepageForRole } from "@/utils/navigation";

export default function AccessDenied() {
  const { userRole } = useAuth();
  const homePage = getHomepageForRole(userRole);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--discord-bg)' }}>
      <div className="discord-card w-full max-w-lg p-8 animate-fadeIn">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-discord-danger bg-opacity-20 rounded-full flex items-center justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-discord-danger">
              <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
            </svg>
          </div>
          
          <h1 className="text-3xl font-bold text-discord-text mb-4">Доступ запрещен</h1>
          
          <p className="text-discord-text-secondary mb-6">
            У вас нет доступа к этой странице. Для доступа требуются соответствующие права.
          </p>
          
          <Link href={homePage} className="discord-btn-primary px-6 py-3">
            Вернуться на главную страницу
          </Link>
        </div>
      </div>
    </div>
  );
} 