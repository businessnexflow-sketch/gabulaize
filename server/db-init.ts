import { pool } from "./db";

export async function ensureDbBasics() {
  // Minimal schema required for login/session to work in dev.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dealers (
      id SERIAL PRIMARY KEY,
      key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      dealer_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price INTEGER NOT NULL,
      category TEXT NOT NULL,
      image_url TEXT,
      stock INTEGER NOT NULL DEFAULT 0,
      discount_price INTEGER,
      discount_percentage INTEGER,
      discount_expiry timestamp,
      CONSTRAINT products_dealer_id_name_unique UNIQUE (dealer_id, name)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "session" (
      "sid" varchar NOT NULL,
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL
    );
  `);
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'session_pkey'
      ) THEN
        ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
      END IF;
    END
    $$;
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
  `);

  await pool.query(
    `INSERT INTO users (username, password)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    ["demo@example.com", "Energo123#"],
  );

  await pool.query(
    `INSERT INTO users (username, password)
     VALUES ($1, $2)
     ON CONFLICT (username) DO NOTHING`,
    ["info@gorgia.ge", "Energo123#"],
  );

  await pool.query(
    `INSERT INTO dealers (key, name)
     VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING`,
    ["iron", "Iron+"],
  );

  await pool.query(
    `INSERT INTO dealers (key, name)
     VALUES ($1, $2)
     ON CONFLICT (key) DO NOTHING`,
    ["gorgia", "Gorgia"],
  );
}
