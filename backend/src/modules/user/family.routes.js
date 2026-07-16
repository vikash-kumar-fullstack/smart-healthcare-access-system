import express from "express";
import {
  getMembers,
  addMember,
  acceptInvite,
  declineInvite,
  deleteMember,
  revokeSpouse
} from "./family.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { familyRateLimiter } from "../../middlewares/rate-limit.middleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(familyRateLimiter);

router.get("/", getMembers);
router.post("/", addMember);
router.post("/invitations/:token/accept", acceptInvite);
router.post("/invitations/:token/decline", declineInvite);
router.delete("/members/:relativeId", deleteMember);
router.post("/members/:relativeId/revoke", revokeSpouse);

export default router;
