import { apiClient, PaginatedResponse } from './apiClient';

export interface Request {
  partner: {
    id: number;
    name: string;
    inn?: string;
  };
  product?: {
    id: number;
    name: string;
  };
  end_client?: {
    id: number;
    name: string;
  };
  id: number;
  partner_id: number;
  product_id?: number;
  end_client_id?: number;
  status: string;
  created_at: string;
  updated_at: string;
  attachments?: string[];
  fz_type?: string;
  registry_type?: string;
  comment?: string;
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
  productId?: number | null;
  customItemSku?: string;
  customItemName?: string;
  customItemDescription?: string;
  quantity?: number | null;
  unitPrice?: number | null;
  dealDescription: string;
  estimatedCloseDate?: string | null;
  fzLawType?: string;
  mptRegistryType?: string;
  partnerActivities?: string;
  partnerContactOverride?: string;
  attachmentFile?: File | null;
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

export async function downloadRequestFile(requestId: number): Promise<FileDownloadResponse> {
  const response = await fetch(`/api/requests/${requestId}/download`, {
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
  const filenameMatch = contentDisposition?.match(/filename=\"?(.+?)\"?$/);
  const filename = filenameMatch ? filenameMatch[1] : 'download';

  const blob = await response.blob();
  return { blob, filename };
}

export async function submitDealRegistration(data: DealRegistrationData): Promise<Request> {
  const formData = new FormData();

  // 1. Собрать данные для JSON
  const requestData: { [key: string]: string | number | boolean | undefined | null | Array<object> } = {};
  Object.entries(data).forEach(([key, value]) => {
    // Пропускаем поле файла и null/undefined значения
    if (key !== 'attachmentFile' && value !== null && value !== undefined) {
        // Преобразуем ключи в snake_case для соответствия серверному DTO
        const snakeCaseKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        requestData[snakeCaseKey] = value;
    }
  });

  // Переименовываем ключи, если они не совпадают с серверным DTO после простого snake_case
  if (requestData.deal_description) {
      requestData.deal_state_description = requestData.deal_description;
      delete requestData.deal_description;
  }
  // Пример: Если нужно отправить один товар как массив items:
  if (requestData.product_id || requestData.custom_item_sku) {
      requestData.items = [{
          product_id: requestData.product_id,
          custom_item_sku: requestData.custom_item_sku,
          custom_item_name: requestData.custom_item_name,
          custom_item_description: requestData.custom_item_description,
          quantity: requestData.quantity,
          unit_price: requestData.unit_price,
      }];
      // Удаляем отдельные поля товара из корня DTO
      delete requestData.product_id;
      delete requestData.custom_item_sku;
      delete requestData.custom_item_name;
      delete requestData.custom_item_description;
      delete requestData.quantity;
      delete requestData.unit_price;
  }


  // 2. Преобразовать в JSON и добавить в FormData
  formData.append('request_data', JSON.stringify(requestData));

  // 3. Добавить файл (если есть) с правильным именем поля
  if (data.attachmentFile) {
    formData.append('overall_tz_file', data.attachmentFile); // Используем имя поля 'overall_tz_file'
  }

  // 4. Отправить запрос
  return apiClient.post<Request>('/api/requests', formData);
}