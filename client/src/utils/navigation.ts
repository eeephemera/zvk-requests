export const getHomepageForRole = (role: string | null): string => {
  if (!role) {
    console.warn(`getHomepageForRole: Null role provided, defaulting to /login`);
    return "/login";
  }
  
  // Normalize role to uppercase for consistent comparison
  const normalizedRole = role.toUpperCase();
  
  if (normalizedRole === "MANAGER" || normalizedRole === "МЕНЕДЖЕР") {
    return "/manager";
  }
  
  if (normalizedRole === "USER" || normalizedRole === "ПОЛЬЗОВАТЕЛЬ") {
    return "/my-requests";
  }
  
  console.warn(`getHomepageForRole: Unknown role "${role}", defaulting to /login`);
  return "/login";
}; 