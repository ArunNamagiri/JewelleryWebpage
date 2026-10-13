const { createClient } = require("@supabase/supabase-js");

const isSupabaseConfigured = Boolean(
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const supabase = isSupabaseConfigured
    ? createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    : null;

const BUCKET =
    process.env.SUPABASE_STORAGE_BUCKET || "product-images";


async function uploadBufferToSupabase(
    buffer,
    originalName,
    folder = "jewellery-products"
) {
    const extension =
        originalName.includes(".")
            ? originalName.substring(originalName.lastIndexOf("."))
            : ".jpg";

    const fileName = `${folder}/${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}${extension}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, {
            contentType: getContentType(extension),
            upsert: false,
        });

    if (error) {
        throw error;
    }

    const { data } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

    return {
        url: data.publicUrl,
        path: fileName,
    };
}

async function deleteFromSupabase(path) {
    if (!path) return;

    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([path]);

    if (error) {
        console.error(
            "Supabase image delete error:",
            error.message
        );
    }
}

function getContentType(extension) {
    const ext = extension.toLowerCase();

    const types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
    };

    return types[ext] || "application/octet-stream";
}

module.exports = {
    supabase,
    isSupabaseConfigured,
    uploadBufferToSupabase,
    deleteFromSupabase,
};