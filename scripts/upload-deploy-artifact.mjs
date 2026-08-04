import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const sourcePath = process.argv[2];
const key = process.argv[3] || `deploy/${path.basename(sourcePath || "")}`;

if (!sourcePath) {
  console.error("Uso: node scripts/upload-deploy-artifact.mjs <archivo.zip> [s3-key]");
  process.exit(1);
}

const bucket = process.env.AWS_S3_BUCKET?.trim();
const region = process.env.AWS_REGION?.trim() || "us-east-1";

if (!bucket) {
  console.error("Falta AWS_S3_BUCKET.");
  process.exit(1);
}

const file = await stat(sourcePath);
const client = new S3Client({ region });

await client.send(
  new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: createReadStream(sourcePath),
    ContentType: "application/zip",
    ContentLength: file.size
  })
);

console.log(`bucket=${bucket}`);
console.log(`key=${key}`);
console.log(`bytes=${file.size}`);
