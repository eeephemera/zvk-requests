"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Request {
  id: number;
  user_id: number;
  inn: string;
  organization_name: string;
  implementation_date: string;
  fz_type: string;
  registry_type: string;
  comment: string;
  tz_file: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Equipment {
  article: string;
  name: string;
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: Request;
  onDelete: (id: number) => void;
  onStatusUpdate: (id: number, newStatus: RequestStatus) => void;
}

// Определяем тип для статуса заявки
type RequestStatus = "На рассмотрении" | "В работе" | "Выполнена" | "Отклонена";

const Modal = ({ isOpen, onClose, request, onDelete, onStatusUpdate }: ModalProps) => {
  const [error] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [status, setStatus] = useState(request.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = 'auto';
      };
    }
  }, [isOpen, onClose]);

  const equipmentList: Equipment[] = [
    { article: "ART-001", name: "Сервер Dell PowerEdge R740" },
    { article: "ART-002", name: "Коммутатор Cisco Catalyst 9300" },
    { article: "ART-003", name: "ИБП APC Smart-UPS 3000" },
  ];

  const handleDeleteClick = () => {
    setShowConfirmation(true);
  };

  const confirmDelete = () => {
    if (isDeleting) return;
    setIsDeleting(true);
    onDelete(request.id);
  };

  const updateStatus = async (newStatus: RequestStatus) => {
    setIsUpdating(true);
    setStatusError(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд таймаут
    
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests/${request.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === newStatus) {
          setStatus(newStatus);
          onStatusUpdate(request.id, newStatus);
        } else {
          setStatusError("Статус не был обновлен на сервере");
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setStatusError(errorData.error || "Не удалось обновить статус");
      }
    } catch (error: unknown) { // Явно указываем тип error как unknown
      if (error instanceof Error && error.name === 'AbortError') {
        setStatusError("Время ожидания истекло. Попробуйте позже.");
      } else {
        setStatusError("Не удалось обновить статус");
        console.error('Ошибка обновления статуса:', error);
      }
    } finally {
      setIsUpdating(false);
      clearTimeout(timeoutId);
    }
  };

  // Добавим компонент для анимированных точек
  const LoadingDots = () => {
    const [dots, setDots] = useState('');
    
    useEffect(() => {
      const interval = setInterval(() => {
        setDots(prev => prev.length >= 3 ? '' : prev + '.');
      }, 400);
      
      return () => clearInterval(interval);
    }, []);
    
    return <span className="text-blue-300 inline-block min-w-[30px]">Обновление{dots}</span>;
  };

  if (!isOpen) return null;

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className={`fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-enter`}
      onClick={handleOutsideClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="bg-gray-800 text-gray-200 p-4 sm:p-6 rounded-xl shadow-lg w-full max-h-[90vh] overflow-y-auto md:max-w-lg">
        <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-800 pt-1 z-10">
          <h2 id="modal-title" className="text-xl sm:text-2xl font-bold text-white">Заявка #{request.id}</h2>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-white text-xl p-2"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        {error && <p className="text-red-400 mb-4">{error}</p>}

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <p>
              <strong className="text-gray-300">ИНН:</strong> {request.inn}
            </p>
            <p>
              <strong className="text-gray-300">Организация:</strong>{" "}
              {request.organization_name}
            </p>
            <p>
              <strong className="text-gray-300">Дата реализации:</strong>{" "}
              {new Date(request.implementation_date).toLocaleDateString("ru-RU")}
            </p>
            <p>
              <strong className="text-gray-300">Тип ФЗ:</strong> {request.fz_type}
            </p>
            <p>
              <strong className="text-gray-300">Тип реестра:</strong>{" "}
              {request.registry_type}
            </p>
            <p className="sm:col-span-2">
              <strong className="text-gray-300">Комментарий:</strong>{" "}
              {request.comment || "Отсутствует"}
            </p>
            <p>
              <strong className="text-gray-300">Создано:</strong>{" "}
              {new Date(request.created_at).toLocaleString("ru-RU")}
            </p>
            <p>
              <strong className="text-gray-300">Обновлено:</strong>{" "}
              {new Date(request.updated_at).toLocaleString("ru-RU")}
            </p>
            {request.tz_file && (
              <p className="sm:col-span-2">
                <strong className="text-gray-300">ТЗ:</strong>{" "}
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests/${request.id}/tz_file`}
                  className="text-blue-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Скачать
                </a>
              </p>
            )}
          </div>

          <div className="mt-4">
            <p className="text-gray-300 mb-1">Изменить статус:</p>
            <div className="flex flex-wrap gap-2">
              {isUpdating ? (
                <LoadingDots />
              ) : (
                ['На рассмотрении', 'В работе', 'Выполнена', 'Отклонена'].map((s) => (
                  <button
                    key={s}
                    onClick={() => updateStatus(s as RequestStatus)}
                    className={`px-3 py-1 rounded text-sm ${
                      status === s ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                    disabled={isUpdating}
                  >
                    {s}
                  </button>
                ))
              )}
            </div>
          </div>
          {statusError && <p className="text-red-400 text-sm mt-1">{statusError}</p>}

          <div className="mt-4 overflow-x-auto">
            <h3 className="text-lg font-semibold text-white mb-2">
              Запрашиваемое оборудование
            </h3>
            {equipmentList.length === 0 ? (
              <p className="text-gray-400">Оборудование не указано.</p>
            ) : (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full bg-gray-700 rounded-lg">
                  <thead>
                    <tr className="bg-gray-600 text-gray-300">
                      <th className="py-2 px-4 text-left font-semibold">Артикул</th>
                      <th className="py-2 px-4 text-left font-semibold">Название</th>
                    </tr>
                  </thead>
                  <tbody>
                    {equipmentList.map((item, index) => (
                      <tr
                        key={index}
                        className={`border-b border-gray-600 ${
                          index % 2 === 0 ? "bg-gray-700" : "bg-gray-650"
                        }`}
                      >
                        <td className="py-2 px-4">{item.article}</td>
                        <td className="py-2 px-4">{item.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {showConfirmation ? (
            <div className="mt-4 p-3 bg-red-900 bg-opacity-50 rounded border border-red-700">
              <p className="text-white mb-2">Вы уверены, что хотите удалить эту заявку?</p>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded"
                >
                  Да, удалить
                </button>
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded transition-colors duration-200"
            >
              Удалить заявку
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;