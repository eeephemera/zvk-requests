// D:\projects\zvk-requests\client\src\app\manager\page.tsx
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

  // Функция для получения списка заявок
  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/requests`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      // Обработка 204 для совместимости с текущим сервером
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
    } catch (err: Error) {
      setError(err.message || "Что-то пошло не так");
    } finally {
      setLoading(false);
    }
  };

  // Функция для обновления заявки
  const updateRequest = async (updatedRequest: Request) => {
    setIsUpdating(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/requests`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updatedRequest),
      });
      if (!res.ok) {
        throw new Error(`Ошибка ${res.status}: Не удалось обновить заявку`);
      }
      const updatedData = await res.json();
      setRequests((prev) =>
        prev.map((req) => (req.id === updatedData.id ? updatedData : req))
      );
    } catch (err: Error) {
      setError(err.message || "Что-то пошло не так при обновлении");
    } finally {
      setIsUpdating(false);
    }
  };

  // Функция для удаления заявки
  const deleteRequest = async (id: number) => {
    setIsDeleting(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/requests/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`Ошибка ${res.status}: Не удалось удалить заявку`);
      }
      setRequests((prev) => prev.filter((req) => req.id !== id));
    } catch (err: Error) {
      setError(err.message || "Что-то пошло не так при удалении");
    } finally {
      setIsDeleting(false);
    }
  };

  // Загружаем заявки при монтировании компонента
  useEffect(() => {
    fetchRequests();
  }, []);

  // Обработчик обновления статуса заявки
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

  // Отображение состояния загрузки
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    );
  }

  // Отображение ошибок с возможностью повторить запрос
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center text-red-500">
        <p>Произошла ошибка: {error}</p>
        <button
          onClick={fetchRequests}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  // Основной интерфейс
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-100">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Список заявок</h1>
      {requests.length === 0 ? (
        <p className="text-gray-500">Заявок пока нет.</p>
      ) : (
        <ul className="w-full max-w-2xl space-y-6">
          {requests.map((request) => (
            <li
              key={request.id}
              className="border p-6 rounded-lg bg-white shadow-md hover:shadow-lg transition"
            >
              <h2 className="font-bold text-xl text-gray-800">{request.product_name}</h2>
              <p className="text-gray-600 mt-1">{request.description}</p>
              <p className="text-sm text-gray-500 mt-2">
                Статус: <span className="font-medium">{request.status}</span>
              </p>
              <p className="text-sm text-gray-500">
                Дата создания: {new Date(request.created_at).toLocaleString()}
              </p>
              <div className="mt-4 flex space-x-3">
                <button
                  onClick={() => handleUpdate(request)}
                  className={`px-4 py-2 rounded text-white font-medium ${
                    isUpdating
                      ? "bg-green-300 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600"
                  } transition`}
                  disabled={isUpdating}
                >
                  {isUpdating ? "Обновление..." : "Обработать"}
                </button>
                <button
                  onClick={() => handleDelete(request.id)}
                  className={`px-4 py-2 rounded text-white font-medium ${
                    isDeleting
                      ? "bg-red-300 cursor-not-allowed"
                      : "bg-red-500 hover:bg-red-600"
                  } transition`}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Удаление..." : "Удалить"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}