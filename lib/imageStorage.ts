import { promises as fs } from "node:fs";
import path from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const allowedTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"]
]);

type StorageGlobal = typeof globalThis & {
  distritoMiamiS3?: S3Client;
};

const storageGlobal = globalThis as StorageGlobal;

function isS3Enabled() {
  return process.env.IMAGE_STORE === "s3";
}

function getS3Config() {
  const bucket = process.env.AWS_S3_BUCKET?.trim();
  const region = process.env.AWS_REGION?.trim() || "us-east-1";

  if (!bucket) {
    throw new Error("Configura AWS_S3_BUCKET antes de habilitar S3.");
  }

  if (!storageGlobal.distritoMiamiS3) {
    storageGlobal.distritoMiamiS3 = new S3Client({ region });
  }

  return {
    bucket,
    client: storageGlobal.distritoMiamiS3
  };
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

function getPublicImageUrl(key: string) {
  const publicUrl = process.env.AWS_S3_PUBLIC_URL?.replace(/\/$/, "");
  return publicUrl
    ? `${publicUrl}/${key}`
    : `/api/product-images/s3?key=${encodeURIComponent(key)}`;
}

export async function saveProductImage(file: File, baseName: string) {
  const extension = allowedTypes.get(file.type);

  if (!extension) {
    throw new Error("La imagen debe ser JPG, PNG o WEBP.");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (bytes.length > 8 * 1024 * 1024) {
    throw new Error("La imagen no puede superar 8 MB.");
  }

  const fileName = `${slugify(baseName) || "producto"}-${Date.now()}${extension}`;

  if (isS3Enabled()) {
    const { bucket, client } = getS3Config();
    const key = `productos/${fileName}`;

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable"
      })
    );

    return getPublicImageUrl(key);
  }

  const outputDir = path.join(process.cwd(), "public", "productos");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, fileName), bytes);

  return `/api/product-images/${fileName}`;
}

export async function readS3ProductImage(key: string) {
  const { bucket, client } = getS3Config();
  const result = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key
    })
  );

  if (!result.Body) {
    return null;
  }

  return {
    bytes: Buffer.from(await result.Body.transformToByteArray()),
    contentType: result.ContentType ?? "application/octet-stream",
    cacheControl: result.CacheControl ?? "public, max-age=86400"
  };
}
