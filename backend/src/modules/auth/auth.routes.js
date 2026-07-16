import express from "express";
import { register, login, getProfile, updateProfile, refresh, logout, socialLogin, linkProvider, unlinkProvider, completeProfile, getSessions, revokeSession, revokeAllSessions, initiatePatientGoogle, initiateDoctorGoogle, initiateHospitalGoogle, handleGoogleCallback } from "./auth.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { loginRateLimiter, registerRateLimiter } from "../../middlewares/rate-limit.middleware.js";

const router = express.Router();

router.get("/patient/google", initiatePatientGoogle);
router.get("/doctor/google", initiateDoctorGoogle);
router.get("/hospital/google", initiateHospitalGoogle);
router.get("/google/callback", handleGoogleCallback);

router.post("/register", registerRateLimiter, register);
router.post("/login", loginRateLimiter, login);
router.post("/social-login", loginRateLimiter, socialLogin);
router.get("/config", (req, res) => {
  res.json({
    success: true,
    data: {
      googleClientId: process.env.GOOGLE_CLIENT_ID || ""
    }
  });
});
router.post("/refresh", refresh);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getProfile);
router.put("/me", authMiddleware, updateProfile);

router.post("/complete-profile", authMiddleware, completeProfile);
router.post("/link-provider", authMiddleware, linkProvider);
router.delete("/unlink-provider", authMiddleware, unlinkProvider);

router.get("/sessions", authMiddleware, getSessions);
router.delete("/sessions/:id", authMiddleware, revokeSession);
router.delete("/sessions", authMiddleware, revokeAllSessions);

export default router;