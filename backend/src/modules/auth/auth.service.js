import User from "./auth.model.js";
import Receptionist from "../admin/receptionist.model.js";
import PatientHealthProfile from "../medical-records/patient_health_profile.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import crypto from "crypto";
import Session from "./session.model.js";
import { logSecurityIncident } from "../admin/audit.service.js";
import LoginAttempt from "./login_attempt.model.js";


export const registerUser = async (data) => {

  const { name, email, phone, password } = data;
  const normalizedEmail = email.toLowerCase();
  const existingUser = await User.findOne({
    $or: [{ email:normalizedEmail }, { phone }]
  });
  if (existingUser) {
    throw new Error("User already exists");
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email:normalizedEmail,
    phone,
    password: hashedPassword
  });

  return user;
};






export const parseUserAgent = (uaString = "") => {
  let browser = "Unknown Browser";
  let platform = "Unknown Platform";
  let deviceName = "Unknown Device";

  const ua = uaString.toLowerCase();

  // Browser
  if (ua.includes("chrome") && !ua.includes("chromium")) {
    browser = "Chrome";
  } else if (ua.includes("safari") && !ua.includes("chrome")) {
    browser = "Safari";
  } else if (ua.includes("firefox")) {
    browser = "Firefox";
  } else if (ua.includes("edge")) {
    browser = "Edge";
  }

  // Platform
  if (ua.includes("windows")) {
    platform = "Windows";
    deviceName = "Chrome Windows";
  } else if (ua.includes("android")) {
    platform = "Android";
    deviceName = "Android App";
  } else if (ua.includes("iphone") || ua.includes("ipad")) {
    platform = "iOS";
    deviceName = ua.includes("iphone") ? "Safari iPhone" : "Safari iPad";
  } else if (ua.includes("macintosh") || ua.includes("mac os")) {
    platform = "macOS";
    deviceName = "MacBook Pro";
  } else if (ua.includes("linux")) {
    platform = "Linux";
    deviceName = "Linux Desktop";
  }

  return { browser, platform, deviceName };
};

export const generateTokens = async (user, req = null) => {
  let adminSessionId = undefined;
  const isAdmin = ["admin", "super_admin", "district_admin", "hospital_admin"].includes(user.role);
  if (isAdmin) {
    adminSessionId = new mongoose.Types.ObjectId().toString();
    await mongoose.model("AdminSession").create({
      adminId: user._id,
      adminSessionId,
      issuedAt: new Date(),
      lastActivity: new Date()
    });
  }

  const accessToken = jwt.sign(
    {
      userId: user._id,
      role: user.role,
      ...(adminSessionId && { adminSessionId })
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.NODE_ENV === "test" ? "2h" : "15m" }
  );

  const refreshToken = jwt.sign(
    { userId: user._id, nonce: crypto.randomBytes(16).toString("hex") },
    process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + "_refresh"),
    { expiresIn: "7d" }
  );

  user.refreshToken = refreshToken;
  await user.save();

  if (req) {
    const refreshTokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const { browser, platform, deviceName } = parseUserAgent(req.headers["user-agent"] || "");
    await Session.create({
      userId: user._id,
      deviceName,
      browser,
      platform,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      refreshTokenHash
    });
  }

  return { accessToken, refreshToken };
};

export const loginUser = async ({ email, password }, req = null) => {
  const normalizedEmail = email.toLowerCase();
  const ipAddress = req ? (req.ip || req.headers["x-forwarded-for"] || "127.0.0.1") : "127.0.0.1";

  // Check demo mode lockouts bypass
  const isDemoBypass = process.env.DEMO_DISABLE_LOCKOUT === "true" || process.env.DEMO_MODE === "true";

  if (!isDemoBypass) {
    const attempt = await LoginAttempt.findOne({ email: normalizedEmail });
    if (attempt && attempt.lockoutUntil && attempt.lockoutUntil > new Date()) {
      const remainingTime = Math.ceil((attempt.lockoutUntil.getTime() - Date.now()) / 1000 / 60);
      throw new Error(`Account temporarily locked due to excessive failed attempts. Please retry in ${remainingTime} minute(s).`);
    }
  }

  const user = await User.findOne({ email:normalizedEmail });
  let isMatch = false;

  if (user) {
    if (user.role === "receptionist") {
      const receptionist = await Receptionist.findOne({ userId: user._id });
      if (receptionist && (receptionist.status === "inactive" || receptionist.status === "archived")) {
        throw new Error(`Your receptionist profile status is ${receptionist.status}. Access denied.`);
      }
    }
    isMatch = await bcrypt.compare(password, user.password);
  }

  if (!isMatch) {
    if (!isDemoBypass) {
      let attempt = await LoginAttempt.findOne({ email: normalizedEmail });
      if (!attempt) {
        attempt = new LoginAttempt({ email: normalizedEmail, ipAddress });
      }
      attempt.attempts += 1;
      if (attempt.attempts >= 5 && attempt.attempts < 10) {
        attempt.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes lockout
      } else if (attempt.attempts >= 10) {
        attempt.lockoutUntil = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours lockout
        // Trigger LOGIN_ABUSE security incident
        await logSecurityIncident({
          category: "LOGIN_ABUSE",
          description: `Potential brute-force attack detected. 10+ failed login attempts for ${normalizedEmail} from IP ${ipAddress}.`,
          req,
          affectedUserId: user ? user._id : null,
          severity: "high"
        });
      }
      await attempt.save();
    }
    throw new Error("Invalid credentials");
  }

  // Clear attempts on success
  if (!isDemoBypass) {
    await LoginAttempt.deleteOne({ email: normalizedEmail });
  }

  const { accessToken, refreshToken } = await generateTokens(user, req);

  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;

  return { user: safeUser, token: accessToken, refreshToken, role: user.role};
};

