import React, { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function MarketRates() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(600);

const fetchRates = async () => {
  try {
    setError("");
    setLoading(true);

    const response = await fetch(
      `${API_URL}/api/gold-rates`
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log("FULL GOLD RATE DATA:", data.gold_rates);

    if (!data.success || !data.gold_rates) {
      throw new Error("Invalid gold rate response");
    }

    setRates(data.gold_rates);

  } catch (error) {
    console.error("Gold rate fetch error:", error);
    setError("Unable to load live gold rates");

  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    // Initial request
    fetchRates();

    // Refresh every 10 minutes (matches backend cache)
    const interval = setInterval(fetchRates, 10 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    // Tick the countdown every second
    const tick = setInterval(() => {
      setSecondsUntilRefresh((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearInterval(tick);
    };
  }, []);

  const formatPrice = (value) => {
    if (
      value === undefined ||
      value === null ||
      !Number.isFinite(Number(value))
    ) {
      return "—";
    }

    return Number(value).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatCountdown = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;

    return `${minutes}:${String(secs).padStart(2, "0")}`;
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
      {/* Header */}

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
            Today's Live Gold Rates
          </h2>

          <p
            style={{
              margin: "12px 0 0 0",
              fontSize: "18px",
              color: "#687079",
            }}
          >
            Live market-linked prices
            {" • "}
            <strong>Last synced at:</strong> {rates?.synced_at || "—"}
          </p>

          <p
            style={{
              margin: "8px 0 0 0",
              fontSize: "17px",
              color: "#687079",
            }}
          >
            Source: {rates?.source || "—"}
            {" • "}
            <strong>
              Next refresh in: {formatCountdown(secondsUntilRefresh)}
            </strong>
          </p>
        </div>

        {/* LIVE indicator */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: "#16803c",
            fontWeight: 600,
            fontSize: "16px",
          }}
        >
          <span
            style={{
              width: "9px",
              height: "9px",
              borderRadius: "50%",
              background: "#16803c",
              display: "inline-block",
            }}
          />
          LIVE
        </div>
      </div>

      {/* Error */}

      {error && (
        <div
          style={{
            color: "#b42318",
            marginBottom: "18px",
            fontSize: "15px",
          }}
        >
          {error}
        </div>
      )}

      {/* Rate Cards */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "28px",
        }}
      >
        {/* 24K */}

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
          <div
            style={{
              color: "#7a7d82",
              fontSize: "16px",
              marginBottom: "10px",
            }}
          >
            24K GOLD / GRAM
          </div>

          <div
            style={{
              color: "#0d261b",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            {loading ? "—" : `₹${formatPrice(rates?.rate_24k)}`}
          </div>
        </div>

        {/* 22K */}

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
          <div
            style={{
              color: "#7a7d82",
              fontSize: "16px",
              marginBottom: "10px",
            }}
          >
            22K GOLD / GRAM
          </div>

          <div
            style={{
              color: "#0d261b",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            {loading ? "—" : `₹${formatPrice(rates?.rate_22k)}`}
          </div>
        </div>

        {/* 18K */}

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
          <div
            style={{
              color: "#7a7d82",
              fontSize: "16px",
              marginBottom: "10px",
            }}
          >
            18K GOLD / GRAM
          </div>

          <div
            style={{
              color: "#0d261b",
              fontSize: "28px",
              fontWeight: 700,
            }}
          >
            {loading ? "—" : `₹${formatPrice(rates?.rate_18k)}`}
          </div>
        </div>
      </div>
    </section>
  );
}
