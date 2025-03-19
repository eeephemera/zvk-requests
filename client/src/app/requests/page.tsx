"use client";

import { useState, useCallback } from "react";

export default function RequestsPage() {
  const [inn, setInn] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [tzFile, setTzFile] = useState<File | null>(null);
  const [implementationDate, setImplementationDate] = useState("");
  const [fzType, setFzType] = useState<"223" | "44">("223");
  const [comment, setComment] = useState("");
  const [registryType, setRegistryType] = useState<"registry" | "non-registry">("registry");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError("");
    setSuccess("");
    setIsLoading(true);

    if (!inn || !organizationName || !tzFile || !implementationDate) {
      setError("Пожалуйста, заполните все обязательные поля.");
      setIsLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append("inn", inn);
    formData.append("organization_name", organizationName);
    formData.append("tz_file", tzFile);
    formData.append("implementation_date", implementationDate);
    formData.append("fz_type", fzType);
    formData.append("comment", comment);
    formData.append("registry_type", registryType);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/requests`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        const message = errorData.message || "Ошибка отправки заявки";
        if (res.status === 400) setError("Неверный формат данных.");
        else if (res.status === 401) setError("Не авторизован.");
        else setError(message);
        throw new Error(message);
      }

      const data = await res.json();
      console.log("Request submitted, ID:", data.requestId);
      setSuccess("Заявка успешно отправлена!");
      setTimeout(() => {
        setInn("");
        setOrganizationName("");
        setTzFile(null);
        setImplementationDate("");
        setFzType("223");
        setComment("");
        setRegistryType("registry");
      }, 1000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setIsLoading(false);
    }
  }, [inn, organizationName, tzFile, implementationDate, fzType, comment, registryType]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-lg p-6">
        <h1 className="text-2xl font-bold text-white mb-4 text-center">
          Регистрация проекта
        </h1>

        {/* Сообщения */}
        {(error || success) && (
          <div className="mb-4 text-center">
            {error && <p className="text-red-400">{error}</p>}
            {success && <p className="text-green-400">{success}</p>}
          </div>
        )}

        {/* Основная сетка */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Левая колонка */}
          <div className="space-y-4">
            {/* ИНН */}
            <div>
              <label htmlFor="inn" className="block text-gray-300 text-sm mb-1">
                ИНН
              </label>
              <input
                id="inn"
                type="text"
                placeholder="Введите ИНН"
                value={inn}
                onChange={(e) => setInn(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                required
                aria-required="true"
              />
            </div>

            {/* Наименование организации */}
            <div>
              <label htmlFor="organizationName" className="block text-gray-300 text-sm mb-1">
                Наименование организации
              </label>
              <input
                id="organizationName"
                type="text"
                placeholder="Название организации"
                value={organizationName}
                onChange={(e) => setOrganizationName(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                required
                aria-required="true"
              />
            </div>

            {/* Прикрепить ТЗ */}
            <div>
              <label htmlFor="tzFile" className="block text-gray-300 text-sm mb-1">
                Прикрепить ТЗ
              </label>
              <input
                id="tzFile"
                type="file"
                onChange={(e) => setTzFile(e.target.files ? e.target.files[0] : null)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-4">
            {/* Дата реализации */}
            <div>
              <label htmlFor="implementationDate" className="block text-gray-300 text-sm mb-1">
                Дата реализации
              </label>
              <input
                id="implementationDate"
                type="date"
                value={implementationDate}
                onChange={(e) => setImplementationDate(e.target.value)}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                required
                aria-required="true"
              />
            </div>

            {/* Какой ФЗ? */}
            <div>
              <label htmlFor="fzType" className="block text-gray-300 text-sm mb-1">
                Какой ФЗ?
              </label>
              <select
                id="fzType"
                value={fzType}
                onChange={(e) => setFzType(e.target.value as "223" | "44")}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="223">223 ФЗ</option>
                <option value="44">44 ФЗ</option>
              </select>
            </div>

            {/* Реестр/Нереестр */}
            <div>
              <label htmlFor="registryType" className="block text-gray-300 text-sm mb-1">
                Реестр/Нереестр
              </label>
              <select
                id="registryType"
                value={registryType}
                onChange={(e) => setRegistryType(e.target.value as "registry" | "non-registry")}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
              >
                <option value="registry">Реестр</option>
                <option value="non-registry">Нереестр</option>
              </select>
            </div>
          </div>
        </div>

        {/* Комментарий */}
        <div className="mt-4">
          <label htmlFor="comment" className="block text-gray-300 text-sm mb-1">
            Комментарий
          </label>
          <textarea
            id="comment"
            placeholder="Введите комментарий"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
            rows={3}
          />
        </div>

        {/* Кнопка */}
        <div className="mt-6">
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className={`w-full py-2 rounded text-white font-semibold transition-colors ${isLoading ? "bg-green-400" : "bg-green-600 hover:bg-green-700"}`}
          >
            {isLoading ? "Отправка..." : "Зарегистрировать проект"}
          </button>
        </div>
      </div>
    </div>
  );
}