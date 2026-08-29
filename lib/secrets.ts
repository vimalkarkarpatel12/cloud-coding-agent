import crypto from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { userSecret } from "@/lib/db/schema";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getMasterKey(): Buffer {
  const secret = process.env.SECRETS_ENCRYPTION_KEY || "default-dev-secrets-key-32bytes!!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypt plaintext string using AES-256-GCM.
 * Output format: hex(iv) + ":" + hex(authTag) + ":" + hex(encryptedData)
 */
export function encryptSecret(plaintext: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt ciphertext string back to plaintext.
 */
export function decryptSecret(ciphertext: string): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid ciphertext format");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const masterKey = getMasterKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Save or update an encrypted secret for a specific user.
 */
export async function saveUserSecret(
  userId: string,
  secretName: string,
  plaintextValue: string
): Promise<void> {
  const encryptedValue = encryptSecret(plaintextValue);

  // Check if secret already exists
  const existing = await db
    .select()
    .from(userSecret)
    .where(and(eq(userSecret.userId, userId), eq(userSecret.secretName, secretName)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(userSecret)
      .set({ encryptedValue })
      .where(and(eq(userSecret.userId, userId), eq(userSecret.secretName, secretName)));
  } else {
    await db.insert(userSecret).values({
      userId,
      secretName,
      encryptedValue,
    });
  }
}

/**
 * Retrieve and decrypt a secret for a specific user.
 */
export async function getUserSecret(
  userId: string,
  secretName: string
): Promise<string | null> {
  const records = await db
    .select()
    .from(userSecret)
    .where(and(eq(userSecret.userId, userId), eq(userSecret.secretName, secretName)))
    .limit(1);

  if (records.length === 0) return null;

  try {
    return decryptSecret(records[0].encryptedValue);
  } catch (err) {
    console.error(`Failed to decrypt secret ${secretName} for user ${userId}`, err);
    return null;
  }
}

/**
 * Get list of secret names configured for a user (without decrypting values).
 */
export async function getUserSecretNames(userId: string): Promise<string[]> {
  const records = await db
    .select({ secretName: userSecret.secretName })
    .from(userSecret)
    .where(eq(userSecret.userId, userId));

  return records.map((r) => r.secretName);
}
