import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const contentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"]
]);

type ProductImageRouteProps = {
  params: Promise<{
    file: string;
  }>;
};

export async function GET(_request: Request, { params }: ProductImageRouteProps) {
  const { file } = await params;

  if (!/^[a-z0-9][a-z0-9.-]+\.(jpg|jpeg|png|webp)$/i.test(file)) {
    return NextResponse.json({ error: "Imagen no valida." }, { status: 400 });
  }

  const extension = path.extname(file).toLowerCase();
  const contentType = contentTypes.get(extension) ?? "application/octet-stream";
  const imagePath = path.join(process.cwd(), "public", "productos", file);

  try {
    const image = await fs.readFile(imagePath);
    return new NextResponse(image, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": contentType
      }
    });
  } catch {
    return NextResponse.json({ error: "Imagen no encontrada." }, { status: 404 });
  }
}
