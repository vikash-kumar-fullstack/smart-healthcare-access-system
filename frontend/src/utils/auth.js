const adminRoles = new Set(["admin", "super_admin", "district_admin", "hospital_admin"]);

export const getDashboardPath = (role) => {
  if (role === "doctor") return "/doctor";
  if (role === "patient") return "/patient";
  if (role === "receptionist") return "/reception";
  if (adminRoles.has(role)) return "/admin";
  return "/login";
};

export const clearSession = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("role");
};

