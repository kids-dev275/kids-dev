import dotenv from "dotenv";
import { z } from "zod";
import { getPrismaClient } from "../lib/prisma";
import { hashPassword, normalizeEmail } from "../modules/admin-auth/services/password";

// Ensure environment variables are loaded
dotenv.config();

const provisionSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

/**
 * Operations/development CLI script to provision the initial single Admin account.
 * Enforces V1 single-admin policy and singletonKey constraint.
 */
async function provisionAdmin(): Promise<void> {
  const prisma = getPrismaClient();

  // eslint-disable-next-line no-console
  console.log("🔐 Checking existing Admin accounts...");

  // 1. Refuse creation if any AdminUser already exists
  const existingCount = await prisma.adminUser.count();
  if (existingCount > 0) {
    // eslint-disable-next-line no-console
    console.error(
      "❌ Provisioning refused: an Admin account already exists. Multiple Admin accounts are not supported in V1."
    );
    process.exit(1);
  }

  // 2. Read credentials from environment variables (e.g., ADMIN_EMAIL, ADMIN_PASSWORD)
  const rawEmail = process.env.ADMIN_EMAIL || "sk.fabrica@gmail.com";
  const rawPassword = process.env.ADMIN_PASSWORD;

  if (!rawPassword) {
    // eslint-disable-next-line no-console
    console.error(
      "❌ Error: ADMIN_PASSWORD environment variable must be set to provision the Admin account."
    );
    // eslint-disable-next-line no-console
    console.error("   Example: ADMIN_PASSWORD='your-secure-password' pnpm admin:provision");
    process.exit(1);
  }

  const parseResult = provisionSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!parseResult.success) {
    // eslint-disable-next-line no-console
    console.error("❌ Invalid provisioning credentials:", parseResult.error.flatten().fieldErrors);
    process.exit(1);
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = normalizeEmail(email);

  // 3. Hash password using Argon2id
  // eslint-disable-next-line no-console
  console.log("🔒 Generating Argon2id password hash...");
  const passwordHash = await hashPassword(password);

  // 4. Create single AdminUser with singletonKey = 1
  const admin = await prisma.adminUser.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      singletonKey: 1,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Admin account successfully provisioned:`);
  // eslint-disable-next-line no-console
  console.log(`   - ID: ${admin.id}`);
  // eslint-disable-next-line no-console
  console.log(`   - Email: ${admin.email}`);
  // eslint-disable-next-line no-console
  console.log(`   - Total Admins in DB: 1`);
}

provisionAdmin().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("❌ Fatal provisioning error:", err.message || err);
  process.exit(1);
});
