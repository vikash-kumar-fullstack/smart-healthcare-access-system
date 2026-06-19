import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import { getDashboardAnalytics } from "./admin.service.js";

export const dashboard = asyncHandler(async (req, res) => {

  const data = await getDashboardAnalytics();

  return successResponse(res, data, "Dashboard analytics fetched");
});