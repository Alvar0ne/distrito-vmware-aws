import crypto from "node:crypto";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const key = process.argv[2];
const expiresSeconds = Number(process.argv[3] || 86400);

if (!key) {
  console.error("Uso: node scripts/create-s3-presigned-get-url.mjs <s3-key> [expiresSeconds]");
  process.exit(1);
}

const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.AWS_S3_BUCKET?.trim();
const region = process.env.AWS_REGION?.trim() || "us-east-1";

if (!accessKeyId || !secretAccessKey || !bucket) {
  console.error("Faltan credenciales AWS o AWS_S3_BUCKET.");
  process.exit(1);
}

function hmac(keyValue, value, encoding) {
  return crypto.createHmac("sha256", keyValue).update(value, "utf8").digest(encoding);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function encodePath(value) {
  return value
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getSigningKey(secret, dateStamp, awsRegion, service) {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, awsRegion);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

const now = new Date();
const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
const dateStamp = amzDate.slice(0, 8);
const service = "s3";
const host = `${bucket}.s3.${region}.amazonaws.com`;
const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
const canonicalUri = `/${encodePath(key)}`;

const params = new URLSearchParams({
  "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
  "X-Amz-Credential": `${accessKeyId}/${credentialScope}`,
  "X-Amz-Date": amzDate,
  "X-Amz-Expires": String(expiresSeconds),
  "X-Amz-SignedHeaders": "host"
});

const canonicalQueryString = Array.from(params.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
  .join("&");

const canonicalRequest = [
  "GET",
  canonicalUri,
  canonicalQueryString,
  `host:${host}`,
  "",
  "host",
  "UNSIGNED-PAYLOAD"
].join("\n");

const stringToSign = [
  "AWS4-HMAC-SHA256",
  amzDate,
  credentialScope,
  sha256(canonicalRequest)
].join("\n");

const signature = hmac(
  getSigningKey(secretAccessKey, dateStamp, region, service),
  stringToSign,
  "hex"
);

console.log(`https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`);
