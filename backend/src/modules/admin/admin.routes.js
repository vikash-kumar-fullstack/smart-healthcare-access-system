import express from "express";
import { dashboard } from "./admin.controller.js";
import { adminRetry } from "../notification/notification.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import adminMiddleware from "../../middlewares/admin.middleware.js";

const router = express.Router();

router.get("/dashboard", authMiddleware, adminMiddleware, dashboard);
router.post("/retry", authMiddleware, adminMiddleware, adminRetry);

export default router;