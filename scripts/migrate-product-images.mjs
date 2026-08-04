import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const appRoot = process.cwd();
const productsPath = path.join(appRoot, "data", "products.imported.json");
const backupPath = path.join(appRoot, "data", "products.imported.before-images.json");
const publicProductsDir = path.join(appRoot, "public", "productos");

const extensionByContentType = new Map([
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"]
]);

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname.toLowerCase();
  const ext = path.extname(pathname);
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext) ? ext.replace(".jpeg", ".jpg") : "";
}

function localImagePath(product, imageUrl, index, contentType) {
  const urlExt = extensionFromUrl(imageUrl);
  const ext = urlExt || extensionByContentType.get(contentType?.split(";")[0]?.trim()) || ".jpg";
  const hash = createHash("sha1").update(imageUrl).digest("hex").slice(0, 10);
  const productSlug = slugify(product.id || product.name || "producto");
  return {
    diskPath: path.join(publicProductsDir, `${productSlug}-${index + 1}-${hash}${ext}`),
    publicPath: `/productos/${productSlug}-${index + 1}-${hash}${ext}`
  };
}

async function downloadImage(product, imageUrl, index) {
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  const response = await fetch(imageUrl, {
    headers: {
      "user-agent": "DistritoMiamiImageMigrator/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} descargando ${imageUrl}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const { diskPath, publicPath } = localImagePath(product, imageUrl, index, contentType);
  const bytes = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(diskPath, bytes);
  return publicPath;
}

async function main() {
  await fs.mkdir(publicProductsDir, { recursive: true });

  const raw = await fs.readFile(productsPath, "utf8");
  const products = JSON.parse(raw);

  try {
    await fs.access(backupPath);
  } catch {
    await fs.writeFile(backupPath, raw, "utf8");
  }

  let downloaded = 0;
  let skipped = 0;
  const failures = [];

  for (const product of products) {
    const nextImages = [];
    const images = Array.isArray(product.images) ? product.images : [];

    for (let index = 0; index < images.length; index += 1) {
      const imageUrl = images[index];

      try {
        const nextPath = await downloadImage(product, imageUrl, index);
        nextImages.push(nextPath);
        if (nextPath !== imageUrl) downloaded += 1;
        else skipped += 1;
      } catch (error) {
        failures.push({
          productId: product.id,
          imageUrl,
          error: error instanceof Error ? error.message : String(error)
        });
        nextImages.push(imageUrl);
      }
    }

    product.images = nextImages;
  }

  await fs.writeFile(productsPath, JSON.stringify(products, null, 2), "utf8");

  console.log(`Imagenes descargadas: ${downloaded}`);
  console.log(`Imagenes ya locales/omitidas: ${skipped}`);
  console.log(`Errores: ${failures.length}`);

  if (failures.length) {
    const failurePath = path.join(appRoot, "data", "image-migration-errors.json");
    await fs.writeFile(failurePath, JSON.stringify(failures, null, 2), "utf8");
    console.log(`Detalle de errores: ${failurePath}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
