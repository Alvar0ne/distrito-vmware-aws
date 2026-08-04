import { promises as fs } from "node:fs";
import path from "node:path";
import { dbQuery, isPostgresEnabled } from "./db";

export type Promotion = {
  id: string;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  createdAt: string;
};

type PromotionDatabaseRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  active: boolean;
  created_at: Date | string;
};

const promotionsPath = path.join(process.cwd(), "data", "promotions.local.json");

export function normalizePromotionCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

function mapDatabasePromotion(row: PromotionDatabaseRow): Promotion {
  return {
    id: row.id,
    code: row.code,
    description: row.description ?? "",
    type: row.discount_type,
    value: Number(row.discount_value),
    active: row.active,
    createdAt: new Date(row.created_at).toISOString()
  };
}

async function ensurePromotionFile() {
  try {
    await fs.access(promotionsPath);
  } catch {
    await fs.mkdir(path.dirname(promotionsPath), { recursive: true });
    await fs.writeFile(promotionsPath, "[]", "utf8");
  }
}

export async function readPromotions(): Promise<Promotion[]> {
  if (isPostgresEnabled()) {
    const result = await dbQuery<PromotionDatabaseRow>(
      "select * from promotions order by created_at desc"
    );
    return result.rows.map(mapDatabasePromotion);
  }

  await ensurePromotionFile();
  const raw = await fs.readFile(promotionsPath, "utf8");
  return JSON.parse(raw) as Promotion[];
}

export async function savePromotion(input: Omit<Promotion, "id" | "createdAt">) {
  const code = normalizePromotionCode(input.code);
  if (!code) throw new Error("Ingresa un codigo.");
  if (input.value <= 0) throw new Error("El descuento debe ser mayor a cero.");

  if (isPostgresEnabled()) {
    const result = await dbQuery<PromotionDatabaseRow>(
      `
        insert into promotions (code, description, discount_type, discount_value, active)
        values ($1, $2, $3, $4, $5)
        on conflict (code) do update set
          description = excluded.description,
          discount_type = excluded.discount_type,
          discount_value = excluded.discount_value,
          active = excluded.active,
          updated_at = now()
        returning *
      `,
      [code, input.description, input.type, input.value, input.active]
    );
    return mapDatabasePromotion(result.rows[0]);
  }

  const promotions = await readPromotions();
  const existingIndex = promotions.findIndex((promotion) => promotion.code === code);
  const promotion: Promotion = {
    id: existingIndex >= 0 ? promotions[existingIndex].id : `promo-${Date.now()}`,
    code,
    description: input.description.trim(),
    type: input.type,
    value: input.value,
    active: input.active,
    createdAt: existingIndex >= 0 ? promotions[existingIndex].createdAt : new Date().toISOString()
  };

  if (existingIndex >= 0) {
    promotions[existingIndex] = promotion;
  } else {
    promotions.unshift(promotion);
  }

  await fs.writeFile(promotionsPath, JSON.stringify(promotions, null, 2), "utf8");
  return promotion;
}

export async function findActivePromotionByCode(code: string) {
  const normalizedCode = normalizePromotionCode(code);
  if (!normalizedCode) return null;

  const promotions = await readPromotions();
  return promotions.find(
    (promotion) => promotion.active && promotion.code === normalizedCode
  ) ?? null;
}

export async function deletePromotion(id: string) {
  if (isPostgresEnabled()) {
    const result = await dbQuery<{ id: string }>(
      "delete from promotions where id = $1 returning id",
      [id]
    );
    return Boolean(result.rowCount);
  }

  const promotions = await readPromotions();
  const nextPromotions = promotions.filter((promotion) => promotion.id !== id);
  if (nextPromotions.length === promotions.length) return false;

  await fs.writeFile(promotionsPath, JSON.stringify(nextPromotions, null, 2), "utf8");
  return true;
}
