import express from "express";
import { register, login, getProfile, refresh, logout } from "./auth.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authLimiter } from "../../middlewares/rateLimiter.middleware.js";

const router = express.Router();

router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", authMiddleware, logout);
router.get("/me", authMiddleware, getProfile);

export default router;