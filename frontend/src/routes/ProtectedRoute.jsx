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

  // Wrong role
  if (role && userRole !== role) {

    if (userRole === "doctor") {
      return <Navigate to="/doctor" replace />;
    }

    if (userRole === "patient") {
      return <Navigate to="/patient" replace />;
    }

    return <Navigate to="/login" replace />;
  }

  return children;
}