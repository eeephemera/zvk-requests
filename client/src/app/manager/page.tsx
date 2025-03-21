"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  tz_file: string; // or Blob, depending on server response
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ManagerPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [deleteModalId, setDeleteModalId] = useState<number | null>(null);
  const router = useRouter();

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/manager/requests`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (res.status === 204) {
        setRequests([]);
        return;
      }

      if (!res.ok) {
        if (res.status === 401) {
          setError("Не авторизован. Перенаправляем на вход...");
          setTimeout(() => router.push("/login"), 2000);
          return;
        } else if (res.status === 403) {
          setError("У вас нет прав для просмотра заявок.");
        } else {
          throw new Error(`Ошибка ${res.status}: Не удалось загрузить заявки`);
        }
      }

      const data = await res.json();
      if (Array.isArray(data)) {
        setRequests(data);
      } else {
        throw new Error("Неверный формат данных от сервера");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const updateRequest = useCallback(async (updatedRequest: Request) => {
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
      setError(err instanceof Error ? err.message : "Неизвестная ошибка при обновлении");
    }
  }, []);

  const deleteRequest = useCallback(async (id: number) => {
    setDeletingIds((prev) => new Set(prev).add(id));
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
      setError(err instanceof Error ? err.message : "Неизвестная ошибка при удалении");
    } finally {
      setDeletingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleStatusChange = (id: number, newStatus: string) => {
    const request = requests.find(r => r.id === id);
    if (request) {
      const updatedRequest = { ...request, status: newStatus };
      updateRequest(updatedRequest);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteModalId(id);
  };

  const confirmDelete = () => {
    if (deleteModalId !== null) {
      deleteRequest(deleteModalId);
      setDeleteModalId(null);
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
          className="px-4 py-2 bg-blue-600 rounded text-white"
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
            <table className="min-w-full divide-y divide-gray-700" aria-label="Список заявок">
              <thead className="bg-gray-800">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ID</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">INN</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Организация</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Дата реализации</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">ФЗ</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Реестр</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Комментарий</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Статус</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Создано</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Действия</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-700">
                {requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.inn}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.organization_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{new Date(request.implementation_date).toLocaleDateString("ru-RU")}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.fz_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.registry_type}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{request.comment}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        value={request.status}
                        onChange={(e) => handleStatusChange(request.id, e.target.value)}
                        className="p-1 rounded bg-gray-700 text-white"
                      >
                        <option value="На рассмотрении">На рассмотрении</option>
                        <option value="В работе">В работе</option>
                        <option value="Завершена">Завершена</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-200">{new Date(request.created_at).toLocaleString("ru-RU")}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => handleDelete(request.id)}
                        className={`px-3 py-1 rounded ${
                          deletingIds.has(request.id)
                            ? "bg-red-500 opacity-50 cursor-not-allowed"
                            : "bg-red-600 hover:bg-red-700"
                        } transition`}
                        disabled={deletingIds.has(request.id)}
                      >
                        {deletingIds.has(request.id) ? "Удаление..." : "Удалить"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Modal isOpen={deleteModalId !== null} onClose={() => setDeleteModalId(null)}>
        <h2 className="text-xl font-bold mb-4 text-white">Подтверждение удаления</h2>
        <p className="text-gray-300">Вы уверены, что хотите удалить эту заявку?</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => setDeleteModalId(null)}
            className="px-4 py-2 bg-gray-600 rounded text-white"
          >
            Отмена
          </button>
          <button
            onClick={confirmDelete}
            className="px-4 py-2 bg-red-600 rounded text-white"
          >
            Удалить
          </button>
        </div>
      </Modal>
    </div>
  );
}