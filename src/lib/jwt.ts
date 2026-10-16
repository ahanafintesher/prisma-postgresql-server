import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_fallback_secret_worksphere_2026";
const REFRESH_SECRET = process.env.REFRESH_SECRET || `${JWT_SECRET}_refresh`;

export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  roleSlug?: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: "15m",
  });
};

export const generateRefreshToken = (payload: { id: string }): string => {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: "7d",
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
};

export const verifyRefreshToken = (token: string): { id: string } => {
  return jwt.verify(token, REFRESH_SECRET) as { id: string };
};

// Backward compatibility alias
export const generateToken = (payload: TokenPayload) => generateAccessToken(payload);