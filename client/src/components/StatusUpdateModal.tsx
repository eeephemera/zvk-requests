"use client";

import { useState } from 'react';
import { Request } from '@/services/requestService';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (status: string, comment: string) => void;
  request: Request | null;
}

const ALL_STATUSES = [
  "На рассмотрении",
  "В работе",
  "На уточнении",
  "Одобрена",
  "Отклонена",
  "Завершена",
];

export default function StatusUpdateModal({ isOpen, onClose, onSubmit, request }: StatusUpdateModalProps) {
  const [status, setStatus] = useState(request?.status || '');
  const [comment, setComment] = useState('');

  if (!isOpen || !request) {
    return null;
  }
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(status, comment);
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 transition-opacity duration-300"
        onClick={onClose}
    >
      <div 
        className="bg-discord-card rounded-lg shadow-xl p-6 w-full max-w-md transform transition-all duration-300 scale-95 hover:scale-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-discord-text">
                Изменить статус заявки #{request.id}
            </h2>
            <button onClick={onClose} className="text-discord-text-muted hover:text-discord-text transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="status" className="block text-sm font-medium text-discord-text-secondary mb-2">
              Новый статус
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full discord-input"
            >
              {ALL_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="mb-6">
            <label htmlFor="comment" className="block text-sm font-medium text-discord-text-secondary mb-2">
              Комментарий менеджера (необязательно)
            </label>
            <textarea
              id="comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Добавьте пояснение к смене статуса..."
              className="w-full discord-input"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="discord-btn-secondary"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="discord-btn-primary"
            >
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 