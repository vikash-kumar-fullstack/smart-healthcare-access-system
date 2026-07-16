import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { clearSession, getDashboardPath } from "../utils/auth";

export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state") || "google";

    if (!code) {
      toast.error("OAuth authorization code was not found.");
      navigate("/login", { replace: true });
      return;
    }

    const exchangeCode = async () => {
      const codeVerifier = localStorage.getItem("oauth_code_verifier") || "";
      const isSignupMode = localStorage.getItem("oauth_signup_mode") === "true";

      const t = toast.loading("Exchanging credentials with Google...");
      try {
        const lowerEmail = code.toLowerCase();
        const isStaffPattern = lowerEmail.includes("doctor") || lowerEmail.includes("admin") || lowerEmail.includes("hospital") || lowerEmail.includes("receptionist");

        const res = await api.post("/auth/social-login", {
          code,
          provider: state,
          codeVerifier,
          registerIfNew: isStaffPattern ? false : isSignupMode
        });

        const { token, refreshToken, role, user, profileCompleted } = res.data.data;

        clearSession();
        localStorage.setItem("token", token);
        if (refreshToken) {
          localStorage.setItem("refreshToken", refreshToken);
        }
        localStorage.setItem("role", role);
        localStorage.setItem("user", JSON.stringify(user));

        // Clear OAuth cache
        localStorage.removeItem("oauth_code_verifier");
        localStorage.removeItem("oauth_signup_mode");

        toast.success("Successfully authenticated with Google!", { id: t });

        if (role === "patient" && !profileCompleted) {
          navigate("/complete-profile", { replace: true });
        } else {
          navigate(getDashboardPath(role), { replace: true });
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Google authentication failed.", { id: t });
        navigate("/login", { replace: true });
      }
    };

    exchangeCode();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 text-slate-800 p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl p-8 max-w-sm w-full text-center flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-[#0E7490]" />
        <div>
          <h3 className="font-extrabold text-slate-800 text-lg">One moment please</h3>
          <p className="text-xs text-slate-500 mt-1">Completing secure authentication with Google...</p>
        </div>
      </div>
    </div>
  );
}
