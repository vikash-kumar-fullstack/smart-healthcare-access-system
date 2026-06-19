import express from "express";
import { listHospitals,createHospital,updateHospital,disableHospital } from "./hospital.controller.js";
import authMiddleware from "../../middlewares/auth.middleware.js";
import adminMiddleware from "../../middlewares/admin.middleware.js";
const router = express.Router();

router.get("/", listHospitals);
router.post("/", authMiddleware, adminMiddleware, createHospital);
router.put("/:id", authMiddleware, adminMiddleware, updateHospital);
router.patch("/:id/disable", authMiddleware, adminMiddleware, disableHospital);


export default router;