require("dotenv").config();
const { Pool } = require("pg");

// ============================================================
// MIGRATION SCRIPT
// ============================================================
// Run once (and again after pulling this update, on every
// device/host you deploy to) with:
//
//   node src/db/migrate.js
//
// Safe to re-run — every statement uses IF NOT EXISTS.

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" },
});

async function migrate() {
    console.log("Running migration against Supabase PostgreSQL...");

    // ------------------------------------------------------
    // PRODUCTS (created here only if this is a brand-new DB;
    // on an existing DB this is a no-op and metal_type is
    // added separately below).
    // ------------------------------------------------------
    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            category TEXT,
            description TEXT,
            metal_type VARCHAR(10) NOT NULL DEFAULT 'gold',
            purity VARCHAR(10),
            weight_grams NUMERIC(10,3) DEFAULT 0,
            making_charges NUMERIC(10,2) DEFAULT 0,
            stone_price NUMERIC(10,2) DEFAULT 0,
            image_filename TEXT,
            in_stock INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Existing installs: add the new column if it's missing.
    await pool.query(`
        ALTER TABLE products
        ADD COLUMN IF NOT EXISTS metal_type VARCHAR(10) NOT NULL DEFAULT 'gold';
    `);

    // ------------------------------------------------------
    // GOLD RATES (already used by server.js; created here too
    // so a fresh Supabase database works out of the box)
    // ------------------------------------------------------
    await pool.query(`
        CREATE TABLE IF NOT EXISTS gold_rates (
            id SERIAL PRIMARY KEY,
            purity VARCHAR(10) NOT NULL,
            rate_per_gram NUMERIC(10,2) NOT NULL,
            source TEXT,
            fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // ------------------------------------------------------
    // SILVER RATES — owner-entered manually, no external API.
    // One row per purity, upserted whenever the owner updates it.
    // ------------------------------------------------------
    await pool.query(`
        CREATE TABLE IF NOT EXISTS silver_rates (
            id SERIAL PRIMARY KEY,
            purity VARCHAR(10) NOT NULL UNIQUE,
            rate_per_gram NUMERIC(10,2) NOT NULL DEFAULT 0,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        INSERT INTO silver_rates (purity, rate_per_gram)
        VALUES ('999', 0), ('925', 0)
        ON CONFLICT (purity) DO NOTHING;
    `);

    // ------------------------------------------------------
    // PRODUCT IMAGES — gallery, one row per photo, stored on
    // Cloudinary. product.image_filename (legacy, local file)
    // is kept working as a fallback for old products.
    // ------------------------------------------------------
    await pool.query(`
        CREATE TABLE IF NOT EXISTS product_images (
            id SERIAL PRIMARY KEY,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            image_url TEXT NOT NULL,
            cloudinary_public_id TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
    `);

    await pool.query(`
        ALTER TABLE product_images
        ADD COLUMN IF NOT EXISTS storage_path TEXT;
    `);

    // ------------------------------------------------------
    // CUSTOMER ENQUIRIES — contact form submissions.
    // ------------------------------------------------------
    await pool.query(`
        CREATE TABLE IF NOT EXISTS customer_enquiries (
            id SERIAL PRIMARY KEY,
            customer_name VARCHAR(150) NOT NULL,
            phone VARCHAR(30) NOT NULL,
            message TEXT NOT NULL,
            product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'new',
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT customer_enquiries_status_check
                CHECK (status IN ('new', 'contacted', 'follow-up', 'completed'))
        );
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_customer_enquiries_status_created
        ON customer_enquiries (status, created_at DESC);
    `);

    console.log("Migration complete:");
    console.log("  - products.metal_type ready ('gold' / 'silver')");
    console.log("  - silver_rates table ready (owner sets 999K/925K manually)");
    console.log("  - product_images table ready (multi-photo gallery via Supabase Storage)");
    console.log("  - customer_enquiries table ready");

    await pool.end();
}

migrate().catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
});
