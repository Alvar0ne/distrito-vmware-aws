import pg, { type PoolClient, type QueryResultRow } from "pg";

const { Pool } = pg;

type DatabaseGlobal = typeof globalThis & {
  distritoMiamiPool?: InstanceType<typeof Pool>;
};

const databaseGlobal = globalThis as DatabaseGlobal;

export function isPostgresEnabled() {
  return process.env.DATA_STORE === "postgres";
}

function getPool() {
  if (!isPostgresEnabled()) {
    throw new Error("PostgreSQL no esta habilitado. Usa DATA_STORE=postgres.");
  }

  const connectionString = process.env.DATABASE_URL?.trim();

  if (!connectionString || connectionString.includes("change-me")) {
    throw new Error("Configura DATABASE_URL antes de habilitar PostgreSQL.");
  }

  if (!databaseGlobal.distritoMiamiPool) {
    databaseGlobal.distritoMiamiPool = new Pool({
      connectionString,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 10
    });
  }

  return databaseGlobal.distritoMiamiPool;
}

export async function dbQuery<T extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
