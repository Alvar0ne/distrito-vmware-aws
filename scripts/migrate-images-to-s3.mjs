import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = process.cwd();
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root);

const bucket = process.env.AWS_S3_BUCKET?.trim();
const region = process.env.AWS_REGION?.trim() || "us-east-1";
const publicUrl = process.env.AWS_S3_PUBLIC_URL?.replace(/\/$/, "");

if (!bucket) {
  console.error("Missing AWS_S3_BUCKET.");
  process.exit(1);
}

const productsPath = path.join(root, "data", "products.imported.json");
const backupPath = path.join(root, "data", "products.imported.before-s3.json");
const products = JSON.parse(await fs.readFile(productsPath, "utf8"));
const s3 = new S3Client({ region });
const contentTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};
let uploaded = 0;
let skipped = 0;
const uploadJobs = [];
const concurrency = 8;

function getLocalFileName(image) {
  if (image.startsWith("/api/product-images/")) {
    return decodeURIComponent(image.slice("/api/product-images/".length));
  }
  if (image.startsWith("/productos/")) {
    return decodeURIComponent(image.slice("/productos/".length));
  }
  return null;
}

function getStoredUrl(key) {
  return publicUrl
    ? `${publicUrl}/${key}`
    : `/api/product-images/s3?key=${encodeURIComponent(key)}`;
}

await fs.copyFile(productsPath, backupPath);

for (const product of products) {
  const nextImages = [...(product.images ?? [])];

  for (const [imageIndex, image] of (product.images ?? []).entries()) {
    const fileName = getLocalFileName(image);

    if (!fileName) {
      skipped += 1;
      continue;
    }

    uploadJobs.push(async () => {
      const filePath = path.join(root, "public", "productos", fileName);
      const bytes = await fs.readFile(filePath);
      const extension = path.extname(fileName).toLowerCase();
      const key = `productos/${fileName}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: bytes,
          ContentType: contentTypes[extension] ?? "application/octet-stream",
          CacheControl: "public, max-age=31536000, immutable"
        })
      );

      nextImages[imageIndex] = getStoredUrl(key);
      uploaded += 1;
    });
  }

  product.images = nextImages;
}

for (let index = 0; index < uploadJobs.length; index += concurrency) {
  await Promise.all(uploadJobs.slice(index, index + concurrency).map((upload) => upload()));
  console.log(`Uploaded ${Math.min(index + concurrency, uploadJobs.length)}/${uploadJobs.length} images...`);
}

await fs.writeFile(productsPath, JSON.stringify(products, null, 2), "utf8");
console.log(`Uploaded ${uploaded} images to S3. Skipped ${skipped} non-local images.`);
