import React, { useEffect, useState } from "react";

const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function SilverRates() {
    const [rates, setRates] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchRates = async () => {
        try {
            setError("");

            const response = await fetch(
                `${API_URL}/api/silver-rates`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.silver_rates) {
                throw new Error("Invalid silver rate response");
            }

            setRates(data.silver_rates);

        } catch (err) {
            console.error("Silver rate fetch error:", err);
            setError("Unable to load silver rates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRates();
    }, []);

    const formatPrice = (value) => {
        if (value === undefined || value === null || !Number.isFinite(Number(value))) {
            return "—";
        }
        return Number(value).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    };

    return (
        <section
            style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "38px 45px",
                background: "#f0eadf",
                borderTop: "1px solid #ddd4c5",
                borderBottom: "1px solid #ddd4c5",
            }}
        >
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "28px",
                }}
            >
                <div>
                    <h2
                        style={{
                            margin: 0,
                            fontFamily: "Georgia, serif",
                            fontSize: "32px",
                            fontWeight: 500,
                            color: "#0d261b",
                        }}
                    >
                        Today's Silver Rates
                    </h2>

                    <p style={{ margin: "12px 0 0 0", fontSize: "18px", color: "#687079" }}>
                        Set by store owner
                        {" • "}
                        <strong>Last updated:</strong> {rates?.synced_at || "—"}
                    </p>
                </div>

                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        color: "#7a7d82",
                        fontWeight: 600,
                        fontSize: "16px",
                    }}
                >
                    <span
                        style={{
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            background: "#b79a59",
                            display: "inline-block",
                        }}
                    />
                    STORE RATE
                </div>
            </div>

            {error && (
                <div style={{ color: "#b42318", marginBottom: "18px", fontSize: "15px" }}>
                    {error}
                </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "28px" }}>
                <div
                    style={{
                        background: "#fff",
                        border: "1px solid #e4ddd2",
                        borderRadius: "12px",
                        padding: "28px",
                        textAlign: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                >
                    <div style={{ color: "#7a7d82", fontSize: "16px", marginBottom: "10px" }}>
                        999 FINE SILVER / GRAM
                    </div>
                    <div style={{ color: "#0d261b", fontSize: "28px", fontWeight: 700 }}>
                        {loading ? "—" : `₹${formatPrice(rates?.rate_999)}`}
                    </div>
                </div>

                <div
                    style={{
                        background: "#fff",
                        border: "1px solid #e4ddd2",
                        borderRadius: "12px",
                        padding: "28px",
                        textAlign: "center",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                >
                    <div style={{ color: "#7a7d82", fontSize: "16px", marginBottom: "10px" }}>
                        925 STERLING SILVER / GRAM
                    </div>
                    <div style={{ color: "#0d261b", fontSize: "28px", fontWeight: 700 }}>
                        {loading ? "—" : `₹${formatPrice(rates?.rate_925)}`}
                    </div>
                </div>
            </div>
        </section>
    );
}
