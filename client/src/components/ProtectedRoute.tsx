"use client";

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import AccessDenied from "./AccessDenied";
import { getHomepageForRole } from "@/utils/navigation";

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: string[];
  redirectIfNotAllowed?: boolean;
  isPublicPage?: boolean;
};

const ProtectedRoute = ({
  children,
  allowedRoles = [],
  redirectIfNotAllowed = true,
  isPublicPage = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, userRole, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (isPublicPage) return;

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (isAuthenticated) {
      if (isPublicPage) {
        const userHomepage = getHomepageForRole(userRole);
        router.replace(userHomepage);
        return;
      }

      if (allowedRoles.length > 0 && userRole) {
        if (!allowedRoles.includes(userRole)) {
          if (redirectIfNotAllowed) {
            const userHomepage = getHomepageForRole(userRole);
            router.replace(userHomepage);
          }
        }
      }
    }

  }, [isAuthenticated, userRole, loading, router, allowedRoles, redirectIfNotAllowed, isPublicPage, pathname]);
  if (loading) {
    return <div>Loading...</div>;
  }

  if (isPublicPage && !isAuthenticated) {
    return <>{children}</>;
  }

  if (!isPublicPage && isAuthenticated && (allowedRoles.length === 0 || (userRole && allowedRoles.includes(userRole)))) {
    return <>{children}</>;
  }

  return null;
};

export default ProtectedRoute; 