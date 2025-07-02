"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/services/apiClient';
import { Request, Partner, EndClient, User, downloadFileById } from '@/services/requestService'; 
import { getStatusColor } from '../../../utils/statusUtils';
import { formatDate } from '../../../utils/formatters';

// Вспомогательный компонент для отображения деталей
interface DetailItemProps {
    label: string;
    value?: string | number | null;
}

const DetailItem: React.FC<DetailItemProps> = ({ label, value }) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    return (
        <div className="flex justify-between items-center py-1.5 text-sm even:bg-discord-dark-hover/30 px-2 rounded-md">
            <span className="text-discord-text-muted font-medium">{label}:</span>
            <span className="text-discord-text text-right">{value ?? '–'}</span>
        </div>
    );
};


// Основной компонент страницы
export default function RequestDetailsPage() {
    const params = useParams();
    const id = params.id;

    const [request, setRequest] = useState<Request | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloadingFileId, setDownloadingFileId] = useState<number | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const handleDownload = async (fileId: number) => {
        if (downloadingFileId) return;

        setDownloadingFileId(fileId);
        setDownloadError(null);
        try {
            const { blob, filename } = await downloadFileById(fileId);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setDownloadError(err.message || 'Не удалось скачать файл.');
            console.error(err);
        } finally {
            setDownloadingFileId(null);
        }
    };

    useEffect(() => {
        if (id) {
            const fetchRequestDetails = async () => {
                setLoading(true);
                setError(null);
                try {
                    // Исправляем URL, чтобы он соответствовал API сервера для роута пользователя
                    const data = await apiClient.get<Request>(`/api/requests/my/${id}`);
                    setRequest(data);
                } catch (err: any) {
                    if (err.status === 404) {
                         setError('Заявка с таким ID не найдена или у вас нет к ней доступа.');
                    } else {
                         setError(err.message || 'Не удалось загрузить данные заявки.');
                    }
                    console.error(err);
                } finally {
                    setLoading(false);
                }
            };
            fetchRequestDetails();
        }
    }, [id]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-discord-background">
                <div className="animate-spin w-10 h-10 border-4 border-discord-accent rounded-full border-t-transparent"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-discord-background text-discord-text">
                <p className="text-discord-danger mb-4">{error}</p>
                <Link href="/my-requests" className="discord-btn-primary">
                    Вернуться к списку
                </Link>
            </div>
        );
    }
    
    if (!request) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-discord-background text-discord-text">
                <p className="mb-4">Заявка не найдена.</p>
                <Link href="/my-requests" className="discord-btn-primary">
                    Вернуться к списку
                </Link>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-discord-background p-4 sm:p-6 md:p-8">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                        <span className="bg-discord-accent h-8 w-1 rounded-full mr-3"></span>
                        <h1 className="text-2xl font-bold text-discord-text">
                            Заявка #{request.id}
                        </h1>
                    </div>
                     <Link href="/my-requests" className="discord-btn-secondary transition-colors duration-200">
                        ← К списку регистраций
                    </Link>
                </div>
                
                {/* Main content card */}
                <div className="bg-discord-card border border-discord-border rounded-lg p-6 space-y-6">
                    {/* Project Details Section */}
                    <div className="border border-discord-border p-4 rounded-lg bg-discord-background space-y-2">
                        <h3 className="text-lg font-semibold text-discord-text mb-2">Детали проекта</h3>
                        <DetailItem label="Название проекта" value={request.project_name} />
                        <DetailItem label="Количество" value={request.quantity} />
                        <DetailItem label="Цена за ед." value={request.unit_price ? parseFloat(request.unit_price).toFixed(2) : null} />
                        <DetailItem label="Описание/ТЗ" value={request.deal_state_description} />
                    </div>

                    {/* Partner Details Section */}
                    <div className="border border-discord-border p-4 rounded-lg bg-discord-background space-y-2">
                        <h3 className="text-lg font-semibold text-discord-text mb-2">Партнер</h3>
                        <DetailItem label="Название" value={request.partner?.name} />
                        <DetailItem label="ИНН" value={request.partner?.inn} />
                        <DetailItem label="Контакт (override)" value={request.partner_contact_override} />
                        <DetailItem label="Деятельность партнера" value={request.partner_activities} />
                    </div>

                    {/* End Client Details Section */}
                    <div className="border border-discord-border p-4 rounded-lg bg-discord-background space-y-2">
                        <h3 className="text-lg font-semibold text-discord-text mb-2">Конечный клиент</h3>
                        <DetailItem label="Название" value={request.end_client?.name ?? request.end_client_details_override} />
                        <DetailItem label="ИНН" value={request.end_client?.inn} />
                        <DetailItem label="Город" value={request.end_client?.city} />
                    </div>

                    {/* Deal & Status Section */}
                    <div className="border border-discord-border p-4 rounded-lg bg-discord-background space-y-2">
                        <h3 className="text-lg font-semibold text-discord-text mb-2">Параметры и Статус</h3>
                        <DetailItem label="Закон" value={request.fz_law_type} />
                        <DetailItem label="Реестр МПТ" value={request.mpt_registry_type} />
                        <DetailItem label="Дата закрытия" value={request.estimated_close_date ? formatDate(request.estimated_close_date) : null} />
                        <div className="flex justify-between items-center py-1.5 px-2">
                            <span className="text-discord-text-muted font-medium text-sm">Текущий статус:</span>
                            <span className={`px-3 py-1 text-sm rounded-full font-semibold ${getStatusColor(request.status)}`}>
                                {request.status}
                            </span>
                        </div>
                        <DetailItem label="Комментарий менеджера" value={request.manager_comment} />
                    </div>

                    {/* File Download Section */}
                    {request.files && request.files.length > 0 && (
                        <div className="border border-discord-border p-4 rounded-lg bg-discord-background space-y-3">
                            <h3 className="text-lg font-semibold text-discord-text mb-2">Приложенные файлы</h3>
                            {request.files.map(file => (
                                <div key={file.id} className="flex items-center justify-between p-2 rounded-md bg-discord-input hover:bg-discord-border">
                                    <div>
                                        <p className="text-discord-text font-medium text-sm">{file.file_name}</p>
                                        <p className="text-xs text-discord-text-muted">Размер: {Math.round(file.file_size / 1024)} KB</p>
                                    </div>
                                    <button 
                                        onClick={() => handleDownload(file.id)} 
                                        disabled={downloadingFileId === file.id} 
                                        className="discord-btn-secondary transition-colors duration-200"
                                    >
                                        {downloadingFileId === file.id ? 'Скачивание...' : 'Скачать'}
                                    </button>
                                </div>
                            ))}
                            {downloadError && <p className="text-discord-danger text-sm mt-2">{downloadError}</p>}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
} 