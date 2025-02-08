import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.string().default("5000"),
  MONGODB_URI: z.string(),
  JWT_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  JWT_ACCESS_EXPIRATION: z.string().default("15m"),
  JWT_REFRESH_EXPIRATION: z.string().default("7d"),
  COOKIE_SECRET: z.string(),
  API_URL: z.string().default("http://localhost:5000"),
  CLIENT_URL: z.string().default("http://localhost:3000"),
  APP_NAME: z.string().default("MyProfile"),

  // SSL configuration
  SSL_KEY_PATH: z.string().default("ssl/private.key"),
  SSL_CERT_PATH: z.string().default("ssl/certificate.crt"),
  SSL_ENABLED: z.string().default("true"),

  // Twilio configuration
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Email configuration
  SMTP_HOST: z.string(),
  SMTP_PORT: z.number().default(587),
  SMTP_USER: z.string(),
  SMTP_PASSWORD: z.string(),
  SMTP_FROM: z.string(),
  SMTP_SERVICE: z.string().default("gmail"),

  // OAuth configuration
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  FACEBOOK_APP_ID: z.string(),
  FACEBOOK_APP_SECRET: z.string(),

  BASE_URL: z.string().default('http://localhost:3000'),
});

const getConfig = () => {
  try {
    return envSchema.parse({
      NODE_ENV: process.env.NODE_ENV,
      PORT: process.env.PORT,
      MONGODB_URI: process.env.MONGODB_URI,
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_ACCESS_EXPIRATION: process.env.JWT_ACCESS_EXPIRATION,
      JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION,
      COOKIE_SECRET: process.env.COOKIE_SECRET,
      API_URL: process.env.API_URL,
      CLIENT_URL: process.env.CLIENT_URL,
      APP_NAME: process.env.APP_NAME,

      // SSL configuration
      SSL_KEY_PATH: process.env.SSL_KEY_PATH,
      SSL_CERT_PATH: process.env.SSL_CERT_PATH,
      SSL_ENABLED: process.env.SSL_ENABLED,

      // Twilio configuration
      TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
      TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,

      // Email configuration
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASSWORD: process.env.SMTP_PASSWORD,
      SMTP_FROM: process.env.SMTP_FROM,
      SMTP_SERVICE: process.env.SMTP_SERVICE,

      // OAuth configuration
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,

      BASE_URL: process.env.BASE_URL || 'http://localhost:3000',
    });
  } catch (error) {
    throw new Error(
      `Configuration validation error: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
};

export const config = getConfig();
