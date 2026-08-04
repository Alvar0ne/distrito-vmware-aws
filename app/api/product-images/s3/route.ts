import { NextResponse } from "next/server";
import { readS3ProductImage } from "@/lib/imageStorage";
import { promises as fs } from "node:fs";
import path from "node:path";

const contentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

async function readLocalProductImage(key: string) {
  const file = key.replace(/^productos\//, "");

  if (!/^[a-z0-9][a-z0-9.-]+\.(jpg|jpeg|png|webp)$/i.test(file)) {
    return null;
  }

  try {
    const extension = path.extname(file).toLowerCase();
    const imagePath = path.join(process.cwd(), "public", "productos", file);
    const bytes = await fs.readFile(imagePath);
    return {
      bytes,
      contentType: contentTypes.get(extension) ?? "application/octet-stream",
      cacheControl: "public, max-age=31536000, immutable"
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";

  if (!key.startsWith("productos/") || key.includes("..")) {
    return NextResponse.json({ error: "Imagen no valida." }, { status: 400 });
  }

  try {
    const image = (await readS3ProductImage(key)) ?? (await readLocalProductImage(key));

    if (!image) {
      return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
    }

    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": image.cacheControl
      }
    });
  } catch {
    const image = await readLocalProductImage(key);

    if (!image) {
      return NextResponse.json({ error: "No se pudo cargar la imagen." }, { status: 500 });
    }

    return new Response(image.bytes, {
      headers: {
        "Content-Type": image.contentType,
        "Cache-Control": image.cacheControl
      }
    });
  }
}
