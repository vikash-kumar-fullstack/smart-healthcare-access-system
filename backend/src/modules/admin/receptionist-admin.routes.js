import express from "express";
import {
  listReceptionists,
  createReceptionist,
  updateReceptionistStatus,
  updateReceptionistShift,
  forcePasswordReset
} from "./receptionist-admin.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";
import attachHospitalScope from "../../middlewares/hospitalScope.middleware.js";

const router = express.Router();

// All routes require hospital admin authorization and scoping
router.use(authMiddleware);
router.use(authorizeRoles("hospital_admin"));
router.use(attachHospitalScope);

router.get("/", listReceptionists);
router.post("/", createReceptionist);
router.patch("/:id/status", updateReceptionistStatus);
router.patch("/:id/shift", updateReceptionistShift);
router.post("/:id/force-password-reset", forcePasswordReset);

export default router;
