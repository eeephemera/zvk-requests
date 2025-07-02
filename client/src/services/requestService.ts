import { apiClient, PaginatedResponse } from './apiClient';

export interface Partner {
  id: number;
  name: string;
  address?: string;
  inn?: string;
  partner_status?: string;
  assigned_manager_id?: number;
  created_at: string;
  updated_at: string;
  overall_tz_file?: FileInfo;
  project_name?: string;
  quantity?: number;
  unit_price?: string;
  total_price?: string;
}

export interface EndClient {
  id: number;
  name: string;
  city?: string;
  inn?: string;
  full_address?: string;
  contact_person_details?: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  item_type: string;
  unit_price?: number;
  created_at: string;
  updated_at: string;
}

export interface RequestItem {
    id: number;
    request_id: number;
    product_id?: number;
    custom_item_sku?: string;
    custom_item_name?: string;
    custom_item_description?: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    product?: Product;
}

export interface User {
    id: number;
    login: string;
    name?: string;
    email?: string;
    phone?: string;
    role: 'USER' | 'MANAGER';
    partner_id?: number;
    created_at: string;
}

export interface FileInfo {
  id: number;
  file_name: string;
  mime_type: string;
  file_size: number;
  created_at: string;
}

export interface Request {
  id: number;
  partner_user_id: number;
  partner_id: number;
  end_client_id?: number;
  end_client_details_override?: string;
  distributor_id?: number;
  partner_contact_override?: string;
  fz_law_type?: string;
  mpt_registry_type?: string;
  partner_activities?: string;
  deal_state_description?: string;
  estimated_close_date?: string;
  status: string;
  manager_comment?: string;
  overall_tz_file_id?: number;
  created_at: string;
  updated_at: string;
  
  // Новые поля
  project_name?: string;
  quantity?: number;
  unit_price?: string; // Приходит как строка
  total_price?: string; // Приходит как строка

  // Связанные данные (вложенные объекты)
  partner?: Partner;
  end_client?: EndClient;
  distributor?: Partner; // Дистрибьютор - это тоже партнер
  user?: User;
  items?: RequestItem[];
  overall_tz_file?: FileInfo;
  files?: FileInfo[]; // Новое поле для массива файлов
}

export interface RequestQueryParams {
  status?: string;
  organization?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  page?: number;
  perPage?: number;
}

export interface DealRegistrationData {
  partnerId: number;
  distributorId?: number | null;
  endClientId?: number | null;
  endClientInn?: string;
  endClientName?: string;
  endClientCity?: string;
  endClientFullAddress?: string;
  endClientContactDetails?: string;
  endClientDetailsOverride?: string;
  quantity?: number | null;
  unitPrice?: number | null;
  projectName?: string;
  dealDescription: string;
  estimatedCloseDate?: string | null;
  fzLawType?: string;
  mptRegistryType?: string;
  partnerActivities?: string;
  partnerContactOverride?: string;
  attachmentFiles?: File[] | null;
  onUploadProgress?: (progress: number) => void;
}

export interface FileDownloadResponse {
  blob: Blob;
  filename: string;
}

export async function getUserRequests(
  page: number = 1,
  perPage: number = 10
): Promise<PaginatedResponse<Request>> {
  return apiClient.get<PaginatedResponse<Request>>(`/api/requests/my?page=${page}&per_page=${perPage}`);
}

export async function downloadFileById(fileID: number): Promise<FileDownloadResponse> {
  const response = await fetch(`/api/requests/files/${fileID}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    let errorMessage = 'Failed to download file';
    try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
    } catch {
        // Игнорируем ошибку парсинга тела, используем стандартное сообщение
    }
    throw new Error(`HTTP error! status: ${response.status}, message: ${errorMessage}`);
  }

  const contentDisposition = response.headers.get('content-disposition');
  let filename = 'download'; // Имя по умолчанию

  if (contentDisposition) {
    // Сначала ищем современный формат RFC 5987 (filename*=UTF-8''...)
    const rfc5987match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (rfc5987match && rfc5987match[1]) {
      filename = decodeURIComponent(rfc5987match[1]);
    } else {
      // Если не нашли, ищем старый формат (filename="...")
      const plainMatch = /filename="?([^"]+)"?/.exec(contentDisposition);
      if (plainMatch && plainMatch[1]) {
        filename = plainMatch[1]; // Этот вариант может неверно обрабатывать кириллицу в некоторых браузерах
      }
    }
  }

  const blob = await response.blob();
  return { blob, filename };
}

export async function submitDealRegistration(data: DealRegistrationData): Promise<Request> {
  const formData = new FormData();

  // 1. Извлекаем массив файлов и колбэк из данных
  const { attachmentFiles, onUploadProgress, ...formDataWithoutFile } = data;

  // 2. Создаем объект JSON для поля 'request_data'
  const requestDataForJson = {
    // Поля конечного клиента
    end_client_inn: formDataWithoutFile.endClientInn || "",
    end_client_name: formDataWithoutFile.endClientName || "",
    end_client_city: formDataWithoutFile.endClientCity || "",
    end_client_full_address: formDataWithoutFile.endClientFullAddress || "",
    end_client_contact_details: formDataWithoutFile.endClientContactDetails || "",
    end_client_details_override: formDataWithoutFile.endClientDetailsOverride || "",
    // Поля заявки
    distributor_id: formDataWithoutFile.distributorId,
    partner_contact_override: formDataWithoutFile.partnerContactOverride || "",
    fz_law_type: formDataWithoutFile.fzLawType || "",
    mpt_registry_type: formDataWithoutFile.mptRegistryType || "",
    partner_activities: formDataWithoutFile.partnerActivities || "",
    deal_state_description: formDataWithoutFile.dealDescription || "", // dealDescription из формы мапится сюда
    estimated_close_date: formDataWithoutFile.estimatedCloseDate || "",
    project_name: formDataWithoutFile.projectName || "",
    quantity: formDataWithoutFile.quantity,
    unit_price: (typeof formDataWithoutFile.unitPrice === 'number' && isFinite(formDataWithoutFile.unitPrice)) 
      ? formDataWithoutFile.unitPrice.toString() 
      : "",
  };

  // 3. Добавляем JSON как текстовое поле
  formData.append('request_data', JSON.stringify(requestDataForJson));

  // 4. Добавляем каждый файл в FormData
  if (attachmentFiles && attachmentFiles.length > 0) {
    attachmentFiles.forEach(file => {
      // Важно: имя поля 'overall_tz_files[]' с квадратными скобками, чтобы Go понял, что это массив
      formData.append('overall_tz_files[]', file, file.name);
    });
  }

  // 5. Отправляем на сервер, передавая колбэк в apiClient
  return apiClient.post<Request>('/api/requests', formData, {}, onUploadProgress);
}