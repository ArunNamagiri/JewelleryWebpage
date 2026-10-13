import React, { useEffect, useState } from "react";

const CATEGORIES = ["Rings", "Necklaces", "Earrings", "Bangles & Bracelets", "Chains"];

const EMPTY_FORM = {
  id: null,
  name: "",
  category: "Rings",
  metal_type: "gold",
  purity: "22K",
  weight_grams: "",
  making_charges: "",
  stone_price: "",
  in_stock: "1",
  description: "",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  borderRadius: "6px",
  border: "1px solid #dcd6cd",
  fontSize: "0.9rem",
};

const labelStyle = {
  display: "block",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.5px",
  color: "#555",
  marginBottom: "5px",
};

export default function AdminDashboard({ apiUrl, token, username, onLogout }) {
  const [tab, setTab] = useState("products"); // "products" | "enquiries" | "silver"

  const authHeaders = { Authorization: `Bearer ${token}` };

  return (
    <div>
      <header
        style={{
          background: "#112217",
          color: "#fff",
          padding: "18px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontFamily: "serif", fontWeight: "normal" }}>
            Owner Dashboard
          </h2>
          <span style={{ fontSize: "0.7rem", color: "#d4af37" }}>Signed in as {username}</span>
        </div>

        <nav style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <span
            onClick={() => setTab("products")}
            style={{ cursor: "pointer", color: tab === "products" ? "#d4af37" : "#fff" }}
          >
            Products
          </span>
          <span
            onClick={() => setTab("enquiries")}
            style={{ cursor: "pointer", color: tab === "enquiries" ? "#d4af37" : "#fff" }}
          >
            Enquiries
          </span>
          <span
            onClick={() => setTab("silver")}
            style={{ cursor: "pointer", color: tab === "silver" ? "#d4af37" : "#fff" }}
          >
            Silver Rate
          </span>
          <a href="/" style={{ color: "#fff", fontSize: "0.85rem" }}>
            View Store
          </a>
          <span onClick={onLogout} style={{ cursor: "pointer", color: "#aaa", fontSize: "0.85rem" }}>
            Logout
          </span>
        </nav>
      </header>

      <main style={{ maxWidth: "1100px", margin: "35px auto", padding: "0 24px" }}>
        {tab === "products" ? (
          <ProductsTab apiUrl={apiUrl} authHeaders={authHeaders} />
        ) : tab === "enquiries" ? (
          <EnquiriesTab apiUrl={apiUrl} authHeaders={authHeaders} />
        ) : (
          <SilverRateTab apiUrl={apiUrl} authHeaders={authHeaders} />
        )}
      </main>
    </div>
  );
}

// ============================================================
// PRODUCTS TAB
// ============================================================

function ProductsTab({ apiUrl, authHeaders }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [files, setFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/admin/products`, { headers: authHeaders });
      const data = await res.json();
      if (data.success) setProducts(data.products);
    } catch (err) {
      console.error("Failed to load products", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setExistingImages([]);
    setFiles([]);
    setError("");
    setShowForm(true);
  };

  const openEditForm = (product) => {
    setForm({
      id: product.id,
      name: product.name || "",
      category: product.category || "Rings",
      metal_type: product.metal_type || "gold",
      purity: product.purity || "",
      weight_grams: product.weight_grams ?? "",
      making_charges: product.making_charges ?? "",
      stone_price: product.stone_price ?? "",
      in_stock: String(product.in_stock ?? 1),
      description: product.description || "",
    });
    setExistingImages(product.images || []);
    setFiles([]);
    setError("");
    setShowForm(true);
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Delete this product permanently?")) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/products/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      loadProducts();
    } catch (err) {
      alert(err.message || "Failed to delete product");
    }
  };

  const handleDeleteImage = async (productId, imageId) => {
    try {
      const res = await fetch(`${apiUrl}/api/admin/products/${productId}/images/${imageId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setExistingImages((prev) => prev.filter((img) => img.id !== imageId));
    } catch (err) {
      alert(err.message || "Failed to delete image");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const body = new FormData();
      body.append("name", form.name);
      body.append("category", form.category);
      body.append("metal_type", form.metal_type);
      body.append("purity", form.purity);
      body.append("weight_grams", form.weight_grams || 0);
      body.append("making_charges", form.making_charges || 0);
      body.append("stone_price", form.stone_price || 0);
      body.append("in_stock", form.in_stock || 0);
      body.append("description", form.description);

      for (const file of files) {
        body.append("images", file);
      }

      const isEdit = Boolean(form.id);
      const url = isEdit
        ? `${apiUrl}/api/admin/products/${form.id}`
        : `${apiUrl}/api/admin/products`;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: authHeaders, // no Content-Type: browser sets multipart boundary
        body,
      });

      const data = await res.json();
      if (!data.success) {
        const details = Array.isArray(data.errors) ? `: ${data.errors.join(" ")}` : "";
        throw new Error((data.message || "Save failed") + details);
      }

      setShowForm(false);
      loadProducts();
    } catch (err) {
      setError(err.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const purityOptions =
    form.metal_type === "silver" ? ["999", "925"] : ["24K", "22K", "18K"];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <h3 style={{ margin: 0, fontFamily: "serif", fontWeight: "normal", fontSize: "1.4rem" }}>
          Products ({products.length})
        </h3>
        <button onClick={openAddForm} style={primaryButtonStyle}>
          + Add Product
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSave}
          style={{
            background: "#fff",
            border: "1px solid #e2dacd",
            borderRadius: "10px",
            padding: "24px",
            marginBottom: "28px",
          }}
        >
          <h4 style={{ marginTop: 0 }}>{form.id ? "Edit Product" : "New Product"}</h4>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>NAME</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>

            <div>
              <label style={labelStyle}>CATEGORY</label>
              <select
                style={inputStyle}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>METAL</label>
              <select
                style={inputStyle}
                value={form.metal_type}
                onChange={(e) => {
                  const metal = e.target.value;
                  setForm({ ...form, metal_type: metal, purity: metal === "silver" ? "999" : "22K" });
                }}
              >
                <option value="gold">Gold</option>
                <option value="silver">Silver</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>PURITY</label>
              <select
                style={inputStyle}
                value={form.purity}
                onChange={(e) => setForm({ ...form, purity: e.target.value })}
              >
                {purityOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>WEIGHT (grams)</label>
              <input
                type="number" step="0.001" style={inputStyle}
                value={form.weight_grams}
                onChange={(e) => setForm({ ...form, weight_grams: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>MAKING CHARGES (₹)</label>
              <input
                type="number" step="0.01" style={inputStyle}
                value={form.making_charges}
                onChange={(e) => setForm({ ...form, making_charges: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>STONE PRICE (₹)</label>
              <input
                type="number" step="0.01" style={inputStyle}
                value={form.stone_price}
                onChange={(e) => setForm({ ...form, stone_price: e.target.value })}
              />
            </div>

            <div>
              <label style={labelStyle}>IN STOCK (qty)</label>
              <input
                type="number" style={inputStyle}
                value={form.in_stock}
                onChange={(e) => setForm({ ...form, in_stock: e.target.value })}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>DESCRIPTION</label>
            <textarea
              rows="3" style={inputStyle}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          {existingImages.length > 0 && (
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>EXISTING PHOTOS</label>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {existingImages.map((img) => (
                  <div key={img.id} style={{ position: "relative" }}>
                    <img
                      src={img.image_url}
                      alt=""
                      style={{ width: "70px", height: "70px", objectFit: "cover", borderRadius: "6px", border: "1px solid #e2dacd" }}
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteImage(form.id, img.id)}
                      title="Remove photo"
                      style={{
                        position: "absolute", top: "-6px", right: "-6px",
                        background: "#c53030", color: "#fff", border: "none",
                        borderRadius: "50%", width: "20px", height: "20px",
                        cursor: "pointer", fontSize: "0.7rem", lineHeight: "20px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>
              {existingImages.length > 0 ? "ADD MORE PHOTOS" : "PHOTOS"} (up to 8)
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files))}
            />
            {files.length > 0 && (
              <p style={{ fontSize: "0.8rem", color: "#666" }}>{files.length} file(s) selected</p>
            )}
          </div>

          {error && <div style={{ color: "#c53030", marginBottom: "14px" }}>{error}</div>}

          <div style={{ display: "flex", gap: "12px" }}>
            <button type="submit" disabled={saving} style={primaryButtonStyle}>
              {saving ? "Saving..." : form.id ? "Save Changes" : "Create Product"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading products...</p>
      ) : products.length === 0 ? (
        <p style={{ color: "#666" }}>No products yet. Click "+ Add Product" to create one.</p>
      ) : (
        <div style={{ display: "grid", gap: "12px" }}>
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: "16px",
                background: "#fff", border: "1px solid #e2dacd", borderRadius: "8px", padding: "14px 18px",
              }}
            >
              <div style={{ width: "56px", height: "56px", borderRadius: "6px", overflow: "hidden", background: "#f0eae1", flexShrink: 0 }}>
                {p.images?.[0]?.image_url && (
                  <img src={p.images[0].image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
              </div>

              <div style={{ flex: 1 }}>
                <strong>{p.name}</strong>{" "}
                <span style={{ fontSize: "0.75rem", color: "#888" }}>
                  {p.metal_type === "silver" ? "Silver" : "Gold"} • {p.purity} • {p.category}
                </span>
                <div style={{ fontSize: "0.75rem", color: "#888" }}>
                  {p.weight_grams}g • Stock: {p.in_stock} • {p.images?.length || 0} photo(s)
                </div>
              </div>

              <button onClick={() => openEditForm(p)} style={secondaryButtonStyle}>Edit</button>
              <button onClick={() => handleDeleteProduct(p.id)} style={dangerButtonStyle}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CUSTOMER ENQUIRIES TAB
// ============================================================

function EnquiriesTab({ apiUrl, authHeaders }) {
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEnquiries = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${apiUrl}/api/admin/enquiries`, { headers: authHeaders });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load enquiries");
      setEnquiries(data.enquiries || []);
    } catch (err) {
      setError(err.message || "Failed to load enquiries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id, status) => {
    try {
      const res = await fetch(`${apiUrl}/api/admin/enquiries/${id}`, {
        method: "PATCH",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to update enquiry");
      setEnquiries((prev) => prev.map((item) => item.id === id ? { ...item, ...data.enquiry } : item));
    } catch (err) {
      alert(err.message || "Failed to update enquiry");
    }
  };

  const deleteEnquiry = async (id) => {
    if (!window.confirm("Delete this enquiry permanently?")) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/enquiries/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to delete enquiry");
      setEnquiries((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      alert(err.message || "Failed to delete enquiry");
    }
  };

  const whatsappUrl = (phone, name, message) => {
    const digits = String(phone || "").replace(/\D/g, "");
    const text = `Hello ${name || ""},\n\nThank you for contacting Sai Jewellery.\n\nYour enquiry:\n${message || ""}\n\nWe will assist you shortly.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  };

  const statusLabel = (status) => {
    if (status === "follow-up") return "FOLLOW-UP";
    return String(status || "NEW").toUpperCase();
  };

  if (loading) return <p>Loading enquiries...</p>;
  if (error) return <p style={{ color: "#c53030" }}>{error}</p>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
        <div>
          <h3 style={{ margin: 0, fontFamily: "serif", fontWeight: "normal", fontSize: "1.4rem" }}>
            Customer Enquiries ({enquiries.length})
          </h3>
          <p style={{ margin: "5px 0 0", color: "#777", fontSize: "0.8rem" }}>
            Contact form submissions are saved here until you complete them.
          </p>
        </div>
        <button onClick={loadEnquiries} style={secondaryButtonStyle}>Refresh</button>
      </div>

      {enquiries.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #e2dacd", borderRadius: "10px", padding: "28px", color: "#777" }}>
          No customer enquiries yet.
        </div>
      ) : (
        <div style={{ display: "grid", gap: "14px" }}>
          {enquiries.map((item) => (
            <div key={item.id} style={{ background: "#fff", border: "1px solid #e2dacd", borderRadius: "10px", padding: "18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <strong style={{ fontSize: "1rem" }}>{item.customer_name}</strong>
                  <div style={{ marginTop: "5px", fontSize: "0.85rem" }}>📱 {item.phone}</div>
                </div>
                <span style={{ fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.5px", padding: "5px 9px", borderRadius: "20px", background: item.status === "new" ? "#fff3cd" : "#f0eadf", color: "#6b5200" }}>
                  {statusLabel(item.status)}
                </span>
              </div>

              <div style={{ margin: "14px 0", padding: "12px 14px", background: "#faf8f4", borderRadius: "6px", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {item.message}
              </div>

              <div style={{ color: "#888", fontSize: "0.72rem", marginBottom: "14px" }}>
                {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
              </div>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <a href={`tel:${item.phone}`} style={{ ...secondaryButtonStyle, textDecoration: "none" }}>📞 Call</a>
                <a href={whatsappUrl(item.phone, item.customer_name, item.message)} target="_blank" rel="noreferrer" style={{ ...primaryButtonStyle, textDecoration: "none" }}>💬 WhatsApp</a>
                <select value={item.status} onChange={(e) => updateStatus(item.id, e.target.value)} style={{ ...inputStyle, width: "auto", minWidth: "140px" }}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="follow-up">Follow-up</option>
                  <option value="completed">Completed</option>
                </select>
                <button onClick={() => deleteEnquiry(item.id)} style={dangerButtonStyle}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SILVER RATE TAB
// ============================================================

function SilverRateTab({ apiUrl, authHeaders }) {
  const [rate999, setRate999] = useState("");
  const [rate925, setRate925] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`${apiUrl}/api/admin/silver-rate`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setRate999(String(data.rate_999 ?? ""));
          setRate925(String(data.rate_925 ?? ""));
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`${apiUrl}/api/admin/silver-rate`, {
        method: "PUT",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ rate_999: Number(rate999), rate_925: Number(rate925) }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setMessage("Silver rate updated.");
    } catch (err) {
      setMessage(err.message || "Failed to update silver rate");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ background: "#fff", border: "1px solid #e2dacd", borderRadius: "10px", padding: "28px", maxWidth: "420px" }}>
      <h3 style={{ marginTop: 0, fontFamily: "serif", fontWeight: "normal" }}>Silver Rate (per gram)</h3>
      <p style={{ fontSize: "0.8rem", color: "#888", marginBottom: "20px" }}>
        Set manually — unlike gold, silver rates aren't pulled from a live API.
        Update this whenever your rate changes.
      </p>

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>999 (FINE SILVER) — ₹/gram</label>
          <input type="number" step="0.01" style={inputStyle} value={rate999} onChange={(e) => setRate999(e.target.value)} required />
        </div>

        <div style={{ marginBottom: "20px" }}>
          <label style={labelStyle}>925 (STERLING SILVER) — ₹/gram</label>
          <input type="number" step="0.01" style={inputStyle} value={rate925} onChange={(e) => setRate925(e.target.value)} required />
        </div>

        {message && <p style={{ fontSize: "0.85rem", color: message.includes("updated") ? "#16803c" : "#c53030" }}>{message}</p>}

        <button type="submit" disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving..." : "Save Rate"}
        </button>
      </form>
    </div>
  );
}

const primaryButtonStyle = {
  padding: "10px 20px",
  background: "#112217",
  color: "#fff",
  border: "none",
  borderRadius: "6px",
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  padding: "9px 16px",
  background: "#f0eadf",
  color: "#112217",
  border: "1px solid #dcd6cd",
  borderRadius: "6px",
  cursor: "pointer",
};

const dangerButtonStyle = {
  padding: "9px 16px",
  background: "#fde8e8",
  color: "#c53030",
  border: "none",
  borderRadius: "6px",
  cursor: "pointer",
};
