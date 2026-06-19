import express from "express";
import { listDoctors, createDoctor,updateDoctor,toggleDoctor, getProfile, completeProfile, updateSettings, getAnalytics, rebuildAnalytics } from "./doctor.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import adminMiddleware from "../../middlewares/admin.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";


const router = express.Router();

router.get("/", listDoctors);
router.post("/", authMiddleware, adminMiddleware, createDoctor);
router.put("/:id", authMiddleware, adminMiddleware, updateDoctor);
router.patch("/:id/toggle", authMiddleware, adminMiddleware, toggleDoctor);

router.get("/profile", authMiddleware, authorizeRoles("doctor"), getProfile);
router.post("/profile/complete", authMiddleware, authorizeRoles("doctor"), completeProfile);
router.patch("/profile/settings", authMiddleware, authorizeRoles("doctor"), updateSettings);
router.get("/profile/analytics", authMiddleware, authorizeRoles("doctor"), getAnalytics);
router.post("/profile/analytics/rebuild", authMiddleware, authorizeRoles("admin"), rebuildAnalytics);

export default router;