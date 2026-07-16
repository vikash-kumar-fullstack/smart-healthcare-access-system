import {
  registerUser,
  loginUser,
  getMe,
  updateMe,
  refreshUserToken,
  logoutUser,
  socialLoginUser,
  linkSocialProvider,
  unlinkSocialProvider,
  completeUserProfile,
  generateTokens
} from "./auth.service.js";
import User from "./auth.model.js";
import Doctor from "../doctor/doctor.model.js";
import crypto from "crypto";
import mongoose from "mongoose";
import { verifySocialProvider } from "./oauth.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse, errorResponse } from "../../utils/apiResponse.js";
import { registerSchema,loginSchema } from "./auth.validation.js";
import OAuthAudit from "../admin/oauth_audit.model.js";
import Session from "./session.model.js";

export const socialLogin = asyncHandler(async (req, res) => {
  const { code, provider, name, registerIfNew, codeVerifier } = req.body;
  if (!code || !provider) {
    return res.status(400).json({ success: false, message: "Authorization token/code and provider are required." });
  }

  let emailForAudit = "";
  let roleForAudit = "unknown";
  try {
    const profile = await verifySocialProvider(provider.toLowerCase(), code, codeVerifier);
    emailForAudit = profile.email;
    const data = await socialLoginUser({
      email: profile.email,
      name: name || profile.name,
      provider: provider.toLowerCase(),
      providerId: profile.providerId,
      avatar: profile.avatar,
      registerIfNew: !!registerIfNew
    }, req);
    roleForAudit = data.role || "unknown";

    await OAuthAudit.create({
      email: emailForAudit,
      provider: provider.toLowerCase(),
      role: roleForAudit,
      status: "success"
    });

    return successResponse(res, data, "Social login successful");
  } catch (err) {
    await OAuthAudit.create({
      email: emailForAudit || "unknown@oauth.com",
      provider: provider.toLowerCase(),
      role: roleForAudit,
      status: "failure",
      errorMessage: err.message
    });
    return res.status(400).json({ success: false, message: err.message });
  }
});



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

  const { user, token, refreshToken, role } = await loginUser(result.data, req);

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
    const tokens = await refreshUserToken(refreshToken, req);
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

export const updateProfile = asyncHandler(async (req, res) => {
  const user = await updateMe(req.user.userId, req.body);
  return successResponse(res, user, "Profile updated successfully");
});

export const linkProvider = asyncHandler(async (req, res) => {
  const { provider, providerId } = req.body;
  if (!provider || !providerId) {
    return errorResponse(res, "Provider type and ID are required.", 400);
  }

  try {
    const user = await linkSocialProvider(req.user.userId, { provider, providerId });
    return successResponse(res, user, "Provider account linked successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const unlinkProvider = asyncHandler(async (req, res) => {
  const { provider } = req.body;
  if (!provider) {
    return errorResponse(res, "Provider type is required.", 400);
  }

  try {
    const user = await unlinkSocialProvider(req.user.userId, provider);
    return successResponse(res, user, "Provider account unlinked successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const completeProfile = asyncHandler(async (req, res) => {
  const {
    phone,
    gender,
    dob,
    address,
    bloodGroup,
    emergencyContactName,
    emergencyContactNumber,
    allergies,
    currentMedications,
    chronicDiseases,
    height,
    weight
  } = req.body;

  if (!phone || !gender || !dob || !address || !bloodGroup || !emergencyContactName || !emergencyContactNumber) {
    return errorResponse(res, "Missing required profile completion fields.", 400);
  }

  try {
    const user = await completeUserProfile(req.user.userId, {
      phone,
      gender,
      dob,
      address,
      bloodGroup,
      emergencyContactName,
      emergencyContactNumber,
      allergies,
      currentMedications,
      chronicDiseases,
      height,
      weight
    });
    return successResponse(res, user, "Profile details completed successfully");
  } catch (err) {
    return errorResponse(res, err.message, 400);
  }
});

export const getSessions = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ userId: req.user.userId, isRevoked: false }).sort({ lastActivity: -1 });
  return successResponse(res, sessions, "Active sessions retrieved successfully");
});

