import crypto from "crypto";
import QRCode from "qrcode";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32Decode(input: string): Buffer {
  const cleanInput = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i];
    const val = BASE32_ALPHABET.indexOf(char);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, counter?: number, digits = 6): string {
  const timeStep = 30;
  const currentCounter = counter !== undefined ? counter : Math.floor(Date.now() / 1000 / timeStep);
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64BE(BigInt(currentCounter));

  const hmac = crypto.createHmac("sha1", key);
  hmac.update(buffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, "0");
}

export const generateMfaSecret = (byteLength = 20): string => {
  const bytes = crypto.randomBytes(byteLength);
  return base32Encode(bytes);
};

export const generateMfaQrCode = async (
  email: string,
  secret: string,
  issuer = "WorkSphere Super Admin"
): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> => {
  const cleanSecret = secret.toUpperCase().replace(/\s+/g, "");
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedLabel = encodeURIComponent(`${issuer}:${email}`);
  const otpauthUrl = `otpauth://totp/${encodedLabel}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { secret: cleanSecret, otpauthUrl, qrCodeDataUrl };
};

export const verifyMfaToken = (token: string, secret: string, window = 1): boolean => {
  if (!token || !secret) return false;
  const cleanToken = token.trim();
  if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) return false;

  try {
    const currentCounter = Math.floor(Date.now() / 1000 / 30);
    for (let offset = -window; offset <= window; offset++) {
      const expected = generateTotpCode(secret, currentCounter + offset);
      if (
        expected.length === cleanToken.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanToken))
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
};
