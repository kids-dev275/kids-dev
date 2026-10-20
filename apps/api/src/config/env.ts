import dotenv from "dotenv";
import { z } from "zod";

// Load environment variables from .env if present
dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().default("0.0.0.0"),
    PORT: z.coerce.number().default(4000),

    DATABASE_URL: z.string().min(1).optional(),
    DIRECT_URL: z.string().min(1).optional(),

    FRONTEND_URL: z.string().url().default("http://localhost:3000"),

    TRUST_PROXY: z
      .preprocess(
        (val) => {
          if (typeof val === "string") {
            if (val.toLowerCase() === "true" || val === "1") return true;
            if (val.toLowerCase() === "false" || val === "0") return false;
            return val;
          }
          return val;
        },
        z.union([z.boolean(), z.string()])
      )
      .default(false),

    SESSION_SECRET: z
      .string()
      .min(32, "SESSION_SECRET must be at least 32 characters long")
      .default("development_session_secret_change_in_production_min_32_chars"),

    ADMIN_SESSION_COOKIE_NAME: z.string().min(1).default("kw_admin_session"),
    ADMIN_SESSION_TTL_HOURS: z.coerce.number().positive().default(168),
    CUSTOMER_SESSION_COOKIE_NAME: z.string().min(1).default("kw_customer_session"),
    CUSTOMER_SESSION_TTL_HOURS: z.coerce.number().positive().default(720),
    COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    COOKIE_SECURE: z
      .preprocess((val) => {
        if (typeof val === "string") {
          return val.toLowerCase() === "true" || val === "1";
        }
        return val;
      }, z.boolean())
      .default(process.env.NODE_ENV === "production"),

    // Optional environment settings for development Admin provisioning
    ADMIN_EMAIL: z.string().email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),

    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.COOKIE_SAME_SITE === "none" && !data.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "COOKIE_SAME_SITE=none requires COOKIE_SECURE=true",
        path: ["COOKIE_SECURE"],
      });
    }

    if (data.NODE_ENV === "production") {
      if (!data.DATABASE_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "DATABASE_URL is required in production environment",
          path: ["DATABASE_URL"],
        });
      }
      if (data.SESSION_SECRET === "development_session_secret_change_in_production_min_32_chars") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Default SESSION_SECRET must not be used in production",
          path: ["SESSION_SECRET"],
        });
      }
      if (!data.COOKIE_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "COOKIE_SECURE must be true in production",
          path: ["COOKIE_SECURE"],
        });
      }
      if (!data.CLOUDINARY_CLOUD_NAME) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CLOUDINARY_CLOUD_NAME is required in production environment",
          path: ["CLOUDINARY_CLOUD_NAME"],
        });
      }
      if (!data.CLOUDINARY_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CLOUDINARY_API_KEY is required in production environment",
          path: ["CLOUDINARY_API_KEY"],
        });
      }
      if (!data.CLOUDINARY_API_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "CLOUDINARY_API_SECRET is required in production environment",
          path: ["CLOUDINARY_API_SECRET"],
        });
      }
    }
  });

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const formattedErrors = parseResult.error.format();
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:", JSON.stringify(formattedErrors, null, 2));
  throw new Error("Invalid server environment configuration");
}

export type Env = z.infer<typeof envSchema>;
export const env = parseResult.data;
