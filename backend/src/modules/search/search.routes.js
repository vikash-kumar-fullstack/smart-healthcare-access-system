import express from "express";
import {
  search,
  getSuggestions,
  getSearchHistory,
  getSearchAnalytics,
  recordSearchAction
} from "./search.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, search);
router.get("/suggestions", getSuggestions);
router.get("/history", authMiddleware, getSearchHistory);
router.get("/analytics", authMiddleware, getSearchAnalytics);
router.post("/analytics/action", authMiddleware, recordSearchAction);

export default router;
