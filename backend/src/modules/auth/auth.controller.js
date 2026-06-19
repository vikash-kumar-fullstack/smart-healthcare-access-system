import { registerUser, loginUser, getMe, refreshUserToken, logoutUser } from "./auth.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import { registerSchema,loginSchema } from "./auth.validation.js";



export const register = asyncHandler(async (req, res) => {

  const result = registerSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message
    });
  }

  const user = await registerUser(result.data);

  return successResponse(res, user, "User registered successfully");
});


export const login = asyncHandler(async (req, res) => {
  const result = loginSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message
    });
  }

  const { user, token, refreshToken, role } = await loginUser(result.data);

  return successResponse(
    res,
    { user, token, refreshToken, role },
    "Login successful"
  );
});


export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "Refresh token is required"
    });
  }

  try {
    const tokens = await refreshUserToken(refreshToken);
    return successResponse(res, tokens, "Token refreshed successfully");
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: err.message || "Invalid refresh token"
    });
  }
});


export const logout = asyncHandler(async (req, res) => {
  await logoutUser(req.user.userId);
  return successResponse(res, null, "Logged out successfully");
});


export const getProfile = asyncHandler(async (req, res) => {

  const user = await getMe(req.user.userId);

  return successResponse(res, user, "User fetched successfully");
});
