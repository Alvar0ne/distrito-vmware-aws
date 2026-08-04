import { promises as fs } from "node:fs";
import path from "node:path";
import { dbQuery, isPostgresEnabled } from "./db";

export type VisitPoint = {
  date: string;
  label: string;
  visits: number;
};

type VisitRow = {
  day: string | Date;
  visits: number;
};

type LocalVisit = {
  path: string;
  createdAt: string;
};

const visitsPath = path.join(process.cwd(), "data", "visits.local.json");

async function ensureVisitTable() {
  await dbQuery("create extension if not exists pgcrypto");
  await dbQuery(`
    create table if not exists site_visits (
      id uuid primary key default gen_random_uuid(),
      path text not null,
      user_agent text,
      created_at timestamptz not null default now()
    )
  `);
  await dbQuery("create index if not exists site_visits_created_at_idx on site_visits(created_at desc)");
}

async function ensureVisitFile() {
  try {
    await fs.access(visitsPath);
  } catch {
    await fs.mkdir(path.dirname(visitsPath), { recursive: true });
    await fs.writeFile(visitsPath, "[]", "utf8");
  }
}

function getDayRange(days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - 1 - index));
    const key = date.toISOString().slice(0, 10);

    return {
      date: key,
      label: new Intl.DateTimeFormat("es-CL", {
        day: "numeric",
        month: "short"
      }).format(date)
    };
  });
}

export async function recordVisit(input: { path: string; userAgent?: string }) {
  const cleanPath = input.path.trim().slice(0, 300) || "/";
  const userAgent = input.userAgent?.trim().slice(0, 500) ?? "";

  if (isPostgresEnabled()) {
    await ensureVisitTable();
    await dbQuery("insert into site_visits (path, user_agent) values ($1, $2)", [
      cleanPath,
      userAgent
    ]);
    return;
  }

  await ensureVisitFile();
  const raw = await fs.readFile(visitsPath, "utf8");
  const visits = JSON.parse(raw) as LocalVisit[];
  visits.push({
    path: cleanPath,
    createdAt: new Date().toISOString()
  });
  await fs.writeFile(visitsPath, JSON.stringify(visits.slice(-5000), null, 2), "utf8");
}

export async function readVisitSeries(days = 30): Promise<VisitPoint[]> {
  const range = getDayRange(days);
  const visitsByDay = new Map<string, number>();

  if (isPostgresEnabled()) {
    await ensureVisitTable();
    const result = await dbQuery<VisitRow>(
      `
        select to_char(created_at at time zone 'America/Santiago', 'YYYY-MM-DD') as day,
               count(*)::int as visits
        from site_visits
        where created_at >= now() - ($1::int * interval '1 day')
        group by day
        order by day
      `,
      [days]
    );

    for (const row of result.rows) {
      visitsByDay.set(String(row.day).slice(0, 10), Number(row.visits));
    }
  } else {
    await ensureVisitFile();
    const raw = await fs.readFile(visitsPath, "utf8");
    const visits = JSON.parse(raw) as LocalVisit[];
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - days);

    for (const visit of visits) {
      const createdAt = new Date(visit.createdAt);
      if (createdAt < oldest) continue;
      const key = createdAt.toISOString().slice(0, 10);
      visitsByDay.set(key, (visitsByDay.get(key) ?? 0) + 1);
    }
  }

  return range.map((day) => ({
    ...day,
    visits: visitsByDay.get(day.date) ?? 0
  }));
}
