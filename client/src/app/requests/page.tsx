"use client";

import { useState } from "react";

export default function RequestsPage() {
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const res = await fetch(
        process.env.NEXT_PUBLIC_API_URL + "/api/requests",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            product_name: productName,
            description: description,
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка отправки заявки");
      }

      const data = await res.json();
      console.log("Request submitted:", data);
      setSuccess("Заявка успешно отправлена!");
      setProductName("");
      setDescription("");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Что-то пошло не так");
      } else {
        setError("Неизвестная ошибка");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-white mb-6 text-center">
          Отправка заявки
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-red-400 text-center">{error}</p>}
          {success && <p className="text-green-400 text-center">{success}</p>}
          <div>
            <label
              htmlFor="productName"
              className="block text-gray-300 mb-1"
            >
              Наименование продукта
            </label>
            <input
              id="productName"
              type="text"
              placeholder="Введите наименование продукта"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label
              htmlFor="description"
              className="block text-gray-300 mb-1"
            >
              Описание заявки
            </label>
            <textarea
              id="description"
              placeholder="Введите описание заявки"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-green-600 hover:bg-green-700 rounded text-white font-semibold transition-colors"
          >
            Отправить заявку
          </button>
        </form>
      </div>
    </div>
  );
}