export const revokeSession = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await Session.findOneAndUpdate(
    { _id: id, userId: req.user.userId },
    { isRevoked: true }
  );
  return successResponse(res, null, "Session revoked successfully");
});

export const revokeAllSessions = asyncHandler(async (req, res) => {
  await Session.updateMany(
    { userId: req.user.userId },
    { isRevoked: true }
  );
  return successResponse(res, null, "All sessions revoked successfully");
});

export const initiateGoogleAuth = (role) => {
  return (req, res) => {
    const randomState = crypto.randomBytes(16).toString("hex");
    
    // Set a cookie with the state (10 mins expiry)
    const isProd = process.env.NODE_ENV === "production";
    const cookieData = JSON.stringify({ state: randomState, role });

    res.setHeader(
      "Set-Cookie",
      `oauth_state=${encodeURIComponent(cookieData)}; HttpOnly; Path=/; Max-Age=600; SameSite=${isProd ? "None" : "Lax"}${isProd ? "; Secure" : ""}`
    );

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/v1/auth/google/callback";

    // If client ID is not configured (offline demo mode), simulate immediate callback redirect
    if (!clientId) {
      const isSignup = req.query.signup === "true";
      let mockEmail = "patient@example.com";
      if (isSignup && role === "patient") {
        mockEmail = `new-patient-${crypto.randomBytes(4).toString("hex")}@example.com`;
      } else if (role === "doctor") {
        mockEmail = "doctor@example.com";
      } else if (role === "hospital") {
        mockEmail = "hospital@example.com";
      }

      return res.redirect(
        `${redirectUri}?code=${mockEmail}&state=${encodeURIComponent(randomState)}`
      );
    }

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `response_type=code` +
      `&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent("openid email profile")}` +
      `&state=${encodeURIComponent(randomState)}`;

    res.redirect(googleAuthUrl);
  };
};

export const initiatePatientGoogle = initiateGoogleAuth("patient");
export const initiateDoctorGoogle = initiateGoogleAuth("doctor");
export const initiateHospitalGoogle = initiateGoogleAuth("hospital");

