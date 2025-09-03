"use client";

import { useState } from "react";
import { fetchBlobWithFilename } from "@/services/apiClient";
import { getQuickFilesAction, downloadAllFiles } from "@/services/managerRequestService";

type FilesCacheItem = { loading: boolean; files?: Array<{ id: number; file_name: string }>; error?: string };

export function useFilesMenu() {
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [filesCache, setFilesCache] = useState<Record<number, FilesCacheItem>>({});

  const toggleFilesMenu = async (requestId: number) => {
    if (openMenuId === requestId) {
      setOpenMenuId(null);
      return;
    }
    setFilesCache(prev => ({ ...prev, [requestId]: prev[requestId] || { loading: true } }));
    try {
      const action = await getQuickFilesAction(requestId);
      if (action.type === 'single') {
        if (action.file.id) {
          await handleDownloadFile(action.file.id, action.file.file_name);
        }
        setOpenMenuId(null);
        setFilesCache(prev => ({ ...prev, [requestId]: { loading: false, files: action.file.id ? [{ id: action.file.id, file_name: action.file.file_name }] : [] } }));
      } else {
        setOpenMenuId(requestId);
        setFilesCache(prev => ({ ...prev, [requestId]: { loading: false, files: action.files } }));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Ошибка загрузки файлов';
      setFilesCache(prev => ({ ...prev, [requestId]: { loading: false, error: message } }));
    }
  };

  const handleDownloadAll = async (requestId: number) => {
    await downloadAllFiles(requestId);
  };

  const handleDownloadFile = async (fileId: number, fallbackName?: string) => {
    const { blob, filename } = await fetchBlobWithFilename(`/api/manager/requests/files/${fileId}`);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || fallbackName || `file-${fileId}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return { openMenuId, filesCache, toggleFilesMenu, handleDownloadAll, handleDownloadFile, setOpenMenuId };
}


