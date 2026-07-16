import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { getDashboardPath } from "../utils/auth";

export default function OAuthSuccess() {
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserAndRedirect = async () => {
      const t = toast.loading("Finalizing your sign in...");
      try {
        // Retrieve profile details from backend HttpOnly session cookies
        const res = await api.get("/auth/me");
        const user = res.data.data;
        const { role, profileCompleted } = user;

        // Clear local storage JWT tokens since we use HttpOnly cookies for Google OAuth
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        
        localStorage.setItem("role", role);
        localStorage.setItem("user", JSON.stringify(user));

        toast.success("Successfully authenticated with Google!", { id: t });

        if (role === "patient" && !profileCompleted) {
          navigate("/complete-profile", { replace: true });
        } else {
          navigate(getDashboardPath(role), { replace: true });
        }
      } catch (err) {
        toast.error("Failed to retrieve user profile.", { id: t });
        navigate("/login", { replace: true });
      }
    };

    fetchUserAndRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#0E7490]" />
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg">Finishing Sign In</h3>
          <p className="text-xs text-slate-500 mt-1">Retrieving your secure profile from Google...</p>
        </div>
      </div>
    </div>
  );
}
