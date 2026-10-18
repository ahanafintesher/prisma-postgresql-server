import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";

export const generateMfaSecret = (): string => {
  return generateSecret();
};

export const generateMfaQrCode = async (
  email: string,
  secret: string,
  issuer = "WorkSphere Super Admin"
): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> => {
  const otpauthUrl = generateURI({
    secret,
    label: email,
    issuer,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret, otpauthUrl, qrCodeDataUrl };
};

export const verifyMfaToken = (token: string, secret: string): boolean => {
  if (!token || !secret) return false;
  try {
    const result = verifySync({
      token: token.trim(),
      secret: secret.trim(),
    });
    return Boolean(result && result.valid);
  } catch (error) {
    return false;
  }
};
