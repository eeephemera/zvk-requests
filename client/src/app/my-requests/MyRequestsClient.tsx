"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { getUserRequests, downloadRequestFile, Request } from "@/services/requestService";
import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import RequestDetailsModal from "@/components/RequestDetailsModal";
import { ApiError, PaginatedResponse } from "@/services/apiClient";

// Константа для количества элементов на странице
const ITEMS_PER_PAGE = 10;

export default function MyRequestsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get('page') || '1');

  // Single query to fetch requests and total count
  const { 
    data: requestsData, 
    isLoading: isLoadingRequests, // Use this for initial loading
    isFetching: isFetchingRequests, // Use this for refetching indicator
    isError: isErrorRequests,
    error: errorRequests 
  } = useQuery<PaginatedResponse<Request>, ApiError | Error | null>({
    queryKey: ['userRequests', currentPage, ITEMS_PER_PAGE],
    queryFn: () => getUserRequests(currentPage, ITEMS_PER_PAGE),
  });

  // Derive state directly from the single query result
  const totalRequests = useMemo(() => requestsData?.total ?? 0, [requestsData]);
  const requests = useMemo(() => requestsData?.items ?? [], [requestsData]);
  
  // Simplified loading state: true only during the very first fetch
  const isLoading = isLoadingRequests && !requestsData; 
  // Simplified fetching state: true during background refetches
  const isFetching = isFetchingRequests && !isLoading; 

  // Improved error display logic
  const requestError = useMemo(() => {
    const err = errorRequests;

    if (!isErrorRequests || !err) return null; 

    let displayError = 'Произошла ошибка при загрузке заявок.';

    if (err instanceof ApiError) {
      if (err.status >= 500) {
        displayError = "Ошибка на сервере при загрузке заявок. Попробуйте обновить страницу.";
      } else if (err.status === 401 || err.status === 403) {
         displayError = "Ошибка доступа при загрузке заявок."; 
      } else {
        displayError = err.message || displayError;
      }
    } else if (err instanceof Error) {
      displayError = err.message;
    }

    return displayError;
  }, [isErrorRequests, errorRequests]);
  
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  
  const totalPages = useMemo(() => Math.ceil(totalRequests / ITEMS_PER_PAGE) || 1, [totalRequests]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      router.push(`/my-requests?page=${page}`);
    }
  };

  const openRequestDetails = (req: Request) => setSelectedRequest(req);
  const closeRequestDetails = () => setSelectedRequest(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "На рассмотрении": return "text-yellow-500";
      case "В работе": return "text-purple-500";
      case "Выполнена": return "text-green-500";
      case "Отклонена": return "text-red-500";
      default: return "text-gray-500";
    }
  };

  const [downloadingFile, setDownloadingFile] = useState<boolean>(false);
  const [fileDownloadError, setFileDownloadError] = useState<string | null>(null);

  // Обработчик скачивания файла
  const handleDownloadFile = async (requestId: number) => {
    if (downloadingFile) return;

    setDownloadingFile(true);
    setFileDownloadError(null);

    try {
      const { blob, filename } = await downloadRequestFile(requestId);
      
      // Создаём URL объекта и скачиваем его
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      setFileDownloadError(
        error instanceof ApiError 
          ? error.message 
          : "Не удалось скачать файл. Пожалуйста, попробуйте позже."
      );
    } finally {
      setDownloadingFile(false);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
          <p className="text-discord-text-muted mt-4">Загрузка заявок...</p>
        </div>
      );
    }

    if (requestError) {
      return (
        <div className="mb-5 text-center">
          <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30">
            <p className="text-discord-danger">{requestError}</p>
          </div>
        </div>
      );
    }

    if (totalRequests === 0) {
      return (
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
      );
    }

    // Render table and pagination if requests exist
    return (
      <>
        {totalPages > 1 && (
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
              disabled={currentPage === totalPages}
              className={`discord-btn-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Следующая &raquo;
            </button>
          </div>
        )}
        
        <div className="overflow-x-auto max-h-96">
          <table className="discord-table w-full table-fixed">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="discord-table-header p-1.5 w-[8%]">ID</th>
                <th className="discord-table-header p-1.5 w-[25%]">Партнер</th>
                <th className="discord-table-header p-1.5 w-[25%]">Продукт</th>
                <th className="discord-table-header p-1.5 w-[20%]">Конечный клиент</th>
                <th className="discord-table-header p-1.5 w-[12%]">Статус</th>
                <th className="discord-table-header p-1.5 w-[10%]">Создана</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req: Request) => (
                <tr
                  key={req.id}
                  className="discord-table-row cursor-pointer hover:bg-discord-medium transition-colors duration-200"
                  onClick={() => openRequestDetails(req)}
                >
                  <td className="p-1.5 text-discord-text text-xs whitespace-nowrap overflow-hidden text-ellipsis">#{req.id}</td>
                  <td className="p-1.5 text-discord-text font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis" title={req.partner?.name ?? '-'}>{req.partner?.name ?? '-'}</td>
                  <td className="p-1.5 text-discord-text-secondary text-xs whitespace-nowrap overflow-hidden text-ellipsis" title={req.product?.name ?? '-'}>{req.product?.name ?? '-'}</td>
                  <td className="p-1.5 text-discord-text-secondary text-xs whitespace-nowrap overflow-hidden text-ellipsis" title={req.end_client?.name ?? '-'}>{req.end_client?.name ?? '-'}</td>
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

        {totalPages > 1 && (
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
              disabled={currentPage === totalPages}
              className={`discord-btn-secondary ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Следующая &raquo;
            </button>
          </div>
        )}
      </>
    );
  };
  
  return (
    <ProtectedRoute allowedRoles={["USER"]}>
      <div className="container mx-auto p-4">
        <div className="discord-card p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-discord-text">Мои заявки</h1>
            <Link
              href="/deal-registration"
              className="discord-btn-primary"
            >
              Создать заявку
            </Link>
          </div>
          {isFetching && (
            <div className="absolute top-2 right-2">
              <div className="w-4 h-4 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {renderContent()}
        </div>
      </div>
      <RequestDetailsModal
        isOpen={!!selectedRequest}
        onClose={closeRequestDetails}
        request={selectedRequest}
        isLoadingDetails={false} 
        downloadingFile={downloadingFile}
        fileDownloadError={fileDownloadError}
        onDownloadFile={handleDownloadFile}
        formatDate={formatDate}
        getStatusColor={getStatusColor}
      />
    </ProtectedRoute>
  );
} 