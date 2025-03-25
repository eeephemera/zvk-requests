"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Request } from "../services/requestService";

interface RequestDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: Request | null;
  downloadingFile: boolean;
  fileDownloadError: string | null;
  onDownloadFile: (requestId: number, e: React.MouseEvent) => void;
  formatDate: (dateString: string) => string;
  getStatusColor: (status: string) => string;
}

export default function RequestDetailsModal({
  isOpen,
  onClose,
  request,
  downloadingFile,
  fileDownloadError,
  onDownloadFile,
  formatDate,
  getStatusColor
}: RequestDetailsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Обработчик нажатия Esc
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  // Обработчик клика вне модального окна
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  }, [onClose]);

  // Устанавливаем и убираем обработчики событий
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.addEventListener("mousedown", handleOutsideClick);
      document.body.style.overflow = "hidden"; // Блокируем прокрутку страницы

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.removeEventListener("mousedown", handleOutsideClick);
        document.body.style.overflow = ""; // Разблокируем прокрутку
      };
    }
  }, [isOpen, handleKeyDown, handleOutsideClick]);

  // Если модальное окно закрыто или заявка не выбрана, не рендерим ничего
  if (!isOpen || !request) return null;

  // Используем портал для рендеринга модального окна в корне DOM-дерева
  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div 
        ref={modalRef}
        className="bg-gray-800 text-gray-200 p-6 rounded-xl shadow-lg max-w-lg w-full animate-fadeIn"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Заявка #{request.id}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl focus:outline-none focus:ring-2 focus:ring-gray-400 rounded"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <p>
            <strong className="text-gray-300">ИНН:</strong> {request.inn}
          </p>
          <p>
            <strong className="text-gray-300">Организация:</strong>{" "}
            {request.organization_name}
          </p>
          <p>
            <strong className="text-gray-300">Дата реализации:</strong>{" "}
            {formatDate(request.implementation_date)}
          </p>
          <p>
            <strong className="text-gray-300">Тип ФЗ:</strong> {request.fz_type}
          </p>
          <p>
            <strong className="text-gray-300">Тип реестра:</strong>{" "}
            {request.registry_type}
          </p>
          <p>
            <strong className="text-gray-300">Комментарий:</strong>{" "}
            {request.comment || "Отсутствует"}
          </p>
          <p>
            <strong className="text-gray-300">Статус:</strong>{" "}
            <span
              className={`px-2 py-1 rounded-full text-sm font-medium ${getStatusColor(
                request.status
              )}`}
            >
              {request.status}
            </span>
          </p>
          <p>
            <strong className="text-gray-300">Создано:</strong>{" "}
            {formatDate(request.created_at)}
          </p>
          <p>
            <strong className="text-gray-300">Обновлено:</strong>{" "}
            {formatDate(request.updated_at)}
          </p>
          {request.tz_file && (
            <div>
              <strong className="text-gray-300">ТЗ:</strong>{" "}
              <button
                onClick={(e) => onDownloadFile(request.id, e)}
                className={`text-blue-400 hover:underline ml-1 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded ${downloadingFile ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={downloadingFile}
              >
                {downloadingFile ? 'Скачивание...' : 'Скачать'}
              </button>
            </div>
          )}
          {fileDownloadError && (
            <div className="mt-2 text-red-400 text-sm">
              {fileDownloadError}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
} 