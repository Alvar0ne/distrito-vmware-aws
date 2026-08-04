import process from "node:process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const required = [
  "DATABASE_URL",
  "AWS_REGION",
  "AWS_S3_BUCKET",
  "FLOW_API_KEY",
  "FLOW_SECRET_KEY",
  "NEXT_PUBLIC_SITE_URL"
];
const missing = required.filter((name) => !process.env[name]?.trim());
const invalid = [];

if (process.env.DATABASE_URL?.includes("change-me")) invalid.push("DATABASE_URL");
if (process.env.NEXT_PUBLIC_SITE_URL?.includes("127.0.0.1")) invalid.push("NEXT_PUBLIC_SITE_URL");
if (process.env.NEXT_PUBLIC_SITE_URL?.includes("localhost")) invalid.push("NEXT_PUBLIC_SITE_URL");

if (missing.length || invalid.length) {
  if (missing.length) console.error(`Missing variables: ${missing.join(", ")}`);
  if (invalid.length) console.error(`Production values required: ${[...new Set(invalid)].join(", ")}`);
  process.exit(1);
}

console.log("Production environment check passed. No secret values were displayed.");