export const refreshUserToken = async (refreshToken, req = null) => {
  if (!refreshToken) {
    throw new Error("Refresh token is required");
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + "_refresh");
    const decoded = jwt.verify(refreshToken, secret);

    const hashedToken = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const session = await Session.findOne({ refreshTokenHash: hashedToken });

    if (session && session.isRevoked) {
      await logSecurityIncident({
        category: "TOKEN_REUSE",
        description: `Revoked refresh token reuse attempt detected for user ${decoded.userId}.`,
        req,
        affectedUserId: decoded.userId,
        severity: "high"
      });
      throw new Error("Token revoked due to reuse detection");
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      throw new Error("Invalid refresh token");
    }

    if (session) {
      session.isRevoked = true;
      await session.save();
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user, req);

    return { token: accessToken, refreshToken: newRefreshToken };
  } catch (err) {
    throw new Error("Invalid refresh token");
  }
};

export const logoutUser = async (userId) => {
  await User.findByIdAndUpdate(userId, { refreshToken: null });
};


export const getMe = async (userId) => {
  const user = await User.findById(userId).select("-password -refreshToken").lean();

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const updateMe = async (userId, data) => {
  const { name, phone } = data;
  const update = {};
  if (name) update.name = name;
  if (phone) update.phone = phone;

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: update },
    { new: true, runValidators: true }
  ).select("-password -refreshToken").lean();

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

export const socialLoginUser = async ({ email, name, provider, providerId, avatar, registerIfNew = false }, req = null) => {
  const normalizedEmail = email.toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    if (!registerIfNew) {
      throw new Error("Account does not exist. Please contact your hospital administrator.");
    }
    // Create new patient account
    user = await User.create({
      name: name || "Social User",
      email: normalizedEmail,
      providers: [{ type: provider, providerId }],
      avatar,
      role: "patient",
      profileCompleted: false,
      isEmailVerified: true
    });
  } else {
    // Check and link provider if not linked yet
    const hasProvider = user.providers.some(p => p.type === provider);
    if (!hasProvider) {
      user.providers.push({ type: provider, providerId });
      await user.save();
    }
  }

  if (user.role === "receptionist") {
    const receptionist = await Receptionist.findOne({ userId: user._id });
    if (receptionist && (receptionist.status === "inactive" || receptionist.status === "archived")) {
      throw new Error(`Your receptionist profile status is ${receptionist.status}. Access denied.`);
    }
  }

  const { accessToken, refreshToken } = await generateTokens(user, req);

  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;

  return {
    user: safeUser,
    token: accessToken,
    refreshToken,
    role: user.role,
    profileCompleted: user.profileCompleted
  };
};

export const linkSocialProvider = async (userId, { provider, providerId }) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");

  const hasProvider = user.providers.some(p => p.type === provider);
  if (hasProvider) throw new Error(`This ${provider} account is already linked.`);

  user.providers.push({ type: provider, providerId });
  await user.save();
  return user;
};

export const unlinkSocialProvider = async (userId, provider) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");

  if (user.providers.length <= 1) {
    throw new Error("Cannot unlink provider: at least one authentication method must remain active.");
  }

  user.providers = user.providers.filter(p => p.type !== provider);
  await user.save();
  return user;
};

export const completeUserProfile = async (userId, data) => {
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
  } = data;

  const user = await User.findById(userId);
  if (!user) throw new Error("User not found.");

  // Check unique phone sparsity constraint
  if (phone) {
    const duplicate = await User.findOne({ phone, _id: { $ne: userId } });
    if (duplicate) throw new Error("Phone number is already associated with another account.");
    user.phone = phone;
  }

  user.gender = gender;
  user.dob = new Date(dob);
  user.address = address || null;
  user.profileCompleted = true;
  await user.save();

  // Create or update patient health profile
  let healthProfile = await PatientHealthProfile.findOne({ patientId: userId });
  
  const parseToArray = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(",").map(s => s.trim()).filter(Boolean);
  };

  const updateData = {
    bloodGroup,
    emergencyContact: {
      name: emergencyContactName,
      phone: emergencyContactNumber,
      relation: "Emergency Contact"
    },
    allergies: parseToArray(allergies),
    chronicDiseases: parseToArray(chronicDiseases),
    currentMedications: parseToArray(currentMedications),
    height: height ? parseFloat(height) : null,
    weight: weight ? parseFloat(weight) : null
  };

  if (!healthProfile) {
    await PatientHealthProfile.create({
      patientId: userId,
      ...updateData
    });
  } else {
    Object.assign(healthProfile, updateData);
    await healthProfile.save();
  }

  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;
  return safeUser;
};

