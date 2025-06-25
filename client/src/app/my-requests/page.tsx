import { Suspense } from 'react';
import MyRequestsClient from './MyRequestsClient';

function LoadingFallback() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 border-2 border-discord-accent border-t-transparent rounded-full animate-spin"></div>
      <p className="text-discord-text-muted mt-4">Загрузка заявок...</p>
    </div>
  );
}

export default function MyRequestsPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MyRequestsClient />
    </Suspense>
  );
}
