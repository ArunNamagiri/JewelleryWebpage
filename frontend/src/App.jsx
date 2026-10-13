import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import MarketRates from "./components/MarketRates";
import SilverRates from "./components/SilverRates";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  // =========================
  // USER
  // =========================

  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem("ai_jewellery_user")) || null,
  );

  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  // =========================
  // NAVIGATION
  // =========================

  const [currentView, setCurrentView] = useState("catalog");

  // =========================
  // CONTACT ENQUIRY
  // =========================

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSending, setContactSending] = useState(false);
  const [contactSuccess, setContactSuccess] = useState("");

  useEffect(() => {
    if (currentView === "contact") {
      setContactName(user?.name || "");
      setContactPhone(user?.phone || "");
    }
  }, [currentView, user]);

  const submitContactEnquiry = async () => {
    if (!contactName.trim() || !contactPhone.trim() || !contactMessage.trim()) {
      alert("Please enter your name, mobile number, and message.");
      return;
    }

    setContactSending(true);
    setContactSuccess("");

    try {
      const response = await fetch(`${API_URL}/api/enquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName.trim(),
          phone: contactPhone.trim(),
          message: contactMessage.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to send enquiry.");
      }

      setContactMessage("");
      setContactSuccess(
        "Your enquiry was received. We will contact you shortly.",
      );

      if (data.whatsapp_url) {
        window.location.href = data.whatsapp_url;
      }
    } catch (error) {
      alert(error.message || "Unable to send enquiry.");
    } finally {
      setContactSending(false);
    }
  };

  // =========================
  // DATA
  // =========================

  const [products, setProducts] = useState([]);
  const [goldRates, setGoldRates] = useState(null);

  // =========================
  // METAL (gold / silver)
  // =========================

  const [selectedMetal, setSelectedMetal] = useState("gold");

  const categories = [
    "Rings",
    "Necklaces",
    "Earrings",
    "Bangles & Bracelets",
    "Chains",
  ];

  const [cart, setCart] = useState([]);

  // =========================
  // FILTERS
  // =========================

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
  const [loading, setLoading] = useState(false);

  // =========================
  // ONBOARDING
  // =========================

  const handleOnboardingSubmit = (e) => {
    e.preventDefault();

    if (!nameInput.trim() || phoneInput.length !== 10) {
      alert("Please enter a valid name and 10-digit mobile number.");
      return;
    }

    const userData = {
      name: nameInput.trim(),
      phone: phoneInput,
    };

    setUser(userData);

    localStorage.setItem("ai_jewellery_user", JSON.stringify(userData));
  };

  // =========================
  // PRODUCTS
  // =========================

  const fetchCatalogData = async () => {
    setLoading(true);

    try {
      let url = `${API_URL}/api/products`;

      const params = new URLSearchParams();

      params.append("sort", sortOrder);
      params.append("metal", selectedMetal);

      if (selectedCategory) {
        params.append("category", selectedCategory);
      }

      if (searchQuery) {
        params.append("q", searchQuery);
      }

      url += `?${params.toString()}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("Failed to fetch products");
      }

      const data = await response.json();

      if (data.success) {
        setProducts(data.products || []);

        if (data.gold_rates) {
          setGoldRates(data.gold_rates);
        }
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Failed to load catalog:", error);

      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Load products after login
  useEffect(() => {
    if (user) {
      fetchCatalogData();
    }
  }, [user, selectedCategory, sortOrder, selectedMetal]);

  // =========================
  // SEARCH
  // =========================

  const handleSearchSubmit = (e) => {
    e.preventDefault();

    fetchCatalogData();
  };

  // =========================
  // CART
  // =========================

  const addToCart = (product) => {
    setCart((previous) => {
      const existing = previous.find((item) => item.id === product.id);

      if (existing) {
        return previous.map((item) =>
          item.id === product.id
            ? {
                ...item,
                qty: item.qty + 1,
              }
            : item,
        );
      }

      return [
        ...previous,
        {
          ...product,
          qty: 1,
        },
      ];
    });

    alert(`${product.name} added to cart!`);
  };

  const removeFromCart = (productId) => {
    setCart((previous) => previous.filter((item) => item.id !== productId));
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + Number(item.calculated_price || 0) * item.qty,
    0,
  );

  // =========================
  // TIMER FORMAT
  // =========================

  const formatTimer = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;

    return `${String(minutes).padStart(
      2,
      "0",
    )}:${String(secs).padStart(2, "0")}`;
  };

  // =========================
  // LOGOUT
  // =========================

  const logout = () => {
    localStorage.removeItem("ai_jewellery_user");

    setUser(null);
    setCart([]);
  };

  // ============================================================
  // ONBOARDING SCREEN
  // ============================================================

  if (!user) {
    return (
      <div
        style={{
          backgroundColor: "#fcf8f2",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            background: "#ffffff",
            width: "100%",
            maxWidth: "480px",
            padding: "48px 40px",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
            border: "1px solid #f0eae1",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "28px",
              marginBottom: "16px",
            }}
          >
            ✨
          </div>

          <h1
            style={{
              fontFamily: "serif",
              fontSize: "1.8rem",
              color: "#112217",
              margin: "0 0 10px 0",
              fontWeight: "normal",
            }}
          >
            Welcome to AI Jewellery
            <br />
            Store
          </h1>

          <p
            style={{
              color: "#666",
              fontSize: "0.85rem",
              marginBottom: "32px",
            }}
          >
            Enter your name and mobile number to explore or continue
          </p>

          <form
            onSubmit={handleOnboardingSubmit}
            style={{
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  color: "#444",
                  marginBottom: "8px",
                }}
              >
                YOUR NAME
              </label>

              <input
                type="text"
                placeholder="e.g. Priya Sharma"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: "8px",
                  border: "1px solid #dcd6cd",
                  background: "#faf8f5",
                  fontSize: "0.95rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  fontWeight: "bold",
                  letterSpacing: "1px",
                  color: "#444",
                  marginBottom: "8px",
                }}
              >
                MOBILE NUMBER
              </label>

              <div
                style={{
                  display: "flex",
                  border: "1px solid #dcd6cd",
                  borderRadius: "8px",
                  background: "#faf8f5",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    padding: "14px 16px",
                    background: "#efece6",
                    color: "#444",
                    fontWeight: "500",
                    borderRight: "1px solid #dcd6cd",
                  }}
                >
                  +91
                </span>

                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  maxLength="10"
                  value={phoneInput}
                  onChange={(e) =>
                    setPhoneInput(e.target.value.replace(/\D/g, ""))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    border: "none",
                    background: "transparent",
                    fontSize: "0.95rem",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: "100%",
                padding: "16px",
                background: "#112217",
                color: "#ffffff",
                border: "none",
                borderRadius: "8px",
                fontSize: "0.95rem",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Continue to Store →
            </button>
          </form>

          <div
            style={{
              marginTop: "30px",
              fontSize: "0.75rem",
              color: "#888",
            }}
          >
            🔒 Your information is secure and used only for order updates.
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN STORE
  // ============================================================

  return (
    <div
      style={{
        fontFamily: "Inter, system-ui, sans-serif",
        backgroundColor: "#fcf8f2",
        minHeight: "100vh",
        color: "#112217",
      }}
    >
      {/* GOLD RATE DISCLAIMER BAR */}

      <div
        style={{
          background: "#3a2f1c",
          color: "#f0eadf",
          padding: "8px 24px",
          textAlign: "center",
          fontSize: "0.75rem",
          letterSpacing: "0.3px",
        }}
      >
        Gold and silver rates shown are indicative and updated periodically —
        they may differ from real-time market rates. Please confirm the final
        price with us before purchase.
      </div>

      {/* HEADER */}

      <header
        style={{
          background: "#112217",
          color: "#fff",
          padding: "20px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "15px",
          }}
        >
          <div
            style={{
              width: "38px",
              height: "38px",
              border: "1px solid #d4af37",
              borderRadius: "50%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "#d4af37",
              fontFamily: "serif",
            }}
          >
            Sai
          </div>

          <div>
            <h2
              style={{
                margin: 0,
                fontFamily: "serif",
                fontSize: "1.1rem",
                fontWeight: "normal",
              }}
            >
              Sai Jewellery Store
            </h2>

            <span
              style={{
                fontSize: "0.65rem",
                color: "#d4af37",
                letterSpacing: "1.5px",
                textTransform: "uppercase",
              }}
            >
              Fine Gold & Bridal Jewellery
            </span>
          </div>
        </div>

        <nav
          style={{
            display: "flex",
            gap: "25px",
            fontSize: "0.9rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            onClick={() => setCurrentView("catalog")}
            style={{
              cursor: "pointer",
            }}
          >
            Home
          </span>

          <span
            onClick={() => setCurrentView("catalog")}
            style={{
              cursor: "pointer",
              color: currentView === "catalog" ? "#d4af37" : "#fff",
            }}
          >
            Catalog
          </span>

          <span
            onClick={() => setCurrentView("contact")}
            style={{
              cursor: "pointer",
            }}
          >
            Contact
          </span>

          <span
            onClick={() => setCurrentView("cart")}
            style={{
              cursor: "pointer",
            }}
          >
            Cart ({cart.reduce((sum, item) => sum + item.qty, 0)})
          </span>

          <span
            onClick={logout}
            style={{
              cursor: "pointer",
              fontSize: "0.8rem",
              color: "#aaa",
            }}
          >
            Logout
          </span>
        </nav>
      </header>

      <main
        style={{
          maxWidth: "1320px",
          margin: "40px auto",
          padding: "0 24px",
        }}
      >
        {/* =====================================================
            CATALOG
        ====================================================== */}

        {currentView === "catalog" && (
          <>
            <div
              style={{
                marginBottom: "30px",
              }}
            >
              <p
                style={{
                  textTransform: "uppercase",
                  fontSize: "0.7rem",
                  color: "#b79a59",
                  letterSpacing: "2.5px",
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Our Collection
              </p>

              <h1
                style={{
                  fontFamily: "serif",
                  fontSize: "2.8rem",
                  margin: "8px 0 0",
                  fontWeight: "normal",
                }}
              >
                {/* Full Catalog */}
              </h1>
            </div>

            {/* METAL TOGGLE */}
            <div
              style={{
                display: "flex",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              {[
                { key: "gold", label: "Gold" },
                { key: "silver", label: "Silver" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => setSelectedMetal(option.key)}
                  style={{
                    padding: "10px 24px",
                    borderRadius: "999px",
                    border:
                      selectedMetal === option.key
                        ? "1px solid #112217"
                        : "1px solid #dcd6cd",
                    background:
                      selectedMetal === option.key ? "#112217" : "#fff",
                    color: selectedMetal === option.key ? "#fff" : "#112217",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {/* LIVE MARKET RATES */}
            {selectedMetal === "silver" ? <SilverRates /> : <MarketRates />}

            {/* Existing search */}

            {/* Existing products */}

            <form
              onSubmit={handleSearchSubmit}
              style={{
                display: "flex",
                gap: "15px",
                marginBottom: "30px",
                background: "#fff",
                padding: "18px",
                borderRadius: "10px",
                border: "1px solid #e2dacd",
                flexWrap: "wrap",
              }}
            >
              <input
                type="search"
                placeholder="Search by name, e.g. 'ring'"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "200px",
                  padding: "12px 16px",
                  borderRadius: "6px",
                  border: "1px solid #dcd6cd",
                  background: "#faf8f5",
                }}
              />

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: "12px 16px",
                  borderRadius: "6px",
                  border: "1px solid #dcd6cd",
                  minWidth: "180px",
                }}
              >
                <option value="">All Categories</option>

                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                style={{
                  padding: "12px 16px",
                  borderRadius: "6px",
                  border: "1px solid #dcd6cd",
                  minWidth: "180px",
                }}
              >
                <option value="newest">Newest First</option>

                <option value="price_low">Price: Low to High</option>

                <option value="price_high">Price: High to Low</option>

                <option value="name">Name: A to Z</option>
              </select>

              <button
                type="submit"
                style={{
                  padding: "12px 28px",
                  background: "#112217",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Filter
              </button>
            </form>

            <p
              style={{
                fontWeight: 500,
                color: "#666",
                marginBottom: "25px",
              }}
            >
              {products.length} pieces found
            </p>

            {/* PRODUCTS */}

            {loading ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px",
                }}
              >
                Loading collection...
              </div>
            ) : products.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px",
                  background: "#fff",
                  borderRadius: "10px",
                }}
              >
                No jewellery products found.
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "25px",
                }}
              >
                {products.map((product) => (
                  <div
                    key={product.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2dacd",
                      borderRadius: "10px",
                      padding: "20px",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: "8px",
                        overflow: "hidden",
                        background: "#f0eae1",
                        marginBottom: "12px",
                        position: "relative",
                      }}
                    >
                      {(() => {
                        const thumbnail =
                          product.images && product.images.length > 0
                            ? product.images[0].image_url
                            : product.image_filename
                              ? `${API_URL}/uploads/${product.image_filename}`
                              : null;

                        return thumbnail ? (
                          <img
                            src={thumbnail}
                            alt={product.name}
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "cover",
                              display: "block",
                            }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : null;
                      })()}

                      {product.images && product.images.length > 1 && (
                        <span
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            right: "8px",
                            background: "rgba(17,34,23,0.75)",
                            color: "#fff",
                            fontSize: "0.7rem",
                            padding: "2px 8px",
                            borderRadius: "999px",
                          }}
                        >
                          +{product.images.length - 1} more
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        fontSize: "0.65rem",
                        textTransform: "uppercase",
                        color: "#b79a59",
                        fontWeight: 700,
                      }}
                    >
                      {product.category}
                    </span>

                    <h3
                      style={{
                        fontSize: "1.1rem",
                        margin: "8px 0 6px",
                      }}
                    >
                      {product.name}
                    </h3>

                    <p
                      style={{
                        fontSize: "0.8rem",
                        color: "#666",
                      }}
                    >
                      Purity: <strong>{product.purity}</strong>
                      {" • "}
                      Weight: <strong>{product.weight_grams}g</strong>
                    </p>

                    <p
                      style={{
                        color: "#666",
                        fontSize: "0.85rem",
                      }}
                    >
                      {product.description}
                    </p>

                    <div
                      style={{
                        borderTop: "1px solid #f0eae1",
                        paddingTop: "15px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "1.2rem",
                          fontWeight: 700,
                        }}
                      >
                        ₹
                        {Number(product.calculated_price || 0).toLocaleString(
                          "en-IN",
                          {
                            minimumFractionDigits: 2,
                          },
                        )}
                      </span>

                      <button
                        onClick={() => addToCart(product)}
                        style={{
                          padding: "8px 16px",
                          background: "#112217",
                          border: "none",
                          color: "#fff",
                          borderRadius: "6px",
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* =====================================================
            CART
        ====================================================== */}

        {currentView === "cart" && (
          <div
            style={{
              maxWidth: "800px",
              margin: "0 auto",
              background: "#fff",
              padding: "35px",
              borderRadius: "10px",
              border: "1px solid #e2dacd",
            }}
          >
            <h2
              style={{
                fontFamily: "serif",
                fontWeight: "normal",
              }}
            >
              Your Shopping Cart
            </h2>

            {cart.length === 0 ? (
              <p style={{ color: "#666" }}>
                Your cart is empty.{" "}
                <span
                  onClick={() => setCurrentView("catalog")}
                  style={{
                    color: "#b79a59",
                    cursor: "pointer",
                    textDecoration: "underline",
                  }}
                >
                  Browse catalog
                </span>
              </p>
            ) : (
              <>
                {cart.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: "1px solid #f0eae1",
                      padding: "16px 0",
                    }}
                  >
                    <div>
                      <h4>{item.name}</h4>

                      <p
                        style={{
                          color: "#666",
                        }}
                      >
                        Qty: {item.qty}
                      </p>
                    </div>

                    <div>
                      <strong>
                        ₹
                        {(
                          Number(item.calculated_price || 0) * item.qty
                        ).toLocaleString("en-IN")}
                      </strong>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        style={{
                          marginLeft: "20px",
                          background: "#fde8e8",
                          color: "#c53030",
                          border: "none",
                          padding: "6px 12px",
                          borderRadius: "4px",
                          cursor: "pointer",
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                <div
                  style={{
                    marginTop: "30px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <h3>
                    Total: ₹
                    {cartTotal.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
                  </h3>

                  <button
                    onClick={() =>
                      alert("Checkout will be connected to the Node API next.")
                    }
                    style={{
                      background: "#112217",
                      color: "#fff",
                      border: "none",
                      padding: "14px 28px",
                      borderRadius: "6px",
                      fontWeight: 600,
                    }}
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* =====================================================
            CONTACT
        ====================================================== */}

        {currentView === "contact" && (
          <div
            style={{
              maxWidth: "600px",
              margin: "0 auto",
              background: "#fff",
              padding: "35px",
              borderRadius: "10px",
              border: "1px solid #e2dacd",
            }}
          >
            <h2
              style={{
                fontFamily: "serif",
                fontWeight: "normal",
              }}
            >
              Contact
            </h2>

            <p
              style={{
                color: "#666",
              }}
            >
              Have questions about custom bridal pieces or live bullion rates?
              Get in touch with our specialists.
            </p>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
              }}
            >
              <input
                type="text"
                placeholder="Your Name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                style={{ padding: "12px 16px" }}
              />

              <input
                type="tel"
                placeholder="Mobile Number"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                style={{ padding: "12px 16px" }}
              />

              <textarea
                placeholder="Your Message / Custom Design Inquiry"
                rows="4"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                style={{ padding: "12px 16px" }}
              />

              {contactSuccess && (
                <div
                  style={{
                    padding: "12px 14px",
                    background: "#eef8f0",
                    color: "#176b2c",
                    borderRadius: "6px",
                    fontSize: "0.9rem",
                  }}
                >
                  {contactSuccess}
                </div>
              )}

              <button
                onClick={submitContactEnquiry}
                disabled={contactSending}
                style={{
                  padding: "14px",
                  background: "#112217",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: contactSending ? "wait" : "pointer",
                  opacity: contactSending ? 0.7 : 1,
                }}
              >
                {contactSending ? "Sending..." : "Send Message"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
