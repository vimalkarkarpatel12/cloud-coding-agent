import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getMasterKey(): Buffer {
  const secret = process.env.SECRETS_ENCRYPTION_KEY || "default-dev-secrets-key-32bytes!!";
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(plaintext: string): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptSecret(ciphertext: string): string {
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

async function testEncryption() {
  console.log("Testing AES-256-GCM encryption/decryption roundtrip...");

  const originalSecret = "sk-ant-api03-test-token-123456789";
  const encrypted = encryptSecret(originalSecret);

  console.log("Encrypted payload:", encrypted);

  if (encrypted === originalSecret) {
    throw new Error("Encryption failed: output matches input");
  }

  const decrypted = decryptSecret(encrypted);
  console.log("Decrypted payload:", decrypted);

  if (decrypted !== originalSecret) {
    throw new Error("Decryption failed: decrypted payload does not match original");
  }

  console.log("\nEncryption and decryption test PASSED successfully! ✅");
}

testEncryption().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

