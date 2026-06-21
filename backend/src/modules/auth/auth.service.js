import User from "./auth.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";


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



export const generateTokens = async (user) => {
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
    { userId: user._id },
    process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + "_refresh"),
    { expiresIn: "7d" }
  );

  user.refreshToken = refreshToken;
  await user.save();

  return { accessToken, refreshToken };
};


export const loginUser = async ({ email, password }) => {
  const normalizedEmail = email.toLowerCase();
  const user = await User.findOne({ email:normalizedEmail });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  const { accessToken, refreshToken } = await generateTokens(user);

  const safeUser = user.toObject();
  delete safeUser.password;
  delete safeUser.refreshToken;

  return { user: safeUser, token: accessToken, refreshToken, role: user.role};
};


export const refreshUserToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new Error("Refresh token is required");
  }

  try {
    const secret = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + "_refresh");
    const decoded = jwt.verify(refreshToken, secret);

    const user = await User.findOne({ _id: decoded.userId, refreshToken });
    if (!user) {
      throw new Error("Invalid refresh token");
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user);

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
