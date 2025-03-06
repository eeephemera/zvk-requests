"use client";

import { useState, useEffect } from "react";

interface Request {
  id: number;
  product_name: string;
  description: string;
  status: string;
  created_at: string;
}

export default function ManagerPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Функция для получения списка заявок (для менеджера)
  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );

      if (res.status === 204) {
        setRequests([]);
        return;
      }

      if (!res.ok) {
        throw new Error(`Ошибка ${res.status}: Не удалось загрузить заявки`);
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      } else {
        throw new Error("Неверный формат данных от сервера");
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Неизвестная ошибка");
      }
    } finally {
      setLoading(false);
    }
  };

  // Функция для обновления заявки (для менеджера)
  const updateRequest = async (updatedRequest: Request) => {
    setIsUpdating(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests/${updatedRequest.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(updatedRequest),
        }
      );
      if (!res.ok) {
        throw new Error(`Ошибка ${res.status}: Не удалось обновить заявку`);
      }
      const updatedData = await res.json();
      setRequests((prev) =>
        prev.map((req) => (req.id === updatedData.id ? updatedData : req))
      );
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Неизвестная ошибка при обновлении");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // Функция для удаления заявки (для менеджера)
  const deleteRequest = async (id: number) => {
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests/${id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        }
      );
      if (!res.ok) {
        throw new Error(`Ошибка ${res.status}: Не удалось удалить заявку`);
      }
      setRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Неизвестная ошибка при удалении");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Загружаем заявки при монтировании компонента
  useEffect(() => {
    fetchRequests();
  }, []);

  // Обработчик обновления статуса заявки (например, меняем статус на "processed")
  const handleUpdate = (request: Request) => {
    const updatedRequest = { ...request, status: "processed" };
    updateRequest(updatedRequest);
  };

  // Обработчик удаления заявки
  const handleDelete = (id: number) => {
    if (window.confirm("Вы уверены, что хотите удалить эту заявку?")) {
      deleteRequest(id);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400 text-lg">Загрузка...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-center text-red-400">
        <p className="mb-4">{error}</p>
        <button
          onClick={fetchRequests}
          className="px-4 py-2 bg-blue-600 rounded hover:bg-blue-700 transition"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-center">Список заявок</h1>
        {requests.length === 0 ? (
          <p className="text-gray-400 text-center">Заявок пока нет.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Продукт</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Описание</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Статус</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Создано</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.status}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">
                      {new Date(request.created_at).toLocaleString("ru-RU")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleUpdate(request)}
                        className={`mr-2 px-3 py-1 rounded ${
                          isUpdating
                            ? "bg-green-500 opacity-50 cursor-not-allowed"
                            : "bg-green-600 hover:bg-green-700"
                        } transition`}
                        disabled={isUpdating}
                      >
                        Обработать
                      </button>
                      <button
                        onClick={() => handleDelete(request.id)}
                        className={`px-3 py-1 rounded ${
                          isDeleting
                            ? "bg-red-500 opacity-50 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700"
                        } transition`}
                        disabled={isDeleting}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
