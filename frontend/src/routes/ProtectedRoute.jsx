import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  role
}) {

  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  const userRole = localStorage.getItem("role");

  const isAuthenticated = token || userStr;

  // Not logged in
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Complete profile check for patients
  if (userRole === "patient") {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      if (!user.profileCompleted && window.location.pathname !== "/complete-profile") {
        return <Navigate to="/complete-profile" replace />;
      }
    } catch (e) {
      console.error("Error reading complete profile state", e);
    }
  }

  const isAdminRole = (r) => ["admin", "super_admin", "district_admin", "hospital_admin"].includes(r);

  // Wrong role
  if (role) {
    const roleMatch = (role === "admin" && isAdminRole(userRole)) || userRole === role;
    if (!roleMatch) {
      if (userRole === "doctor") {
        return <Navigate to="/doctor" replace />;
      }

      if (userRole === "patient") {
        return <Navigate to="/patient" replace />;
      }

      if (isAdminRole(userRole)) {
        return <Navigate to="/admin" replace />;
      }

      return <Navigate to="/login" replace />;
    }
  }

  return children;
}