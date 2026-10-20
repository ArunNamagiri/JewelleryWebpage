const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");
const helmet = require("helmet");
require("dotenv").config();
const createAdminRouter = require("./routes/admin");
const app = express();

app.set("trust proxy", 1);

const rateLimit = require("express-rate-limit");

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many requests. Please try again later.",
    },
});

app.use("/api", apiLimiter);
app.use(helmet());
app.disable("x-powered-by");

const configuredOrigins = String(process.env.FRONTEND_URL || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8080",
    "https://jewellery-webpage-hlhm.vercel.app",
    ...configuredOrigins,
]);

app.use(cors({
    origin: function (origin, callback) {
        if (
            !origin ||
            allowedOrigins.has(origin)
        ) {
            callback(null, true);
        } else {
            console.error("Rejected CORS origin:", origin);
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: false, limit: "100kb" }));
app.use(
    "/uploads",
    express.static(
        path.join(__dirname, "..", "uploads")
    )
);


// ============================================================
// SUPABASE POSTGRESQL
// ============================================================

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
    },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});


// ============================================================
// ADMIN ROUTES (login, product CRUD with photo upload, silver rate)
// ============================================================

app.use("/api/admin", createAdminRouter(pool));


// ============================================================
// CUSTOMER ENQUIRIES
// ============================================================
const enquiryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many enquiries from this address. Please try again later.",
    },
});

