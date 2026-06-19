import { Link, Outlet, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function DoctorLayout() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed on server:", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");

    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navbar */}
      <nav className="
        bg-white shadow px-4 py-4
        flex flex-col md:flex-row
        md:justify-between
        md:items-center
        gap-4
      ">
        <h1 className="text-xl font-bold text-blue-600">
          Doctor Panel
        </h1>

        <div className="flex gap-3 flex-wrap">
          <Link
            to="/doctor"
            className="text-gray-700 hover:text-blue-500"
          >
            Dashboard
          </Link>

          <Link
            to="/doctor/analytics"
            className="text-gray-700 hover:text-blue-500"
          >
            Analytics
          </Link>

          <button
            onClick={handleLogout}
            className="
              bg-red-500 hover:bg-red-600
              transition text-white px-3 py-1 rounded
            "
          >
            Logout
          </button>
        </div>
      </nav>

      {/* Main */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