export const handleGoogleCallback = asyncHandler(async (req, res) => {
  const { code, state } = req.query;
  
  if (!code || !state) {
    return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=Missing%20authentication%20code%20or%20state`);
  }

  const parseCookies = (cookieHeader) => {
    const list = {};
    if (!cookieHeader) return list;
    cookieHeader.split(";").forEach(cookie => {
      let parts = cookie.split("=");
      list[parts.shift().trim()] = decodeURIComponent(parts.join("="));
    });
    return list;
  };
  const cookies = parseCookies(req.headers.cookie);
  const storedStateJson = cookies.oauth_state;

  const isProd = process.env.NODE_ENV === "production";

  if (!storedStateJson) {
    return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=CSRF%20state%20cookie%20missing.`);
  }

  let parsedState = null;
  try {
    parsedState = JSON.parse(storedStateJson);
  } catch (err) {
    return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=Invalid%20CSRF%20cookie%20format.`);
  }

  const { state: storedState, role } = parsedState;

  // Prepare cookies array
  const cookiesToSet = [];
  const clearStateCookie = `oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=${isProd ? "None" : "Lax"}${isProd ? "; Secure" : ""}`;
  cookiesToSet.push(clearStateCookie);

  if (!storedState || storedState !== state) {
    res.setHeader("Set-Cookie", cookiesToSet);
    return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=CSRF%20state%20mismatch.%20Potential%20cross-site%20request%20forgery%20attack%20detected.`);
  }

  let email = "";
  let name = "";
  let avatar = null;
  let googleId = "";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/api/v1/auth/google/callback";

  if (clientId && !code.includes("@")) {
    try {
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        })
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Google token exchange error: ${errorText}`);
      }

      const tokenData = await tokenResponse.json();
      const { access_token } = tokenData;

      const userResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${access_token}` }
      });

      if (!userResponse.ok) {
        const errorText = await userResponse.text();
        throw new Error(`Google profile fetch error: ${errorText}`);
      }

      const profile = await userResponse.json();
      email = profile.email;
      name = profile.name || profile.given_name || "Google User";
      avatar = profile.picture || null;
      googleId = profile.sub;
    } catch (err) {
      res.setHeader("Set-Cookie", cookiesToSet);
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(err.message)}`);
    }
  } else {
    email = code;
    name = email.split("@")[0].replace(/[._-]/g, " ");
    name = name.charAt(0).toUpperCase() + name.slice(1);
    googleId = "mock-google-id-" + email;
  }

  const normalizedEmail = email.toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  // Apply strict role and signup rules
  if (role === "patient") {
    if (!user) {
      user = await User.create({
        name,
        email: normalizedEmail,
        providers: [{ type: "google", providerId: googleId }],
        avatar,
        role: "patient",
        profileCompleted: false,
        isEmailVerified: true
      });
    } else {
      const hasGoogle = user.providers.some(p => p.type === "google");
      if (!hasGoogle) {
        user.providers.push({ type: "google", providerId: googleId });
        await user.save();
      }
    }
  } else if (role === "doctor") {
    if (!user || user.role !== "doctor") {
      res.setHeader("Set-Cookie", cookiesToSet);
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent("Doctor account not found. Please contact your hospital administrator.")}`);
    }
    const Doctor = mongoose.models.Doctor || mongoose.model("Doctor");
    const doctorRecord = await Doctor.findOne({ userId: user._id });
    if (!doctorRecord) {
      res.setHeader("Set-Cookie", cookiesToSet);
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent("Doctor account not found. Please contact your hospital administrator.")}`);
    }
    const hasGoogle = user.providers.some(p => p.type === "google");
    if (!hasGoogle) {
      user.providers.push({ type: "google", providerId: googleId });
      await user.save();
    }
  } else if (role === "hospital") {
    if (!user || user.role !== "hospital_admin") {
      res.setHeader("Set-Cookie", cookiesToSet);
      return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent("Hospital Admin account not found. Please contact your administrator.")}`);
    }
    const hasGoogle = user.providers.some(p => p.type === "google");
    if (!hasGoogle) {
      user.providers.push({ type: "google", providerId: googleId });
      await user.save();
    }
  } else {
    res.setHeader("Set-Cookie", cookiesToSet);
    return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent("Invalid login role context.")}`);
  }

  if (user.isActive === false || user.accountStatus !== "ACTIVE") {
    res.setHeader("Set-Cookie", cookiesToSet);
    return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent("Account status is suspended or inactive. Please contact administrator.")}`);
  }

  if (user.role === "receptionist") {
    const Receptionist = mongoose.models.Receptionist;
    if (Receptionist) {
      const receptionist = await Receptionist.findOne({ userId: user._id });
      if (receptionist && (receptionist.status === "inactive" || receptionist.status === "archived")) {
        res.setHeader("Set-Cookie", cookiesToSet);
        return res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=${encodeURIComponent(`Your receptionist profile status is ${receptionist.status}. Access denied.`)}`);
      }
    }
  }

  const { accessToken, refreshToken } = await generateTokens(user, req);
  const cookieOptions = `HttpOnly; Path=/; SameSite=${isProd ? "None" : "Lax"}${isProd ? "; Secure" : ""}`;
  
  cookiesToSet.push(`accessToken=${accessToken}; ${cookieOptions}; Max-Age=${3600 * 24}`);
  cookiesToSet.push(`refreshToken=${refreshToken}; ${cookieOptions}; Max-Age=${3600 * 24 * 7}`);
  cookiesToSet.push(`role=${user.role}; Path=/; SameSite=${isProd ? "None" : "Lax"}${isProd ? "; Secure" : ""}; Max-Age=${3600 * 24 * 7}`);

  res.setHeader("Set-Cookie", cookiesToSet);

  const OAuthAudit = mongoose.models.OAuthAudit;
  if (OAuthAudit) {
    await OAuthAudit.create({
      email: normalizedEmail,
      provider: "google",
      role: user.role,
      status: "success"
    });
  }

  res.redirect(`${process.env.CLIENT_URL || "http://localhost:5173"}/oauth/success`);
});