app.post("/api/enquiries", enquiryLimiter, async (req, res) => {
    try {
        const name = String(req.body?.name || "").trim();
        const phone = String(req.body?.phone || "").trim();
        const message = String(req.body?.message || "").trim();
        const productId = req.body?.product_id ? Number(req.body.product_id) : null;

        if (name.length < 2 || name.length > 150) {
            return res.status(400).json({ success: false, message: "Please enter a valid name." });
        }
        if (!/^\+?[0-9][0-9\s-]{8,19}$/.test(phone)) {
            return res.status(400).json({ success: false, message: "Please enter a valid phone number." });
        }
        if (message.length < 2 || message.length > 2000) {
            return res.status(400).json({ success: false, message: "Please enter your message." });
        }
        if (productId !== null && (!Number.isInteger(productId) || productId <= 0)) {
            return res.status(400).json({ success: false, message: "Invalid product." });
        }

        const result = await pool.query(
            `INSERT INTO customer_enquiries (customer_name, phone, message, product_id)
             VALUES ($1, $2, $3, $4)
             RETURNING id, customer_name, phone, message, product_id, status, created_at`,
            [name, phone, message, productId]
        );

        const whatsappNumber = String(process.env.WHATSAPP_NUMBER || "").replace(/\D/g, "");
        const whatsappText = `New enquiry from ${name}\nPhone: ${phone}\n\n${message}`;
        const whatsappUrl = whatsappNumber
            ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappText)}`
            : null;

        res.status(201).json({ success: true, enquiry: result.rows[0], whatsapp_url: whatsappUrl });
    } catch (error) {
        console.error("Create enquiry error:", error);
        res.status(500).json({ success: false, message: "Failed to save your enquiry." });
    }
});

// ============================================================
// GOLD RATE CACHE
// ============================================================

let cachedGoldRates = null;

let goldRatesLastFetched = 0;

const GOLD_CACHE_MINUTES =
    Number(process.env.GOLD_CACHE_MINUTES) || 10;

const GOLD_CACHE_MS = GOLD_CACHE_MINUTES * 60 * 1000;


// ============================================================
// CALCULATE PRODUCT PRICE
// ============================================================

function calculateProductPrice(product, goldRates, silverRates) {

    const weight =
        parseFloat(product.weight_grams || 0);

    const purity =
        String(product.purity || "")
            .toUpperCase()
            .trim();

    const metalType =
        String(product.metal_type || "gold")
            .toLowerCase()
            .trim();

    let metalRate;

    if (metalType === "silver") {

        // Silver rates are entered manually by the owner
        // (no external live API) — see /api/admin/silver-rate.

        if (purity.includes("925")) {

            metalRate =
                Number(silverRates.rate_925);

        } else {

            // Default to 999 (fine silver)
            metalRate =
                Number(silverRates.rate_999);
        }

    } else {

        // Gold — default to 22K
        metalRate =
            Number(goldRates.rate_22k);

        if (purity.includes("24K")) {

            metalRate =
                Number(goldRates.rate_24k);

        } else if (purity.includes("22K")) {

            metalRate =
                Number(goldRates.rate_22k);

        } else if (purity.includes("18K")) {

            metalRate =
                Number(goldRates.rate_18k);
        }
    }


    const metalValue =
        weight * metalRate;


    const makingCharges =
        parseFloat(
            product.making_charges || 0
        );


    const stonePrice =
        parseFloat(
            product.stone_price || 0
        );


    const calculatedPrice =
        metalValue +
        makingCharges +
        stonePrice;


    return {

        metal_type:
            metalType,

        // Kept as gold_rate_per_gram / gold_value for backward
        // compatibility with the existing frontend cards — these
        // now hold whichever metal's rate/value actually applied.
        gold_rate_per_gram:
            Math.round((metalRate || 0) * 100) / 100,

        gold_value:
            Math.round((metalValue || 0) * 100) / 100,

        making_charges:
            Math.round(makingCharges * 100) / 100,

        stone_price:
            Math.round(stonePrice * 100) / 100,

        calculated_price:
            Math.round(calculatedPrice * 100) / 100
    };
}


// ============================================================
// SAVE GOLD RATES TO NEON
// ============================================================

async function saveGoldRatesToNeon(rates) {

    try {

        await pool.query(
            `
            INSERT INTO gold_rates
            (
                purity,
                rate_per_gram,
                source,
                fetched_at
            )
            VALUES
                ('24K', $1, $4, CURRENT_TIMESTAMP),
                ('22K', $2, $4, CURRENT_TIMESTAMP),
                ('18K', $3, $4, CURRENT_TIMESTAMP)
            `,
            [
                rates.rate_24k,
                rates.rate_22k,
                rates.rate_18k,
                rates.source || "Unknown"
            ]
        );


        console.log(
            "Gold rates saved to Neon."
        );

    } catch (error) {

        console.error(
            "Neon save error:",
            error.message
        );
    }
}


// ============================================================
// GET LAST GOLD RATE FROM NEON
// ============================================================

async function getLatestGoldRateFromNeon() {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    purity,
                    rate_per_gram,
                    source,
                    fetched_at
                FROM gold_rates
                WHERE purity IN
                    ('24K', '22K', '18K')
                ORDER BY fetched_at DESC
                `
            );


        if (
            result.rows.length === 0
        ) {

            throw new Error(
                "No gold rates found in Neon"
            );
        }


        const latestRates = {};


        for (
            const row of result.rows
        ) {

            if (
                latestRates[row.purity] === undefined
            ) {

                latestRates[row.purity] =
                    Number(row.rate_per_gram);
            }
        }


        if (
            !Number.isFinite(
                latestRates["24K"]
            ) ||
            !Number.isFinite(
                latestRates["22K"]
            ) ||
            !Number.isFinite(
                latestRates["18K"]
            )
        ) {

            throw new Error(
                "Incomplete gold rates in Neon"
            );
        }


        const latestFetchedAt =
            result.rows.reduce(
                (latest, row) => {

                    const current =
                        new Date(
                            row.fetched_at
                        );

                    return current > latest
                        ? current
                        : latest;

                },
                new Date(0)
            );


        cachedGoldRates = {

            rate_24k:
                latestRates["24K"],

            rate_22k:
                latestRates["22K"],

            rate_18k:
                latestRates["18K"],

            currency:
                "INR",

            source:
                "Gold API - Neon Cache",

            live:
                false,

            stale:
                true,

            synced_at:
                latestFetchedAt.toLocaleTimeString(
                    "en-IN"
                ),

            timestamp:
                latestFetchedAt.toISOString()
        };


        goldRatesLastFetched =
            Date.now();


        console.log(
            "Using latest gold rates from Supa Database."
        );


        return cachedGoldRates;


    } catch (error) {

        console.error(
            "Neon gold-rate fallback failed:",
            error.message
        );


        // Last-resort fallback.
        // This is only used if both Gold API
        // and Neon have no usable data.

        cachedGoldRates = {

            rate_24k:
                13667.15,

            rate_22k:
                12528.22,

            rate_18k:
                10250.37,

            currency:
                "INR",

            source:
                "Last Known Gold API Rate",

            live:
                false,

            stale:
                true,

            synced_at:
                "Last known rate",

            timestamp:
                null
        };


        goldRatesLastFetched =
            Date.now();


        return cachedGoldRates;
    }
}


