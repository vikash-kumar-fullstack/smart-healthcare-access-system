import express from "express";
import {
  getReceptionDashboard,
  getReceptionDoctors,
  registerWalkIn,
  checkInAppointment,
  transferAppointment,
  overrideAppointment,
  getReceptionistProfile
} from "./reception.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import { authorizeRoles } from "../../middlewares/authorize.middleware.js";
import attachHospitalScope from "../../middlewares/hospitalScope.middleware.js";

const router = express.Router();

// Enforce receptionist access rules and resolve hospital scopes
router.use(authMiddleware);
router.use(authorizeRoles("receptionist", "admin"));
router.use(attachHospitalScope);

router.get("/profile", getReceptionistProfile);
router.get("/dashboard", getReceptionDashboard);
router.get("/doctors", getReceptionDoctors);
router.post("/walkin", registerWalkIn);
router.post("/checkin", checkInAppointment);
router.post("/transfer", transferAppointment);
router.post("/override", overrideAppointment);

export default router;
