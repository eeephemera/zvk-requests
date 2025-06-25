import { Suspense } from 'react';
import LoginClient from './LoginClient';

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-discord-card rounded-lg shadow-lg w-full max-w-md p-6">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-discord-accent"></div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <LoginClient />
    </Suspense>
  );
}