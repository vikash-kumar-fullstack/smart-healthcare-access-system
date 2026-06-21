import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  role
}) {

  const token = localStorage.getItem("token");
  const userRole = localStorage.getItem("role");

  // Not logged in
  if (!token) {
    return <Navigate to="/login" replace />;
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