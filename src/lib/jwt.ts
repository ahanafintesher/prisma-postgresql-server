import jwt from "jsonwebtoken";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret_worksphere_2026";
const REFRESH_SECRET = process.env.REFRESH_SECRET || `${JWT_SECRET}_refresh`;

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  roleSlug?: string;
  sessionId?: string;
}

export interface RefreshTokenPayload {
  id: string;
  sessionId: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (payload: RefreshTokenPayload | { id: string; sessionId?: string }): string => {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
};

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Backward compatibility alias
export const generateToken = (payload: TokenPayload) => generateAccessToken(payload);