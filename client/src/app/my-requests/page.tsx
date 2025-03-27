"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserRequests, Request, getTotalRequestsCount } from "../../services/requestService";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequestDetailsModal from "@/components/RequestDetailsModal";

// Константа для количества элементов на странице
const ITEMS_PER_PAGE = 10;

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [hasMorePages, setHasMorePages] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  // Функция для получения общего количества заявок
  const fetchTotalCount = useCallback(async () => {
    try {
      const countResult = await getTotalRequestsCount();
      if (countResult.success && countResult.total !== undefined) {
        setTotalItems(countResult.total);
      } else {
        setTotalItems(0);
      }
    } catch (err) {
      console.error("Ошибка при получении общего количества заявок:", err);
    }
  }, []);

  // Функция для загрузки заявок с учетом пагинации
  const fetchRequests = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getUserRequests(page, ITEMS_PER_PAGE);
      if (result.success && result.requests) {
        setRequests(result.requests);
        if (page === 1) {
          await fetchTotalCount();
        }
        // Если получено меньше элементов, чем запрошено, значит достигнут конец списка
        if (result.requests.length < ITEMS_PER_PAGE) {
          setHasMorePages(false);
        } else {
          setHasMorePages(true);
        }
      } else {
        setError(result.error || "Не удалось загрузить заявки");
      }
    } catch (err) {
      console.error("Ошибка при загрузке заявок:", err);
      setError("Произошла ошибка при загрузке заявок");
    } finally {
      setLoading(false);
    }
  }, [fetchTotalCount]);

  // Загрузка заявок при монтировании и смене страницы
  useEffect(() => {
    fetchRequests(currentPage);
  }, [fetchRequests, currentPage]);

  // Функция для перехода между страницами
  const goToPage = (page: number) => {
    if (page >= 1 && page <= Math.ceil(totalItems / ITEMS_PER_PAGE)) {
      setCurrentPage(page);
    }
  };

  // Расчет общего числа страниц
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

  // Открытие модального окна с деталями заявки
  const openRequestDetails = (req: Request) => {
    setSelectedRequest(req);
  };

  // Закрытие модального окна
  const closeRequestDetails = () => {
    setSelectedRequest(null);
  };

  return (
    <ProtectedRoute allowedRoles={["Пользователь"]} redirectIfNotAllowed={true}>
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--discord-bg)' }}>
        <div className="discord-card w-full max-w-4xl p-6 animate-fadeIn">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-discord-text flex items-center">
              <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
              Мои заявки
            </h1>
            <Link 
              href="/requests" 
              className="discord-btn-primary"
            >
              Новая заявка
            </Link>
          </div>

          {error && (
            <div className="mb-5 text-center">
              <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30">
                <p className="text-discord-danger">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center p-10">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
              <p className="text-gray-400">Загрузка заявок...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-8 text-center">
              <p className="text-gray-400 mb-4">У вас пока нет заявок</p>
              <Link
                href="/requests"
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
              >
                Создать заявку
              </Link>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full bg-gray-800 rounded-xl overflow-hidden shadow-lg">
                  <thead>
                    <tr className="bg-gray-700 text-gray-300">
                      <th className="py-3 px-4 text-left font-semibold">ID</th>
                      <th className="py-3 px-4 text-left font-semibold">Организация</th>
                      <th className="py-3 px-4 text-left font-semibold">Дата реализации</th>
                      <th className="py-3 px-4 text-left font-semibold">Статус</th>
                      <th className="py-3 px-4 text-left font-semibold">Дата создания</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req, index) => (
                      <tr
                        key={req.id}
                        className={`border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors ${index % 2 === 0 ? "bg-gray-800" : "bg-gray-750"}`}
                        onClick={() => openRequestDetails(req)}
                      >
                        <td className="py-3 px-4">{req.id}</td>
                        <td className="py-3 px-4">{req.organization_name}</td>
                        <td className="py-3 px-4">{new Date(req.implementation_date).toLocaleDateString("ru-RU")}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-600 text-blue-100">
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">{new Date(req.created_at).toLocaleDateString("ru-RU")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Пагинация */}
              <div className="flex justify-between items-center mt-6">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded ${currentPage === 1 ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                >
                  &laquo; Предыдущая
                </button>
                <span className="text-discord-text">
                  Страница {currentPage} из {totalPages}
                </span>
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages && !hasMorePages}
                  className={`px-4 py-2 rounded ${currentPage === totalPages && !hasMorePages ? "bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700"}`}
                >
                  Следующая &raquo;
                </button>
              </div>
            </>
          )}
        </div>

        {/* Модальное окно с подробностями заявки */}
        <RequestDetailsModal
          isOpen={!!selectedRequest}
          onClose={closeRequestDetails}
          request={selectedRequest}
          downloadingFile={false}
          fileDownloadError={null}
          onDownloadFile={(id: number) => {
            // Можно реализовать скачивание файла, если требуется
            console.log("Скачать файл для заявки", id);
          }}
          formatDate={(dateStr: string) => new Date(dateStr).toLocaleDateString("ru-RU")}
          getStatusColor={(status: string) => {
            switch (status) {
              case "Новая":
              case "На рассмотрении":
                return "bg-blue-600 text-blue-100";
              case "В обработке":
                return "bg-yellow-600 text-yellow-100";
              case "Выполнена":
                return "bg-green-600 text-green-100";
              case "Отменена":
                return "bg-red-600 text-red-100";
              default:
                return "bg-gray-600 text-gray-100";
            }
          }}
        />
      </div>
    </ProtectedRoute>
  );
}