// ============================================================
// FETCH LIVE GOLD RATES
// ============================================================

async function fetchGoldRates() {

    const now =
        Date.now();


    // --------------------------------------------------------
    // Use memory cache for 5 minutes
    // --------------------------------------------------------

    if (
        cachedGoldRates &&
        now - goldRatesLastFetched <
        GOLD_CACHE_MS
    ) {

        return cachedGoldRates;
    }

              console.log("Calling SnapData Indian gold rate API...");

        // ====================================================
        // 0. TRY SNAPDATA (DAILY INDIAN GOLD BENCHMARK)
        // Rates are already INR per gram.
        // ====================================================

        try {
            const snapResponse = await fetch(
                "https://snapdata.dev/api/v1/gold/in/latest.json",
                { signal: AbortSignal.timeout(10000) }
            );

            if (!snapResponse.ok) {
                throw new Error(`SnapData HTTP ${snapResponse.status}`);
            }

            const snapData = await snapResponse.json();

            if (
                snapData.dataset !== "gold" ||
                snapData.scope !== "in" ||
                snapData.unit?.currency !== "INR" ||
                snapData.unit?.quantity !== "gram" ||
                !Array.isArray(snapData.observations)
            ) {
                throw new Error("Invalid SnapData response format");
            }

            const observations = snapData.observations;

            const rate24 = observations.find(
                item => item.instrument === "XAU.24K"
            );
            const rate22 = observations.find(
                item => item.instrument === "XAU.22K"
            );
            const rate18 = observations.find(
                item => item.instrument === "XAU.18K"
            );

            if (!rate24 || !rate22 || !rate18) {
                throw new Error("SnapData is missing one or more purity rates");
            }

            const sourceDate = rate24.date;

            if (
                !sourceDate ||
                !/^\d{4}-\d{2}-\d{2}$/.test(sourceDate) ||
                rate22.date !== sourceDate ||
                rate18.date !== sourceDate
            ) {
                throw new Error("Missing, invalid, or inconsistent source dates");
            }

            const sourceTimestamp = Date.parse(`${sourceDate}T00:00:00Z`);

            if (
                !Number.isFinite(sourceTimestamp) ||
                new Date(sourceTimestamp).toISOString().slice(0, 10) !== sourceDate
            ) {
                throw new Error("Invalid SnapData source date");
            }

            const ageInDays = Math.floor(
                (Date.now() - sourceTimestamp) / (24 * 60 * 60 * 1000)
            );

            if (ageInDays < 0 || ageInDays > 3) {
                throw new Error(`SnapData is too old: ${sourceDate}`);
            }

            const ibjaRate24k = Number(rate24.value);
            const ibjaRate22k = Number(rate22.value);
            const ibjaRate18k = Number(rate18.value);

            if (
                !Number.isFinite(ibjaRate24k) || ibjaRate24k <= 0 ||
                !Number.isFinite(ibjaRate22k) || ibjaRate22k <= 0 ||
                !Number.isFinite(ibjaRate18k) || ibjaRate18k <= 0
            ) {
                throw new Error("SnapData contains invalid gold rates");
            }

            cachedGoldRates = {
                rate_24k: Math.round(ibjaRate24k * 100) / 100,
                rate_22k: Math.round(ibjaRate22k * 100) / 100,
                rate_18k: Math.round(ibjaRate18k * 100) / 100,
                currency: "INR",
                source: "SnapData (IBJA daily benchmark)",
                source_date: sourceDate,
                source_status: rate24.status || "unknown",
                live: false,
                stale: ageInDays > 0,
                synced_at: new Date().toLocaleTimeString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                }),
                timestamp: new Date().toISOString()
            };

            goldRatesLastFetched = now;

            await saveGoldRatesToNeon(cachedGoldRates);

            console.log("=================================");
            console.log("SNAPDATA INDIAN DAILY GOLD BENCHMARK");
            console.log("Source date:", sourceDate);
            console.log("24K INR/gram:", cachedGoldRates.rate_24k);
            console.log("22K INR/gram:", cachedGoldRates.rate_22k);
            console.log("18K INR/gram:", cachedGoldRates.rate_18k);
            console.log("=================================");

            return cachedGoldRates;

        } catch (snapError) {
            console.error("SnapData API error:", snapError.message);
            console.log("Falling back to spot price + premium...");
        }


    try{
        // ====================================================
        // 1. GOLD PRICE (goldapi.io if a key is configured,
        //    otherwise the free unauthenticated spot source)
        // ====================================================

        let goldUsdPerOunce;
        let spotSourceName;
        let spotTimestamp = null;

        if (process.env.GOLD_API_KEY) {

            try {

                const goldApiIoResponse =
                    await fetch(
                        "https://www.goldapi.io/api/XAU/USD",
                        {
                            headers: {
                                "x-access-token":
                                    process.env.GOLD_API_KEY
                            }
                        }
                    );

                if (
                    !goldApiIoResponse.ok
                ) {

                    const errorText =
                        await goldApiIoResponse.text();

                    throw new Error(
                        `GoldAPI.io HTTP ${goldApiIoResponse.status}: ${errorText}`
                    );
                }

                const goldApiIoData =
                    await goldApiIoResponse.json();
                const providerTimestamp = Number(goldApiIoData.timestamp);

                if (Number.isFinite(providerTimestamp) && providerTimestamp > 0) {
                    spotTimestamp = new Date(providerTimestamp * 1000);

                    if (
                        !Number.isFinite(spotTimestamp.getTime()) ||
                        spotTimestamp.getTime() > Date.now() + 60_000
                    ) {
                        throw new Error("GoldAPI.io returned an invalid timestamp");
                    }
                }

                console.log(
                    "GoldAPI.io response:",
                    goldApiIoData
                );

                goldUsdPerOunce =
                    Number(goldApiIoData.price);

                spotSourceName =
                    "GoldAPI.io";

            } catch (goldApiIoError) {

                console.error(
                    "GoldAPI.io error:",
                    goldApiIoError.message
                );

                console.log(
                    "Falling back to free unauthenticated spot API..."
                );
            }
        }

        if (
            !Number.isFinite(goldUsdPerOunce)
        ) {

            const goldResponse =
                await fetch(
                    "https://api.gold-api.com/price/XAU"
                );

            if (
                !goldResponse.ok
            ) {

                const errorText =
                    await goldResponse.text();

                throw new Error(
                    `Gold API HTTP ${goldResponse.status}: ${errorText}`
                );
            }

            const goldData =
                await goldResponse.json();

            console.log(
                "Gold API response:",
                goldData
            );

            goldUsdPerOunce =
                Number(goldData.price);

            spotSourceName =
                "Gold API (free, unauth)";
        }


        if (
            !Number.isFinite(
                goldUsdPerOunce
            )
        ) {

            throw new Error(
                "Invalid XAU price from spot source"
            );
        }


        // ====================================================
        // 2. USD → INR
        // ====================================================

        const fxResponse =
            await fetch(
                "https://api.frankfurter.app/latest?from=USD&to=INR"
            );


        if (
            !fxResponse.ok
        ) {

            const errorText =
                await fxResponse.text();

            throw new Error(
                `USD/INR API HTTP ${fxResponse.status}: ${errorText}`
            );
        }


        const fxData =
            await fxResponse.json();


        const usdToInr =
            Number(
                fxData.rates?.INR
            );


        if (
            !Number.isFinite(
                usdToInr
            )
        ) {

            throw new Error(
                "Invalid USD/INR exchange rate"
            );
        }


        // ====================================================
        // 3. TROY OUNCE  → GRAM
        // ====================================================

        const TROY_OUNCE_GRAMS =
            31.1034768;


        const rawRate24k =
            (
                goldUsdPerOunce *
                usdToInr
            ) /
            TROY_OUNCE_GRAMS;


        // ====================================================
        // 3b. DOMESTIC PREMIUM
        // ====================================================
        // Raw XAU spot converted to INR reflects the
        // international bullion price only. Indian retail gold
        // additionally carries import duty (~6%), GST (3%), and
        // a dealer/bullion-association margin. Without this,
        // displayed rates run ~15-20% below real Indian market
        // rates. Adjust via GOLD_PREMIUM_PERCENT in .env.

        const premiumPercent =
            Number(
                process.env.GOLD_PREMIUM_PERCENT
            ) || 15;

        const rate24k =
            rawRate24k *
            (1 + premiumPercent / 100);


        // ====================================================
        // 4. PURITY
        // ====================================================

        const rate22k =
            rate24k *
            (22 / 24);


        const rate18k =
            rate24k *
            (18 / 24);


        // ====================================================
        // 5. CREATE RATE OBJECT
        // ====================================================

        cachedGoldRates = {

            rate_24k:
                Math.round(
                    rate24k * 100
                ) / 100,

            rate_22k:
                Math.round(
                    rate22k * 100
                ) / 100,

            rate_18k:
                Math.round(
                    rate18k * 100
                ) / 100,

            currency:
                "INR",

            source:
                spotSourceName,

            source_timestamp: spotTimestamp
                ? spotTimestamp.toISOString()
                : null,

            live: Boolean(
                spotTimestamp &&
                Date.now() - spotTimestamp.getTime() <= 30 * 60 * 1000
            ),

            stale: !spotTimestamp ||
                Date.now() - spotTimestamp.getTime() > 30 * 60 * 1000,

            synced_at: new Date().toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            }),

            timestamp:
                new Date().toISOString(),

            gold_usd_per_ounce:
                goldUsdPerOunce,

            usd_inr:
                usdToInr,

            premium_percent:
                premiumPercent
        };


        goldRatesLastFetched =
            now;


        // ====================================================
        // 6. SAVE TO NEON
        // ====================================================

        await saveGoldRatesToNeon(
            cachedGoldRates
        );


        // ====================================================
        // LOG
        // ====================================================

        console.log(
            "================================="
        );

        console.log(
            "LIVE GOLD PRICE"
        );

        console.log(
            "Gold USD/oz:",
            goldUsdPerOunce
        );

        console.log(
            "USD/INR:",
            usdToInr
        );

        console.log(
            "24K INR/gram:",
            cachedGoldRates.rate_24k
        );

        console.log(
            "22K INR/gram:",
            cachedGoldRates.rate_22k
        );

        console.log(
            "18K INR/gram:",
            cachedGoldRates.rate_18k
        );

        console.log(
            "================================="
        );


        return cachedGoldRates;


    } catch (error) {

        console.error(
            "Gold API error:",
            error.message
        );


        console.log(
            "Using latest gold price from Supa Database..."
        );


        return await getLatestGoldRateFromNeon();
    }
}


