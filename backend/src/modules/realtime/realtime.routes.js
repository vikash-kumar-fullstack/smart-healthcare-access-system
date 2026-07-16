import express from "express";
import authMiddleware from "../../middlewares/auth.middleware.js";
import adminMiddleware from "../../middlewares/admin.middleware.js";
import { getSyncEvents } from "./sync.service.js";
import { getOnlineDoctors } from "./presence.service.js";

const router = express.Router();

// GET /api/v1/realtime/sync?afterSequence=N&limit=L
router.get("/sync", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { afterSequence, limit } = req.query;

    const result = await getSyncEvents(userId, afterSequence, limit);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/realtime/presence
router.get("/presence", authMiddleware, adminMiddleware, async (req, res, next) => {
  try {
    const doctors = await getOnlineDoctors();
    return res.json({
      success: true,
      doctors
    });
  } catch (err) {
    next(err);
  }
});

export default router;
