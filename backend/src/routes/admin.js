const express = require("express");
const bcrypt = require("bcryptjs");
const rateLimit = require("express-rate-limit");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { fromBuffer } = require("file-type");
const { requireAdminAuth } = require("../middleware/adminAuth");
const {
    isSupabaseConfigured,
    uploadBufferToSupabase,
    deleteFromSupabase,
} = require("../config/supabase");

// ============================================================
// ADMIN AUTH MIDDLEWARE
// ============================================================
// Expects:
// Authorization: Bearer <token>

// multer keeps uploaded files in memory; we stream them straight
// to Cloudinary instead of writing to local disk (see decision:
// the site is hosted across multiple devices, so local disk isn't
// reliable storage for photos).
const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
]);

const ALLOWED_EXTENSIONS = new Set([
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
]);

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 8 * 1024 * 1024,
        files: 8,
    },

    fileFilter: (req, file, cb) => {
        const extension = require("path")
            .extname(file.originalname)
            .toLowerCase();

        if (
            !ALLOWED_IMAGE_TYPES.has(file.mimetype) ||
            !ALLOWED_EXTENSIONS.has(extension)
        ) {
            return cb(
                new Error(
                    "Only JPG, JPEG, PNG, and WebP images are allowed."
                )
            );
        }

        cb(null, true);
    },
});

function handleUploadError(error, req, res, next) {
    if (error instanceof multer.MulterError) {
        if (error.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "Each image must be 8 MB or smaller.",
            });
        }

        if (error.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({
                success: false,
                message: "You can upload a maximum of 8 images.",
            });
        }

        if (error.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({
                success: false,
                message: "Unexpected image upload.",
            });
        }

        return res.status(400).json({
            success: false,
            message: "Invalid image upload.",
        });
    }

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.message || "Invalid image upload.",
        });
    }

    next();
}

async function validateUploadedImages(files) {
    const allowedTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
    ]);

    for (const file of files || []) {
        const detected = await fromBuffer(file.buffer);

        if (!detected || !allowedTypes.has(detected.mime)) {
            throw new Error(
                "Invalid image file. Only real JPG, PNG, and WebP images are allowed."
            );
        }
    }
}

function validateProductInput(data, isUpdate = false) {
    const errors = [];

    const {
        name,
        metal_type,
        purity,
        weight_grams,
        making_charges,
        stone_price,
        in_stock,
    } = data || {};

    // Name
    if (!isUpdate || name !== undefined) {
        if (
            typeof name !== "string" ||
            name.trim().length < 2 ||
            name.trim().length > 150
        ) {
            errors.push("Name must be between 2 and 150 characters.");
        }
    }

    // Metal type
    if (!isUpdate || metal_type !== undefined) {
        if (!["gold", "silver"].includes(metal_type)) {
            errors.push("metal_type must be 'gold' or 'silver'.");
        }
    }

    // Numeric fields
    const numericFields = [
        ["weight_grams", weight_grams],
        ["making_charges", making_charges],
        ["stone_price", stone_price],
    ];

    for (const [field, value] of numericFields) {
        if (value !== undefined && value !== null && value !== "") {
            const number = Number(value);

            if (!Number.isFinite(number) || number < 0) {
                errors.push(`${field} must be a non-negative number.`);
            }
        }
    }

    // Purity
    if (purity !== undefined && purity !== null && purity !== "") {
        const normalizedPurity = String(purity).trim().toUpperCase();
        const validPurities = ["24K", "22K", "18K", "999", "925"];

        if (!validPurities.includes(normalizedPurity)) {
            errors.push(
                "purity must be one of 24K, 22K, 18K, 999, or 925."
            );
        }
    }

    // Stock
    if (in_stock !== undefined && in_stock !== null && in_stock !== "") {
        if (!["0", "1", 0, 1, true, false, "true", "false"].includes(in_stock)) {
            errors.push("in_stock must be 0 or 1.");
        }
    }

    return errors;
}

