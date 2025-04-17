"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getHomepageForRole } from "@/utils/navigation";
import LoadingSpinner from "@/components/LoadingSpinner"; // Assume spinner exists

// Эта страница будет вести себя как защищенная, но логика редиректа
// будет внутри ProtectedRoute, который вызовет getHomepageForRole

export default function HomePage() {
  const { loading, isAuthenticated, userRole } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait until the auth state is determined
    if (loading) {
      return;
    }

    // If loading is finished:
    if (isAuthenticated) {
      // User is logged in, redirect to their specific homepage
      const targetPath = getHomepageForRole(userRole);
      router.replace(targetPath);
    } else {
      // User is not logged in, redirect to login page
      router.replace('/login');
    }
  }, [loading, isAuthenticated, userRole, router]); // Dependencies for the effect

  // Show a loading indicator while the authentication check is in progress
  // and the redirect effect hasn't run yet.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-discord-background">
      <LoadingSpinner />
      <p className="text-discord-text-muted mt-4">Загрузка...</p> 
      {/* This text might only flash briefly before redirect */}
    </div>
  );
}