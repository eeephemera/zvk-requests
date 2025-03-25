"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Modal from "../../components/Modal";

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

export default function ManagerPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [error, setError] = useState("");
  const [requestError, setRequestError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSingleRequest, setLoadingSingleRequest] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  // Удаление заявки с синхронизацией на сервере
  const handleDelete = async (id: number) => {
    if (loadingSingleRequest || isDeleting) return;
    
    try {
      setLoadingSingleRequest(true);
      setIsDeleting(true);
      
      // Сначала очищаем URL и закрываем модальное окно
      setSelectedRequest(null);
      router.replace("/manager", { scroll: false });
      
      // Проверяем, существует ли заявка в локальном состоянии
      const requestExists = requests.some(req => req.id === id);
      if (!requestExists) {
        console.log(`Заявка с ID ${id} уже отсутствует в списке`);
        return;
      }
      
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      
      // Обработка разных статус-кодов
      if (res.status === 404) {
        console.log(`Заявка с ID ${id} не найдена на сервере`);
        // Тихо удаляем из локального состояния
        setRequests(prevRequests => (prevRequests || []).filter((req) => req.id !== id));
        return;
      }
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Неизвестная ошибка" }));
        throw new Error(errorData.error || "Не удалось удалить заявку");
      }
      
      // Успешное удаление
      console.log(`Заявка с ID ${id} успешно удалена`);
      setRequests(prevRequests => (prevRequests || []).filter((req) => req.id !== id));
    } catch (err) {
      console.error("Ошибка при удалении:", err);
      setError(err instanceof Error ? err.message : "Неизвестная ошибка при удалении");
    } finally {
      setLoadingSingleRequest(false);
      setTimeout(() => {
        setIsDeleting(false);
      }, 500);
    }
  };

  // Переход к заявке по клику на строку
  const handleRowClick = (request: Request) => {
    router.push(`/manager?requestId=${request.id}`);
  };

  // Функция обновления статуса заявки
  const handleStatusUpdate = (id: number, newStatus: string) => {
    // Обновляем статус в массиве заявок
    setRequests(prevRequests => 
      prevRequests.map(req => 
        req.id === id ? { ...req, status: newStatus } : req
      )
    );
    
    // Если это выбранная заявка, обновляем и её
    if (selectedRequest && selectedRequest.id === id) {
      setSelectedRequest({
        ...selectedRequest,
        status: newStatus
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="container mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4 text-center">
          Список заявок (Менеджер)
        </h1>

        {error && <p className="text-red-400 mb-4 text-center">{error}</p>}

        {loading ? (
          <p className="text-gray-400 text-center">Загрузка...</p>
        ) : !requests || requests.length === 0 ? (
          <p className="text-gray-400 text-center">Заявки отсутствуют.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-gray-800 rounded-xl shadow-lg">
              <thead>
                <tr className="bg-gray-700 text-gray-300">
                  <th className="py-3 px-4 text-left font-semibold">ID</th>
                  <th className="py-3 px-4 text-left font-semibold">Организация</th>
                  <th className="py-3 px-4 text-left font-semibold">ИНН</th>
                  <th className="py-3 px-4 text-left font-semibold">Дата</th>
                  <th className="py-3 px-4 text-left font-semibold">Статус</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request, index) => (
                  <tr
                    key={request.id}
                    className={`border-b border-gray-700 cursor-pointer ${
                      index % 2 === 0 ? "bg-gray-800" : "bg-gray-750"
                    } hover:bg-gray-600 transition-colors duration-200`}
                    onClick={() => handleRowClick(request)}
                  >
                    <td className="py-3 px-4">{request.id}</td>
                    <td className="py-3 px-4">{request.organization_name}</td>
                    <td className="py-3 px-4">{request.inn}</td>
                    <td className="py-3 px-4">
                      {new Date(request.implementation_date).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-sm font-medium ${
                          request.status === "Новая"
                            ? "bg-blue-600 text-blue-100"
                            : request.status === "В обработке"
                            ? "bg-yellow-600 text-yellow-100"
                            : request.status === "Выполнена"
                            ? "bg-green-600 text-green-100"
                            : "bg-red-600 text-red-100"
                        }`}
                      >
                        {request.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loadingSingleRequest && !selectedRequest && (
          <p className="text-gray-400 text-center mt-4">Загрузка заявки...</p>
        )}

        {requestError && !isDeleting && (
          <p className="text-red-400 mb-4 text-center mt-4">{requestError}</p>
        )}

        {selectedRequest && (
          <Modal
            isOpen={true}
            onClose={() => {
              router.push("/manager");
              setRequestError(null);
            }}
            request={selectedRequest}
            onDelete={handleDelete}
            onStatusUpdate={handleStatusUpdate}
          />
        )}
      </div>
    </div>
  );
}