// ============================================================
// SILVER RATES (owner-entered manually, no external API)
// ============================================================

let cachedSilverRates = null;
let silverRatesLastFetched = 0;
const SILVER_CACHE_MS = 60 * 1000; // 1 minute — it's just a DB read

async function fetchSilverRates() {

    const now = Date.now();

    if (
        cachedSilverRates &&
        now - silverRatesLastFetched < SILVER_CACHE_MS
    ) {
        return cachedSilverRates;
    }

    try {

        const result = await pool.query(
            `SELECT purity, rate_per_gram, updated_at FROM silver_rates`
        );

        const ratesByPurity = {};
        let latestUpdatedAt = null;

        for (const row of result.rows) {
            ratesByPurity[row.purity] = Number(row.rate_per_gram);

            if (!latestUpdatedAt || new Date(row.updated_at) > latestUpdatedAt) {
                latestUpdatedAt = new Date(row.updated_at);
            }
        }

        cachedSilverRates = {
            rate_999: ratesByPurity["999"] ?? 0,
            rate_925: ratesByPurity["925"] ?? 0,
            currency: "INR",
            source: "Set by store owner",
            live: false,
            synced_at: latestUpdatedAt
                ? latestUpdatedAt.toLocaleTimeString("en-IN")
                :"Not available",
            timestamp: latestUpdatedAt ? latestUpdatedAt.toISOString() : null,
        };

        silverRatesLastFetched = now;

        return cachedSilverRates;

    } catch (error) {

        console.error("Silver rate fetch error:", error.message);

        cachedSilverRates = {
            rate_999: 0,
            rate_925: 0,
            currency: "INR",
            source: "Not set yet",
            live: false,
            synced_at: "—",
            timestamp: null,
        };

        silverRatesLastFetched = now;

        return cachedSilverRates;
    }
}


