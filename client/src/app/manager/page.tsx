"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequestDetailsModal from "../../components/RequestDetailsModal";
import { Request, downloadRequestFile, updateRequestStatus, deleteRequest } from "../../services/requestService";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function ManagerPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSingleRequest, setLoadingSingleRequest] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState(false);
  const [fileDownloadError, setFileDownloadError] = useState<string | null>(null);
  // Новые состояния для обновления статуса и удаления
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  // Фетч списка заявок при монтировании компонента
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error("Не удалось загрузить заявки");
        }
        const data = await res.json();
        // Убедимся, что data всегда массив, даже если сервер вернул null
        setRequests(Array.isArray(data) ? data : []);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Неизвестная ошибка");
        // В случае ошибки устанавливаем пустой массив, а не null     
        setRequests([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  // Установка selectedRequest на основе параметров URL
  useEffect(() => {
    const requestId = searchParams.get("requestId");
    
    // Не делаем запрос, если в процессе удаления
    if (isDeleting || !requestId) {
      if (!requestId) {
        setSelectedRequest(null);
        setRequestError(null);
      }
      return;
    }
    
    const id = parseInt(requestId, 10);
    const request = requests.find((req) => req.id === id);
    if (request) {
      setSelectedRequest(request);
      setRequestError(null);
    } else {
      // Фетч отдельной заявки, если её нет в списке
      const fetchSingleRequest = async () => {
        setLoadingSingleRequest(true);
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests/${id}`,
            { credentials: "include" }
          );
          if (res.ok) {
            const singleRequest = await res.json();
            setSelectedRequest(singleRequest);
            setRequestError(null);
          } else if (res.status === 404) {
            // Заявка не найдена - очищаем параметр requestId из URL без показа ошибки
            setSelectedRequest(null);
            console.log(`Заявка с ID ${id} не найдена, очищаем URL`);
            router.replace("/manager", { scroll: false });
          } else {
            setSelectedRequest(null);
            setRequestError("Ошибка при загрузке заявки");
          }
        } catch (err: unknown) {
          setSelectedRequest(null);
          setRequestError(err instanceof Error ? err.message : "Ошибка при загрузке заявки");
        } finally {
          setLoadingSingleRequest(false);
        }
      };
      fetchSingleRequest();
    }
  }, [searchParams, requests, router, isDeleting]);

  // Переход к заявке по клику на строку
  const handleRowClick = (request: Request) => {
    router.push(`/manager?requestId=${request.id}`);
  };

  // Функция для скачивания файла
  const handleDownloadFile = async (requestId: number) => {
    if (downloadingFile) return;
    
    setDownloadingFile(true);
    setFileDownloadError(null);
    
    try {
      const result = await downloadRequestFile(requestId);
      
      if (!result.success) {
        throw new Error(result.error || "Не удалось загрузить файл");
      }
      
      // Создаем URL для скачивания
      const url = window.URL.createObjectURL(result.blob!);
      
      // Создаем временную ссылку для скачивания
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', result.filename || `file-${requestId}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      // Освобождаем URL объект
      setTimeout(() => window.URL.revokeObjectURL(url), 100);
    } catch (err) {
      console.error("Ошибка при скачивании файла:", err);
      setFileDownloadError(err instanceof Error ? err.message : "Ошибка при скачивании файла");
    } finally {
      setDownloadingFile(false);
    }
  };

  // Обработчик обновления статуса заявки
  const handleUpdateStatus = async (requestId: number, status: string) => {
    if (updatingStatus) return;
    
    setUpdatingStatus(true);
    setStatusUpdateError(null);
    
    try {
      const result = await updateRequestStatus(requestId, status);
      
      if (!result.success) {
        throw new Error(result.error || "Не удалось обновить статус заявки");
      }
      
      // Обновляем список заявок и выбранную заявку
      setRequests(prevRequests => 
        prevRequests.map(req => 
          req.id === requestId ? { ...req, status, updated_at: new Date().toISOString() } : req
        )
      );
      
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest(prev => prev ? { ...prev, status, updated_at: new Date().toISOString() } : null);
      }
      
    } catch (err) {
      console.error("Ошибка при обновлении статуса:", err);
      setStatusUpdateError(err instanceof Error ? err.message : "Ошибка при обновлении статуса");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Обработчик удаления заявки
  const handleDeleteRequest = async (requestId: number) => {
    if (isDeleting) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      const result = await deleteRequest(requestId);
      
      if (!result.success) {
        throw new Error(result.error || "Не удалось удалить заявку");
      }
      
      // Удаляем заявку из списка
      setRequests(prevRequests => prevRequests.filter(req => req.id !== requestId));
      
      // Закрываем модальное окно и перенаправляем на страницу списка
      setSelectedRequest(null);
      router.replace("/manager", { scroll: false });
      
    } catch (err) {
      console.error("Ошибка при удалении заявки:", err);
      setDeleteError(err instanceof Error ? err.message : "Ошибка при удалении заявки");
    } finally {
      setIsDeleting(false);
    }
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
    <ProtectedRoute allowedRoles={["Менеджер"]}>
      <div style={{ background: 'var(--discord-bg)' }} className="min-h-screen p-6">
        <div className="container mx-auto animate-fadeIn">
          <div className="discord-card p-6 mb-6">
            <h1 className="text-2xl font-bold text-discord-text flex items-center mb-6">
              <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
              Панель управления заявками
            </h1>
            
            {error && (
              <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30 mb-4">
                <p className="text-discord-danger">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
                <p className="text-discord-text-muted mt-4">Загрузка заявок...</p>
              </div>
            ) : !requests || requests.length === 0 ? (
              <div className="discord-glass p-8 flex flex-col items-center justify-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-discord-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-xl font-medium text-discord-text">Заявки отсутствуют</h3>
                <p className="text-discord-text-muted mt-2 max-w-md">
                  В данный момент в системе нет ни одной заявки. Заявки появятся здесь, когда пользователи их создадут.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="discord-table w-full">
                  <thead>
                    <tr>
                      <th className="discord-table-header p-3">ID</th>
                      <th className="discord-table-header p-3">Организация</th>
                      <th className="discord-table-header p-3">ИНН</th>
                      <th className="discord-table-header p-3">Дата</th>
                      <th className="discord-table-header p-3">ФЗ</th>
                      <th className="discord-table-header p-3">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr
                        key={request.id}
                        className="discord-table-row cursor-pointer hover:bg-discord-medium transition-colors duration-200"
                        onClick={() => handleRowClick(request)}
                      >
                        <td className="p-3 text-discord-text">#{request.id}</td>
                        <td className="p-3 text-discord-text font-medium">{request.organization_name}</td>
                        <td className="p-3 text-discord-text-secondary">{request.inn}</td>
                        <td className="p-3 text-discord-text-secondary">
                          {formatDate(request.implementation_date)}
                        </td>
                        <td className="p-3 text-discord-text-secondary">
                          {request.fz_type} ФЗ
                        </td>
                        <td className="p-3">
                          <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            <span className="w-1.5 h-1.5 bg-current rounded-full mr-1.5 opacity-70"></span>
                            {request.status}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {loadingSingleRequest && !selectedRequest && (
            <div className="discord-card p-6 flex justify-center items-center">
              <div className="animate-spin h-8 w-8 border-2 border-discord-accent border-t-transparent rounded-full"></div>
              <span className="ml-3 text-discord-text-muted">Загрузка заявки...</span>
            </div>
          )}

          {requestError && !isDeleting && (
            <div className="p-3 bg-discord-danger bg-opacity-20 rounded-lg border border-discord-danger border-opacity-30 mb-4">
              <p className="text-discord-danger">{requestError}</p>
            </div>
          )}

          {selectedRequest && (
            <RequestDetailsModal
              isOpen={true}
              onClose={() => {
                router.push("/manager");
                setRequestError(null);
              }}
              request={selectedRequest}
              downloadingFile={downloadingFile}
              fileDownloadError={fileDownloadError}
              onDownloadFile={handleDownloadFile}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              isManager={true}
              onUpdateStatus={handleUpdateStatus}
              onDeleteRequest={handleDeleteRequest}
              updatingStatus={updatingStatus}
              deleting={isDeleting}
              statusUpdateError={statusUpdateError}
              deleteError={deleteError}
            />
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}