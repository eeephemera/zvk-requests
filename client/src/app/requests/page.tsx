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
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Ошибка отправки заявки");
      }

      const data = await res.json();
      console.log("Request submitted:", data);
      setSuccess("Заявка успешно отправлена!");
      setProductName("");
      setDescription("");
    } catch (err: any) {
      setError(err.message || "Что-то пошло не так");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-4">Отправка заявки</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-md">
        {error && <p className="text-red-500">{error}</p>}
        {success && <p className="text-green-500">{success}</p>}
        <input
          type="text"
          placeholder="Наименование продукта"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <textarea
          placeholder="Описание заявки"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <button
          type="submit"
          className="bg-green-500 text-white p-2 rounded hover:bg-green-600 transition-colors"
        >
          Отправить заявку
        </button>
      </form>
    </div>
  );
}