// ============================================================
// DATABASE TEST
// ============================================================

app.get(
    "/api/db-test",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    "SELECT NOW() AS time"
                );


            res.json({

                success:
                    true,

                message:
                    "Neon PostgreSQL connected",

                time:
                    result.rows[0].time
            });


        } catch (error) {

            console.error(
                "Database connection error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Neon PostgreSQL connection failed",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// DATABASE TABLES
// ============================================================

app.get(
    "/api/db-tables",
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                    `
                );


            res.json({

                success:
                    true,

                tables:
                    result.rows.map(
                        row =>
                            row.table_name
                    )
            });


        } catch (error) {

            console.error(
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Failed to read database tables",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// LIVE GOLD RATES
// ============================================================

app.get(
    "/api/refresh-gold-rates",
    async (req, res) => {

        try {

            // Force fresh API request
            goldRatesLastFetched = 0;

            const rates =
                await fetchGoldRates();


            res.json({

                success:
                    true,

                gold_rates:
                    rates
            });


        } catch (error) {

            console.error(
                "Gold API error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Unable to fetch live gold rates",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// GET GOLD RATES
// ============================================================

app.get(
    "/api/gold-rates",
    async (req, res) => {

        try {

            const rates =
                await fetchGoldRates();


            res.json({

                success:
                    true,

                gold_rates:
                    rates
            });


        } catch (error) {

            console.error(
                "Gold API error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Unable to fetch gold rates",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// GET SILVER RATES (public, owner-entered)
// ============================================================

app.get(
    "/api/silver-rates",
    async (req, res) => {

        try {

            const rates =
                await fetchSilverRates();


            res.json({

                success:
                    true,

                silver_rates:
                    rates
            });


        } catch (error) {

            console.error(
                "Silver rate error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Unable to fetch silver rates",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// PRODUCTS
// ============================================================

app.get(
    "/api/products",
    async (req, res) => {

        try {

            const {
                category,
                q,
                sort,
                metal
            } = req.query;


            // ------------------------------------------------
            // DATABASE QUERY
            // ------------------------------------------------

            let query = `
                SELECT
                    p.id,
                    p.name,
                    p.category,
                    p.description,
                    p.metal_type,
                    p.purity,
                    p.weight_grams,
                    p.making_charges,
                    p.stone_price,
                    p.image_filename,
                    p.in_stock,
                    p.created_at,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', pi.id,
                                'image_url', pi.image_url
                            )
                            ORDER BY pi.sort_order, pi.id
                        ) FILTER (WHERE pi.id IS NOT NULL),
                        '[]'
                    ) AS images
                FROM products p
                LEFT JOIN product_images pi ON pi.product_id = p.id
                WHERE p.in_stock > 0
            `;


            const params = [];

            let paramIndex = 1;


            // ------------------------------------------------
            // METAL TYPE (gold / silver)
            // ------------------------------------------------

            if (metal) {

                query +=
                    ` AND p.metal_type = $${paramIndex}`;

                params.push(metal);

                paramIndex++;
            }


            // ------------------------------------------------
            // CATEGORY
            // ------------------------------------------------

            if (category) {

                query +=
                    ` AND p.category = $${paramIndex}`;

                params.push(category);

                paramIndex++;
            }


            // ------------------------------------------------
            // SEARCH
            // ------------------------------------------------

            if (q) {

                query += `
                    AND (
                        p.name ILIKE $${paramIndex}
                        OR p.description ILIKE $${paramIndex}
                        OR p.category ILIKE $${paramIndex}
                    )
                `;

                params.push(
                    `%${q}%`
                );

                paramIndex++;
            }


            query += ` GROUP BY p.id `;


            // ------------------------------------------------
            // QUERY DATABASE
            // ------------------------------------------------

            const result =
                await pool.query(
                    query,
                    params
                );


            // ------------------------------------------------
            // GOLD + SILVER RATES
            // ------------------------------------------------

            const goldRates =
                await fetchGoldRates();

            const silverRates =
                await fetchSilverRates();


            // ------------------------------------------------
            // CALCULATE PRODUCT PRICES
            // ------------------------------------------------

            let products =
                result.rows.map(
                    product => {

                        const pricing =
                            calculateProductPrice(
                                product,
                                goldRates,
                                silverRates
                            );


                        return {

                            ...product,

                            ...pricing
                        };
                    }
                );


            // ------------------------------------------------
            // SORT
            // ------------------------------------------------

            if (
                sort === "price_low"
            ) {

                products.sort(
                    (a, b) =>
                        a.calculated_price -
                        b.calculated_price
                );


            } else if (
                sort === "price_high"
            ) {

                products.sort(
                    (a, b) =>
                        b.calculated_price -
                        a.calculated_price
                );


            } else if (
                sort === "name"
            ) {

                products.sort(
                    (a, b) =>
                        a.name.localeCompare(
                            b.name
                        )
                );


            } else {

                products.sort(
                    (a, b) =>
                        new Date(
                            b.created_at
                        ) -
                        new Date(
                            a.created_at
                        )
                );
            }


            // ------------------------------------------------
            // RESPONSE
            // ------------------------------------------------

            res.json({

                success:
                    true,

                gold_rates:
                    goldRates,

                silver_rates:
                    silverRates,

                products
            });


        } catch (error) {

            console.error(
                "Products API error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Failed to load products",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// PRODUCT GOLD RATES
// ============================================================

app.get(
    "/api/products/gold-rates",
    async (req, res) => {

        try {

            const rates =
                await fetchGoldRates();


            res.json({

                success:
                    true,

                gold_rates:
                    rates
            });


        } catch (error) {

            console.error(
                "Gold rate error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Unable to fetch live gold rates",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// SINGLE PRODUCT
// ============================================================

app.get(
    "/api/products/:id",
    async (req, res) => {

        try {

            const id =
                Number(req.params.id);


            if (
                !Number.isInteger(id)
            ) {

                return res.status(400).json({

                    success:
                        false,

                    message:
                        "Invalid product ID"
                });
            }


            const result =
                await pool.query(
                    `
                    SELECT
                        p.id,
                        p.name,
                        p.category,
                        p.description,
                        p.metal_type,
                        p.purity,
                        p.weight_grams,
                        p.making_charges,
                        p.stone_price,
                        p.image_filename,
                        p.in_stock,
                        p.created_at,
                        COALESCE(
                            json_agg(
                                json_build_object(
                                    'id', pi.id,
                                    'image_url', pi.image_url
                                )
                                ORDER BY pi.sort_order, pi.id
                            ) FILTER (WHERE pi.id IS NOT NULL),
                            '[]'
                        ) AS images
                    FROM products p
                    LEFT JOIN product_images pi ON pi.product_id = p.id
                    WHERE p.id = $1
                    GROUP BY p.id
                    `,
                    [id]
                );


            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({

                    success:
                        false,

                    message:
                        "Product not found"
                });
            }


            const product =
                result.rows[0];


            const goldRates =
                await fetchGoldRates();

            const silverRates =
                await fetchSilverRates();


            const pricing =
                calculateProductPrice(
                    product,
                    goldRates,
                    silverRates
                );


            res.json({

                success:
                    true,

                gold_rates:
                    goldRates,

                silver_rates:
                    silverRates,

                product: {

                    ...product,

                    ...pricing
                }
            });


        } catch (error) {

            console.error(
                "Single product error:",
                error
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Failed to load product",

                error:
                    error.message
            });
        }
    }
);


// ============================================================
// MARKET RATES
// ============================================================

app.get(
    "/api/market-rates",
    async (req, res) => {

        try {

            const rates =
                await fetchGoldRates();

            const silverRates =
                await fetchSilverRates();


            res.json({

                success:
                    true,

                market_rates:
                    rates,

                silver_market_rates:
                    silverRates
            });


        } catch (error) {

            console.error(
                "Market rates error:",
                error.message
            );


            res.status(500).json({

                success:
                    false,

                message:
                    "Unable to load live market rates",

                error:
                    error.message
            });
        }
    }
);

// ============================================================
// HEALTH CHECK
// ============================================================
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        status: "healthy",
    });
});


// ============================================================
// HOME
// ============================================================

app.get(
    "/",
    (req, res) => {

        res.json({

            success:
                true,

            message:
                "AI Jewellery Store API is running"
        });
    }
);


// ============================================================
// ERROR HANDLERS
// ============================================================
app.use("/api", (req, res) => {
    res.status(404).json({ success: false, message: "API endpoint not found" });
});

app.use((error, req, res, next) => {
    console.error("Unhandled server error:", error.message);
    if (res.headersSent) return next(error);
    res.status(error.status || 500).json({
        success: false,
        message: "Internal server error",
    });
});

// ============================================================
// START SERVER
// ============================================================

const PORT =
    process.env.PORT || 5000;


app.listen(
    PORT,
    () => {

        console.log(
            `Backend server running on port ${PORT}`
        );
    }
);
