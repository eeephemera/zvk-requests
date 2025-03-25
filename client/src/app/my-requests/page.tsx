"use client";

import { useState, useEffect, useCallback } from "react";
import { getUserRequests, Request, downloadTzFile, getTotalRequestsCount } from "../../services/requestService";
import Link from "next/link";
import RequestDetailsModal from "../../components/RequestDetailsModal";

// Константы
const ITEMS_PER_PAGE = 10;
const TEST_PAGINATION = false; // Для тестирования пагинации

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [fileDownloadError, setFileDownloadError] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<boolean>(false);
  
  // Состояния для пагинации на стороне сервера
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(ITEMS_PER_PAGE);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [hasMorePages, setHasMorePages] = useState<boolean>(false);

  // Функция для определения статуса сети
  const updateOnlineStatus = () => {
    setIsOnline(navigator.onLine);
  };

  // Функция для получения общего числа заявок
  const fetchTotalCount = useCallback(async () => {
    try {
      // Сначала пробуем получить общее количество через специальный API-endpoint
      const countResult = await getTotalRequestsCount();
      
      if (countResult.success && countResult.total !== undefined) {
        setTotalItems(countResult.total);
        return;
      }
      
      // Если API не возвращает total, выполняем последовательные запросы,
      // чтобы определить общее количество заявок
      let currentPageIdx = 1;
      let totalFound = 0;
      let continueSearch = true;
      
      // Устанавливаем лимит поиска, чтобы не сделать слишком много запросов
      const maxSearchPages = 10;
      
      while (continueSearch && currentPageIdx <= maxSearchPages) {
        const result = await getUserRequests(currentPageIdx, itemsPerPage);
        if (result.success && result.requests) {
          totalFound += result.requests.length;
          
          // Если получено меньше элементов, чем размер страницы, значит это последняя страница
          if (result.requests.length < itemsPerPage) {
            continueSearch = false;
          }
        } else {
          // Если произошла ошибка, прекращаем поиск
          continueSearch = false;
        }
        
        currentPageIdx++;
      }
      
      // Устанавливаем найденное количество
      setTotalItems(totalFound);
      
      // Если достигли лимита страниц и при этом получили полную последнюю страницу,
      // значит могут быть еще записи
      if (currentPageIdx > maxSearchPages) {
        setHasMorePages(true);
      } else {
        setHasMorePages(false);
      }
      
    } catch (error) {
      console.error("Ошибка при получении общего количества заявок:", error);
    }
  }, [itemsPerPage]);

  // Функция для загрузки заявок
  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    
    if (!navigator.onLine) {
      setError("Отсутствует подключение к интернету. Проверьте соединение и попробуйте снова.");
      setLoading(false);
      return;
    }

    try {
      // Используем пагинацию на уровне сервера
      const result = await getUserRequests(page, itemsPerPage);
      if (result.success && result.requests) {
        setRequests(result.requests);
        
        // Если это первая страница и мы еще не знаем общее количество,
        // запускаем дополнительную проверку
        if (page === 1 && totalItems === 0) {
          fetchTotalCount();
        }
        
        // Если вернулось меньше элементов, чем было запрошено, 
        // и мы на последней известной странице, обновляем общее количество
        if (result.requests.length < itemsPerPage && page === Math.ceil(totalItems / itemsPerPage)) {
          setTotalItems((page - 1) * itemsPerPage + result.requests.length);
          setHasMorePages(false);
        }
        
        // Проверяем, есть ли следующая страница, если мы на последней известной
        if (page >= Math.ceil(totalItems / itemsPerPage) && result.requests.length === itemsPerPage) {
          // Если текущая страница заполнена полностью, проверим наличие следующей
          const nextPageResult = await getUserRequests(page + 1, 1);
          if (nextPageResult.success && nextPageResult.requests) {
            setHasMorePages(nextPageResult.requests.length > 0);
          }
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
  }, [itemsPerPage, totalItems, fetchTotalCount]);

  useEffect(() => {
    // Добавляем слушатели событий для отслеживания статуса сети
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Инициируем загрузку заявок
    fetchRequests(currentPage);
    
    // Очищаем слушатели при размонтировании компонента
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [fetchRequests, currentPage]);

  // Функция для форматирования даты с защитой от ошибок
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Некорректная дата";
      }
      return date.toLocaleDateString("ru-RU");
    } catch (error) {
      console.error("Ошибка при форматировании даты:", error);
      return "Некорректная дата";
    }
  };

  // Функция для скачивания файла ТЗ с обработкой ошибок
  const handleDownloadTzFile = async (requestId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Предотвращаем открытие модального окна
    event.preventDefault();
    
    if (!navigator.onLine) {
      setFileDownloadError("Отсутствует подключение к интернету. Проверьте соединение и попробуйте снова.");
      return;
    }
    
    setDownloadingFile(true);
    setFileDownloadError(null);

    try {
      const result = await downloadTzFile(requestId);
      
      if (!result.success) {
        setFileDownloadError(result.error || "Произошла ошибка при скачивании файла");
        return;
      }
      
      if (result.blob && result.filename) {
        const url = window.URL.createObjectURL(result.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error("Ошибка при скачивании файла:", error);
      setFileDownloadError("Произошла ошибка при скачивании файла. Пожалуйста, попробуйте позже.");
    } finally {
      setDownloadingFile(false);
    }
  };

  // Функция для определения цвета статуса
  const getStatusColor = (status: string) => {
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
  };

  // Функция для открытия модального окна с деталями заявки
  const openRequestDetails = (request: Request) => {
    setSelectedRequest(request);
    setFileDownloadError(null); // Сбрасываем ошибку при открытии нового модального окна
  };

  // Функция для закрытия модального окна
  const closeRequestDetails = () => {
    setSelectedRequest(null);
    setFileDownloadError(null);
  };

  // Функции для навигации по страницам
  const goToPage = (page: number) => {
    if (page >= 1 && (page <= totalPages || hasMorePages)) {
      setCurrentPage(page);
      // При переключении страницы делаем новый запрос
      fetchRequests(page);
    }
  };

  // Расчет данных для пагинации
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

  return (
    <div className="min-h-screen bg-gray-900 p-6 pb-20">
      <div className="container mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Мои заявки</h1>
          <div className="flex items-center space-x-3">
            <Link 
              href="/requests" 
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
            >
              Новая заявка
            </Link>
          </div>
        </div>

        {!isOnline && (
          <div className="bg-yellow-900 bg-opacity-20 border border-yellow-800 text-yellow-300 p-4 rounded mb-6">
            Вы не подключены к интернету. Проверьте соединение и обновите страницу.
          </div>
        )}

        {error && (
          <div className="bg-red-900 bg-opacity-20 border border-red-800 text-red-300 p-4 rounded mb-6 flex flex-col items-center">
            <p className="mb-2">{error}</p>
            <button
              onClick={() => fetchRequests(currentPage)}
              disabled={loading || !isOnline}
              className={`px-4 py-2 rounded mt-2 text-white font-medium ${
                !isOnline ? "bg-gray-600 cursor-not-allowed" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              Повторить загрузку
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center p-10">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mb-4"></div>
            <p className="text-gray-400">Загрузка заявок...</p>
          </div>
        ) : requests.length === 0 && !error ? (
          <div className="bg-gray-800 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">У вас пока нет заявок</p>
            <Link
              href="/requests"
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
            >
              Создать заявку
            </Link>
          </div>
        ) : !error && (
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
                  {requests.map((request, index) => (
                    <tr
                      key={request.id}
                      className={`border-b border-gray-700 cursor-pointer hover:bg-gray-700 transition-colors ${
                        index % 2 === 0 ? "bg-gray-800" : "bg-gray-750"
                      }`}
                      onClick={() => openRequestDetails(request)}
                    >
                      <td className="py-3 px-4">{request.id}</td>
                      <td className="py-3 px-4">{request.organization_name}</td>
                      <td className="py-3 px-4">{formatDate(request.implementation_date)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">{formatDate(request.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Убираем пагинацию в конце таблицы, так как она будет доступна в фиксированной панели */}
            {/* Вместо нее оставляем пустое пространство для отступа */}
            <div className="h-12"></div>
          </>
        )}
      </div>
      
      {/* Фиксированная панель пагинации внизу экрана */}
      {(totalPages > 1 || hasMorePages || TEST_PAGINATION) && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-800 shadow-lg py-3 px-4 border-t border-gray-700 z-10">
          <div className="container mx-auto flex justify-between items-center">
            <div className="text-gray-400 text-sm">
              {hasMorePages && totalItems === (currentPage * itemsPerPage) + 1
                ? `Показано: ${((currentPage - 1) * itemsPerPage) + 1} - ${(currentPage - 1) * itemsPerPage + requests.length} (есть ещё заявки)`
                : `Показано: ${((currentPage - 1) * itemsPerPage) + 1} - ${(currentPage - 1) * itemsPerPage + requests.length} из ${totalItems} заявок`
              }
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-md ${
                  currentPage === 1
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title="На первую страницу"
              >
                &laquo;&laquo;
              </button>
              
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-md ${
                  currentPage === 1
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title="Предыдущая страница"
              >
                &laquo;
              </button>
              
              <div className="flex items-center">
                <span className="text-gray-400 mr-2">
                  {hasMorePages && totalItems === (currentPage * itemsPerPage) + 1
                    ? `Страница ${currentPage}`
                    : `${currentPage} из ${Math.max(1, totalPages)}`
                  }
                </span>
                
                <select 
                  value={currentPage} 
                  onChange={(e) => goToPage(Number(e.target.value))}
                  className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white ml-2"
                >
                  {Array.from({ length: Math.min(hasMorePages ? currentPage + 5 : totalPages, 20) }, (_, i) => (
                    <option key={i + 1} value={i < 10 ? i + 1 : (i === 10 && currentPage > 10) ? Math.max(currentPage - 5, 11) : (i > 10 && i < 19) ? Math.min(currentPage + (i - 15), totalPages - 1) : totalPages}>
                      {i < 10 ? `${i + 1}` : 
                       (i === 10 && currentPage > 10) ? `${Math.max(currentPage - 5, 11)}` : 
                       (i > 10 && i < 19) ? `${Math.min(currentPage + (i - 15), totalPages - 1)}` : 
                       `${totalPages}`}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage === totalPages && !hasMorePages}
                className={`px-3 py-2 rounded-md ${
                  currentPage === totalPages && !hasMorePages
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title="Следующая страница"
              >
                &raquo;
              </button>
              
              <button
                onClick={() => goToPage(totalPages)}
                disabled={currentPage === totalPages && !hasMorePages}
                className={`px-3 py-2 rounded-md ${
                  currentPage === totalPages && !hasMorePages
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
                title="На последнюю страницу"
              >
                &raquo;&raquo;
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Используем модульный компонент для отображения деталей заявки */}
      <RequestDetailsModal
        isOpen={!!selectedRequest}
        onClose={closeRequestDetails}
        request={selectedRequest}
        downloadingFile={downloadingFile}
        fileDownloadError={fileDownloadError}
        onDownloadFile={handleDownloadTzFile}
        formatDate={formatDate}
        getStatusColor={getStatusColor}
      />
    </div>
  );
} 