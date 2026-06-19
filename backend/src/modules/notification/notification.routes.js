import express from "express";
import { getAll, getUnreadCount, read, readAll, archive, syncNotifications, updatePreferences } from "./notification.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getAll);
router.get("/unread", authMiddleware, getUnreadCount);
router.get("/sync", authMiddleware, syncNotifications);
router.patch("/preferences", authMiddleware, updatePreferences);
router.patch("/read-all", authMiddleware, readAll);
router.patch("/:id/read", authMiddleware, read);
router.patch("/:id/archive", authMiddleware, archive);

export default router;