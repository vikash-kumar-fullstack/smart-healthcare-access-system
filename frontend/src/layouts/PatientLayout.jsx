import {
  Link,
  Outlet,
  useNavigate,
  useLocation
} from "react-router-dom";

import {
  Menu,
  X
} from "lucide-react";

import {
  useState,
  useEffect
} from "react";

import toast from "react-hot-toast";
import api from "../services/api";

export default function PatientLayout() {

  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed on server", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");

    toast.success("Logged out successfully");
    navigate("/login");
  };

  // 🔥 CLOSE DRAWER ON ROUTE CHANGE
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    {
      name: "Home",
      path: "/patient"
    },
    {
      name: "Queue",
      path: "/patient/queue"
    },
    {
      name: "History",
      path: "/patient/history"
    },
    {
      name: "Notifications",
      path: "/patient/notifications"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 🔥 NAVBAR */}
      <nav className="
        sticky top-0 z-50
        bg-white/80 backdrop-blur-xl
        border-b border-gray-200
        shadow-sm
      ">
        <div className="
          max-w-7xl mx-auto
          px-4 sm:px-6 lg:px-8
        ">
          <div className="
            flex items-center
            justify-between
            h-16
          ">
            {/* 🔥 LOGO */}
            <div className="
              flex items-center gap-3
            ">
              <div className="
                w-10 h-10
                rounded-xl
                bg-blue-500
                text-white
                flex items-center justify-center
                font-bold text-lg
                shadow-md
              ">
                S
              </div>
              <h1 className="
                text-xl md:text-2xl
                font-bold
                text-gray-800
              ">
                Smart Healthcare
              </h1>
            </div>

            {/* 🔥 DESKTOP NAV */}
            <div className="
              hidden md:flex
              items-center gap-2
            ">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`
                    px-4 py-2 rounded-xl
                    text-sm font-medium
                    transition-all duration-200
                    ${
                      location.pathname === link.path
                        ? `
                          bg-blue-500
                          text-white
                          shadow-md
                        `
                        : `
                          text-gray-700
                          hover:bg-gray-100
                        `
                    }
                  `}
                >
                  {link.name}
                </Link>
              ))}

              <button
                onClick={handleLogout}
                className="
                  ml-2
                  bg-red-500 hover:bg-red-600
                  text-white
                  px-4 py-2 rounded-xl
                  text-sm font-medium
                  transition-all duration-200
                  shadow-sm
                "
              >
                Logout
              </button>
            </div>

            {/* 🔥 MOBILE MENU BUTTON */}
            <button
              onClick={() =>
                setMobileMenuOpen(true)
              }
              className="
                md:hidden
                p-2 rounded-lg
                hover:bg-gray-100
                transition
              "
            >
              <Menu className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </div>
      </nav>

      {/* 🔥 MOBILE OVERLAY */}
      <div
        className={`
          fixed inset-0 z-40
          bg-black/40 backdrop-blur-sm
          transition-opacity duration-300
          ${
            mobileMenuOpen
              ? "opacity-100 visible"
              : "opacity-0 invisible"
          }
        `}
        onClick={() =>
          setMobileMenuOpen(false)
        }
      />

      {/* 🔥 MOBILE DRAWER */}
      <div className={`
        fixed top-0 right-0 z-50
        h-full w-70
        bg-white
        shadow-2xl
        transition-transform duration-300
        flex flex-col
        ${
          mobileMenuOpen
            ? "translate-x-0"
            : "translate-x-full"
        }
      `}>
        {/* 🔥 DRAWER TOP */}
        <div className="
          flex items-center justify-end
          p-4 border-b
        ">
          <button
            onClick={() =>
              setMobileMenuOpen(false)
            }
            className="
              p-2 rounded-lg
              hover:bg-gray-100
              transition
            "
          >
            <X className="w-6 h-6 text-gray-700" />
          </button>
        </div>

        {/* 🔥 MOBILE NAV LINKS */}
        <div className="
          flex-1
          p-4
          space-y-2
        ">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`
                block
                px-4 py-3 rounded-xl
                text-sm font-medium
                transition-all duration-200
                ${
                  location.pathname === link.path
                    ? `
                        bg-blue-500
                        text-white
                        shadow-md
                      `
                    : `
                        text-gray-700
                        hover:bg-gray-100
                      `
                }
              `}
            >
              {link.name}
            </Link>
          ))}
        </div>

        {/* 🔥 LOGOUT */}
        <div className="p-4 border-t">
          <button
            onClick={handleLogout}
            className="
              w-full
              bg-red-500 hover:bg-red-600
              text-white
              px-4 py-3 rounded-xl
              text-sm font-medium
              transition-all duration-200
              shadow-sm
            "
          >
            Logout
          </button>
        </div>
      </div>

      {/* 🔥 MAIN CONTENT */}
      <main className="
        max-w-7xl mx-auto
        px-4 sm:px-6 lg:px-8
        py-6
      ">
        <Outlet />
      </main>
    </div>
  );
}
