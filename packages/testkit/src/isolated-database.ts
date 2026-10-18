import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createPool } from "@rakazo/db";

const exec = promisify(execFile);

/** Deployment settings and background reconcilers span every tenant in a database. */
export async function isolatedDatabase(sourceUrl: string) {
  const name = `test_${randomUUID().replaceAll("-", "")}`;
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  const pool = createPool(adminUrl.toString(), { poolMax: 1 });
  const url = new URL(sourceUrl);
  url.pathname = `/${name}`;
  let created = false;
  const close = async () => {
    try {
      if (created) {
        await pool.query(`DROP DATABASE "${name}"`);
        created = false;
      }
    } finally {
      await pool.end();
    }
  };
  try {
    await pool.query(`CREATE DATABASE "${name}"`);
    created = true;
    await exec("pnpm", ["--filter", "@rakazo/db", "migrate"], {
      cwd: fileURLToPath(new URL("../../../", import.meta.url)),
      env: { ...process.env, DATABASE_URL: url.toString() },
    });
    return { url: url.toString(), close };
  } catch (error) {
    await close();
    throw error;
  }
}
