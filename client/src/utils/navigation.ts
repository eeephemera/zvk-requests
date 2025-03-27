export const getHomepageForRole = (role: string | null): string => {
  switch (role) {
    case "Менеджер":
      return "/manager";
    case "Пользователь":
      return "/requests";
    default:
      return "/login";
  }
}; 