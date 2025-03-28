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

  // Функция для форматирования даты
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  // Функция для определения цвета статуса
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Новая":
        return "text-discord-info";
      case "На рассмотрении":
        return "text-discord-info";
      case "В обработке":
        return "text-discord-warning";
      case "Выполнена":
        return "text-discord-success";
      case "Отклонена":
        return "text-discord-danger";
      default:
        return "text-discord-text-muted";
    }
  };

  return (
    <ProtectedRoute allowedRoles={["Пользователь"]} redirectIfNotAllowed={true}>
      <div className="min-h-screen p-6" style={{ background: 'var(--discord-bg)' }}>
        <div className="container mx-auto animate-fadeIn">
          <div className="discord-card p-6 mb-6">
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
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-discord-text-muted mt-4">Загрузка заявок...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="discord-glass p-8 flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-discord-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-medium text-discord-text">У вас пока нет заявок</h3>
                <Link
                  href="/requests"
                  className="discord-btn-primary mt-4"
                >
                  Создать заявку
                </Link>
              </div>
            ) : (
              <>
                {/* Верхняя пагинация */}
                <div className="flex justify-between items-center mb-4">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`discord-btn-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    &laquo; Предыдущая
                  </button>
                  <span className="text-discord-text">
                    Страница {currentPage} из {totalPages}
                  </span>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages && !hasMorePages}
                    className={`discord-btn-secondary ${currentPage === totalPages && !hasMorePages ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    Следующая &raquo;
                  </button>
                </div>
                
                <div className="overflow-x-auto max-h-96">
                  <table className="discord-table w-full table-fixed">
                    <thead className="sticky top-0 z-10">
                      <tr>
                        <th className="discord-table-header p-1.5 w-[8%]">ID</th>
                        <th className="discord-table-header p-1.5 w-[30%]">Организация</th>
                        <th className="discord-table-header p-1.5 w-[15%]">Дата реализации</th>
                        <th className="discord-table-header p-1.5 w-[15%]">Статус</th>
                        <th className="discord-table-header p-1.5 w-[15%]">Дата создания</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((req) => (
                        <tr
                          key={req.id}
                          className="discord-table-row cursor-pointer hover:bg-discord-medium transition-colors duration-200"
                          onClick={() => openRequestDetails(req)}
                        >
                          <td className="p-1.5 text-discord-text text-xs whitespace-nowrap overflow-hidden text-ellipsis">#{req.id}</td>
                          <td className="p-1.5 text-discord-text font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis">{req.organization_name}</td>
                          <td className="p-1.5 text-discord-text-secondary text-xs whitespace-nowrap overflow-hidden text-ellipsis">{formatDate(req.implementation_date)}</td>
                          <td className="p-1.5 text-xs">
                            <div className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(req.status)}`}>
                              <span className="w-1 h-1 bg-current rounded-full mr-1 opacity-70"></span>
                              {req.status}
                            </div>
                          </td>
                          <td className="p-1.5 text-discord-text-secondary text-xs whitespace-nowrap overflow-hidden text-ellipsis">{formatDate(req.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Нижняя пагинация */}
                <div className="flex justify-between items-center mt-4">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className={`discord-btn-secondary ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    &laquo; Предыдущая
                  </button>
                  <span className="text-discord-text">
                    Страница {currentPage} из {totalPages}
                  </span>
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages && !hasMorePages}
                    className={`discord-btn-secondary ${currentPage === totalPages && !hasMorePages ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            formatDate={formatDate}
            getStatusColor={getStatusColor}
          />
        </div>
      </div>
    </ProtectedRoute>
  );
}
