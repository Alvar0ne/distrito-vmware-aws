import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const csvPath = process.argv[2];

if (!csvPath) {
  console.error("Uso: node scripts/import-customer-emails.mjs <archivo.csv>");
  process.exit(1);
}

const customersPath = path.join(process.cwd(), "data", "customers.local.json");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function splitCsvLine(line) {
  const values = [];
  let value = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      value += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      values.push(value.trim());
      value = "";
      continue;
    }

    value += char;
  }

  values.push(value.trim());
  return values;
}

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function getNameFromEmail(email) {
  const localPart = email.split("@")[0] ?? "cliente";
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Cliente importado";

  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function readCustomers() {
  try {
    const raw = await fs.readFile(customersPath, "utf8");
    return JSON.parse(raw);
  } catch {
    await fs.mkdir(path.dirname(customersPath), { recursive: true });
    return [];
  }
}

const rawCsv = await fs.readFile(csvPath, "utf8");
const lines = rawCsv
  .replace(/^\uFEFF/, "")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const header = splitCsvLine(lines[0] ?? "").map((column) => column.toLowerCase());
const emailIndex = header.includes("email") || header.includes("correo")
  ? Math.max(header.indexOf("email"), header.indexOf("correo"))
  : 0;
const sourceRows = header.includes("email") || header.includes("correo") ? lines.slice(1) : lines;
const emails = Array.from(
  new Set(
    sourceRows
      .map((line) => normalizeEmail(splitCsvLine(line)[emailIndex] ?? ""))
      .filter((email) => emailPattern.test(email))
  )
);

const now = new Date().toISOString();
const customers = await readCustomers();
const existingEmails = new Set(customers.map((customer) => normalizeEmail(customer.email)));
const imported = [];

for (const email of emails) {
  if (existingEmails.has(email)) continue;

  imported.push({
    id: randomUUID(),
    name: getNameFromEmail(email),
    rut: "",
    email,
    phone: "",
    region: "",
    commune: "",
    shippingAddress: "",
    firstOrderAt: now,
    lastOrderAt: now,
    createdAt: now,
    updatedAt: now,
    orderCount: 0
  });
  existingEmails.add(email);
}

const merged = [...imported, ...customers].sort(
  (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
);

await fs.writeFile(customersPath, JSON.stringify(merged, null, 2), "utf8");

console.log(`emails_en_csv=${emails.length}`);
console.log(`clientes_importados=${imported.length}`);
console.log(`clientes_duplicados=${emails.length - imported.length}`);
console.log(`clientes_totales=${merged.length}`);
