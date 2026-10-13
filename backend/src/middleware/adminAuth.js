const jwt = require("jsonwebtoken");

// ============================================================
// ADMIN AUTH MIDDLEWARE
// ============================================================
// Expects: Authorization: Bearer <token>
// Token is issued by POST /api/admin/login (see routes/admin.js)

function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    const [scheme, token] = authHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({
            success: false,
            message: "Missing or malformed admin token",
        });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);

        if (payload.role !== "admin") {
            throw new Error("Not an admin token");
        }

        req.admin = { username: payload.username };
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired admin session, please log in again",
        });
    }
}

module.exports = {
    requireAdminAuth,
};