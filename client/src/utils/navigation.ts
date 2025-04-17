export const getHomepageForRole = (role: string | null): string => {
  switch (role) {
    case "MANAGER":
      return "/manager";
    case "USER":
      return "/my-requests";
    default:
      console.warn(`getHomepageForRole: Unknown or null role "${role}", defaulting to /login`);
      return "/login";
  }
}; 