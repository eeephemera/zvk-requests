import { Suspense } from 'react';
import ManagerClient from './ManagerClient';

// Компонент-заглушка (скелетон) для Suspense
const ManagerPageSkeleton = () => (
  <div className="container mx-auto p-4 sm:p-6">
    <div className="bg-discord-card border border-discord-border rounded-lg p-6 w-full mx-auto relative animate-pulse">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center">
          <div className="bg-discord-accent/30 h-8 w-1 rounded-full mr-3"></div>
          <div className="bg-discord-input h-7 w-64 rounded-md"></div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div className="bg-discord-input h-10 w-48 rounded-md"></div>
        <div className="bg-discord-input h-10 w-48 rounded-md"></div>
        <div className="bg-discord-button-primary/30 h-10 w-24 rounded-md"></div>
        <div className="bg-discord-secondary/30 h-10 w-24 rounded-md"></div>
      </div>

      {/* Table Skeleton */}
      <div className="space-y-3">
        {/* Header */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2">
          <div className="col-span-1 bg-discord-input h-4 rounded"></div>
          <div className="col-span-3 bg-discord-input h-4 rounded"></div>
          <div className="col-span-3 bg-discord-input h-4 rounded"></div>
          <div className="col-span-2 bg-discord-input h-4 rounded"></div>
          <div className="col-span-2 bg-discord-input h-4 rounded"></div>
        </div>
        {/* Rows */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-x-4 gap-y-2 items-center p-3 rounded-lg bg-discord-background">
            <div className="col-span-1 bg-discord-input h-5 rounded"></div>
            <div className="col-span-3 bg-discord-input h-5 rounded"></div>
            <div className="col-span-3 bg-discord-input h-5 rounded"></div>
            <div className="col-span-2 bg-discord-input h-5 rounded"></div>
            <div className="col-span-2 bg-discord-input h-5 rounded"></div>
            <div className="col-span-1 bg-discord-input h-5 rounded"></div>
          </div>
        ))}
      </div>

       {/* Pagination Skeleton */}
      <div className="mt-6 flex justify-center items-center gap-4">
        <div className="bg-discord-secondary/30 h-9 w-24 rounded-md"></div>
        <div className="bg-discord-input h-4 w-32 rounded-md"></div>
        <div className="bg-discord-secondary/30 h-9 w-24 rounded-md"></div>
      </div>
    </div>
  </div>
);


export default function ManagerPage() {
  return (
    <Suspense fallback={<ManagerPageSkeleton />}>
      <ManagerClient />
    </Suspense>
  );
}