module.exports = function createAdminRouter(pool) {
    const router = express.Router();

    const adminLoginLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 10,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: {
            success: false,
            message: "Too many login attempts. Please try again later.",
        },
    });

    // ============================================================
    // LOGIN
    // ============================================================
    router.post("/login", adminLoginLimiter, async (req, res) => {
        try {
            const { username, password } = req.body || {};

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message: "Username and password are required",
                });
            }

            const expectedUsername = process.env.ADMIN_USERNAME;
            const expectedHash = process.env.ADMIN_PASSWORD_HASH;

            if (!expectedUsername || !expectedHash || !process.env.JWT_SECRET) {
                console.error(
                    "ADMIN_USERNAME / ADMIN_PASSWORD_HASH not set in .env"
                );
                return res.status(500).json({
                    success: false,
                    message: "Admin login is not configured on the server",
                });
            }
            if (username !== expectedUsername) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid username or password",
                });
            }

            const passwordMatches = await bcrypt.compare(password, expectedHash);

            if (!passwordMatches) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid username or password",
                });
            }

            const token = jwt.sign(
                { username, role: "admin" },
                process.env.JWT_SECRET,
                { expiresIn: "8h" }
            );

            res.json({ success: true, token, username });

        } catch (error) {
            console.error("Admin login error:", error);
            res.status(500).json({ success: false, message: "Login failed" });
        }
    });

    // ============================================================
    // WHO AM I (used by the admin frontend to check a saved token
    // is still valid on page load)
    // ============================================================
    router.get("/me", requireAdminAuth, (req, res) => {
        res.json({ success: true, username: req.admin.username });
    });

    // ============================================================
    // LIST ALL PRODUCTS (both metals, including out-of-stock)
    // ============================================================
    router.get("/products", requireAdminAuth, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    p.*,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', pi.id,
                                'image_url', pi.image_url,
                                'sort_order', pi.sort_order
                            )
                            ORDER BY pi.sort_order, pi.id
                        ) FILTER (WHERE pi.id IS NOT NULL),
                        '[]'
                    ) AS images
                FROM products p
                LEFT JOIN product_images pi ON pi.product_id = p.id
                GROUP BY p.id
                ORDER BY p.created_at DESC
            `);

            res.json({ success: true, products: result.rows });

        } catch (error) {
            console.error("Admin list products error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to load products",
                error: error.message,
            });
        }
    });

    // ============================================================
    // CREATE PRODUCT (multipart/form-data, field name "images")
    // ============================================================
    router.post(
        "/products",
        requireAdminAuth,
        upload.array("images", 8),
        async (req, res) => {
            const client = await pool.connect();

            try {
                await validateUploadedImages(req.files);

                const validationErrors = validateProductInput(req.body);

                if (validationErrors.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid product data",
                        errors: validationErrors,
                    });
                }

                const {
                    name,
                    category,
                    description,
                    metal_type,
                    purity,
                    weight_grams,
                    making_charges,
                    stone_price,
                    in_stock,
                } = req.body;

                if (!name || !metal_type) {
                    return res.status(400).json({
                        success: false,
                        message: "Name and metal_type are required",
                    });
                }

                if (!["gold", "silver"].includes(metal_type)) {
                    return res.status(400).json({
                        success: false,
                        message: "metal_type must be 'gold' or 'silver'",
                    });
                }

                await client.query("BEGIN");

                const insertResult = await client.query(
                    `
                    INSERT INTO products
                        (name, category, description, metal_type, purity,
                         weight_grams, making_charges, stone_price, in_stock)
                    VALUES
                        ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                    RETURNING *
                    `,
                    [
                        name,
                        category || null,
                        description || null,
                        metal_type,
                        purity || null,
                        Number(weight_grams) || 0,
                        Number(making_charges) || 0,
                        Number(stone_price) || 0,
                        in_stock === undefined ? 1 : Number(in_stock),
                    ]
                );

                const product = insertResult.rows[0];

                const uploadedImages = await uploadProductImages(
                    client,
                    product.id,
                    req.files
                );

                await client.query("COMMIT");

                res.json({
                    success: true,
                    product: { ...product, images: uploadedImages },
                });

            } catch (error) {
                await client.query("ROLLBACK");
                console.error("Create product error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to create product",
                    error: error.message,
                });
            } finally {
                client.release();
            }
        }
    );

    // ============================================================
    // UPDATE PRODUCT (fields + optionally append new images)
    // ============================================================
    router.put(
        "/products/:id",
        requireAdminAuth,
        upload.array("images", 8),
        async (req, res) => {
            const client = await pool.connect();

            try {
                await validateUploadedImages(req.files);

                const id = Number(req.params.id);

                if (!Number.isInteger(id)) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid product ID",
                    });
                }

                const {
                    name,
                    category,
                    description,
                    metal_type,
                    purity,
                    weight_grams,
                    making_charges,
                    stone_price,
                    in_stock,
                } = req.body;

                if (metal_type && !["gold", "silver"].includes(metal_type)) {
                    return res.status(400).json({
                        success: false,
                        message: "metal_type must be 'gold' or 'silver'",
                    });
                }

                await client.query("BEGIN");

                const updateResult = await client.query(
                    `
                    UPDATE products SET
                        name = COALESCE($1, name),
                        category = COALESCE($2, category),
                        description = COALESCE($3, description),
                        metal_type = COALESCE($4, metal_type),
                        purity = COALESCE($5, purity),
                        weight_grams = COALESCE($6, weight_grams),
                        making_charges = COALESCE($7, making_charges),
                        stone_price = COALESCE($8, stone_price),
                        in_stock = COALESCE($9, in_stock)
                    WHERE id = $10
                    RETURNING *
                    `,
                    [
                        name ?? null,
                        category ?? null,
                        description ?? null,
                        metal_type ?? null,
                        purity ?? null,
                        weight_grams !== undefined ? Number(weight_grams) : null,
                        making_charges !== undefined ? Number(making_charges) : null,
                        stone_price !== undefined ? Number(stone_price) : null,
                        in_stock !== undefined ? Number(in_stock) : null,
                        id,
                    ]
                );

                if (updateResult.rows.length === 0) {
                    await client.query("ROLLBACK");
                    return res.status(404).json({
                        success: false,
                        message: "Product not found",
                    });
                }

                const product = updateResult.rows[0];

                if (req.files && req.files.length > 0) {
                    await uploadProductImages(client, product.id, req.files);
                }

                const imagesResult = await client.query(
                    `SELECT id, image_url, sort_order
                     FROM product_images
                     WHERE product_id = $1
                     ORDER BY sort_order, id`,
                    [product.id]
                );

                await client.query("COMMIT");

                res.json({
                    success: true,
                    product: { ...product, images: imagesResult.rows },
                });

            } catch (error) {
                await client.query("ROLLBACK");
                console.error("Update product error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update product",
                    error: error.message,
                });
            } finally {
                client.release();
            }
        }
    );

    // ============================================================
    // DELETE A SINGLE PRODUCT IMAGE
    // ============================================================
    router.delete(
        "/products/:id/images/:imageId",
        requireAdminAuth,
        async (req, res) => {
            try {
                const { id, imageId } = req.params;

                const result = await pool.query(
                    `DELETE FROM product_images
                     WHERE id = $1 AND product_id = $2
                     RETURNING storage_path`,
                    [imageId, id]
                );

                if (result.rows.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Image not found",
                    });
                }

                if (result.rows[0].storage_path) {
                    await deleteFromSupabase(result.rows[0].storage_path);
                }

                res.json({ success: true });

            } catch (error) {
                console.error("Delete image error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to delete image",
                    error: error.message,
                });
            }
        }
    );

    // ============================================================
    // DELETE PRODUCT (cascades to product_images rows; also
    // removes the photos from Cloudinary so storage doesn't leak)
    // ============================================================
    router.delete("/products/:id", requireAdminAuth, async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid product ID",
                });
            }

            const imagesResult = await pool.query(
                `SELECT storage_path FROM product_images WHERE product_id = $1`,
                [id]
            );

            const deleteResult = await pool.query(
                `DELETE FROM products WHERE id = $1 RETURNING id`,
                [id]
            );

            if (deleteResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Product not found",
                });
            }

            for (const row of imagesResult.rows) {
                if (row.storage_path) {
                    await deleteFromSupabase(row.storage_path);
                }
            }

            res.json({ success: true });

        } catch (error) {
            console.error("Delete product error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to delete product",
                error: error.message,
            });
        }
    });

    // ============================================================
    // CUSTOMER ENQUIRIES
    // ============================================================
    router.get("/enquiries", requireAdminAuth, async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT id, customer_name, phone, message, product_id,
                       status, created_at, updated_at
                FROM customer_enquiries
                ORDER BY CASE WHEN status = 'new' THEN 0 ELSE 1 END, created_at DESC
            `);
            res.json({ success: true, enquiries: result.rows });
        } catch (error) {
            console.error("Admin list enquiries error:", error);
            res.status(500).json({ success: false, message: "Failed to load enquiries", error: error.message });
        }
    });

    router.patch("/enquiries/:id", requireAdminAuth, async (req, res) => {
        try {
            const id = Number(req.params.id);
            const status = String(req.body?.status || "").trim().toLowerCase();
            const allowedStatuses = ["new", "contacted", "follow-up", "completed"];
            if (!Number.isInteger(id) || !allowedStatuses.includes(status)) {
                return res.status(400).json({ success: false, message: "Invalid enquiry id or status" });
            }
            const result = await pool.query(
                `UPDATE customer_enquiries
                 SET status = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING *`,
                [status, id]
            );
            if (!result.rowCount) {
                return res.status(404).json({ success: false, message: "Enquiry not found" });
            }
            res.json({ success: true, enquiry: result.rows[0] });
        } catch (error) {
            console.error("Update enquiry error:", error);
            res.status(500).json({ success: false, message: "Failed to update enquiry" });
        }
    });

    router.delete("/enquiries/:id", requireAdminAuth, async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (!Number.isInteger(id)) {
                return res.status(400).json({ success: false, message: "Invalid enquiry id" });
            }
            const result = await pool.query("DELETE FROM customer_enquiries WHERE id = $1 RETURNING id", [id]);
            if (!result.rowCount) {
                return res.status(404).json({ success: false, message: "Enquiry not found" });
            }
            res.json({ success: true });
        } catch (error) {
            console.error("Delete enquiry error:", error);
            res.status(500).json({ success: false, message: "Failed to delete enquiry" });
        }
    });

    // ============================================================
    // SILVER RATE — owner enters this manually (no external API)
    // ============================================================
    router.get("/silver-rate", requireAdminAuth, async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT purity, rate_per_gram, updated_at FROM silver_rates`
            );

            const rates = {};
            for (const row of result.rows) {
                rates[row.purity] = Number(row.rate_per_gram);
            }

            res.json({
                success: true,
                rate_999: rates["999"] ?? 0,
                rate_925: rates["925"] ?? 0,
            });

        } catch (error) {
            console.error("Get silver rate error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to load silver rate",
                error: error.message,
            });
        }
    });

    router.put("/silver-rate", requireAdminAuth, async (req, res) => {
        try {
            const { rate_999, rate_925 } = req.body || {};

            if (
                !Number.isFinite(Number(rate_999)) ||
                !Number.isFinite(Number(rate_925))
            ) {
                return res.status(400).json({
                    success: false,
                    message: "rate_999 and rate_925 must both be numbers",
                });
            }

            await pool.query(
                `
                INSERT INTO silver_rates (purity, rate_per_gram, updated_at)
                VALUES
                    ('999', $1, CURRENT_TIMESTAMP),
                    ('925', $2, CURRENT_TIMESTAMP)
                ON CONFLICT (purity) DO UPDATE
                SET rate_per_gram = EXCLUDED.rate_per_gram,
                    updated_at = CURRENT_TIMESTAMP
                `,
                [Number(rate_999), Number(rate_925)]
            );

            res.json({ success: true, rate_999: Number(rate_999), rate_925: Number(rate_925) });

        } catch (error) {
            console.error("Update silver rate error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update silver rate",
                error: error.message,
            });
        }
    });

    // ============================================================
    // HELPER — upload files to Cloudinary + insert product_images rows
    // ============================================================
    async function uploadProductImages(client, productId, files) {
        if (!files || files.length === 0) {
            return [];
        }

        if (!isSupabaseConfigured) {
            console.error(
                "Supabase Storage is not configured — skipping image upload."
            );
            return [];
        }

        const existingCountResult = await client.query(
            `SELECT COUNT(*)::int AS count
         FROM product_images
         WHERE product_id = $1`,
            [productId]
        );

        let sortOrder = existingCountResult.rows[0].count;

        const inserted = [];

        for (const file of files) {
            const { url, path } = await uploadBufferToSupabase(
                file.buffer,
                file.originalname,
                `products/${productId}`
            );

            const result = await client.query(
                `
            INSERT INTO product_images
                (product_id, image_url, storage_path, sort_order)
            VALUES
                ($1, $2, $3, $4)
            RETURNING id, image_url, storage_path, sort_order
            `,
                [productId, url, path, sortOrder]
            );

            inserted.push(result.rows[0]);

            sortOrder++;
        }

        return inserted;
    }

    return router;
};