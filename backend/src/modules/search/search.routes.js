import express from "express";
import { search } from "./search.controller.js";

const router = express.Router();

router.post("/symptom", search);

export default router;