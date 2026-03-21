import { useEffect } from "react";

const features = [
  {
    id: "dashboard",
    badge: "Operations Hub",
    title: "Live Operations Dashboard",
    description: "Instant visibility across your entire operation. KPI tiles surface missed services, low stock items, and expiring contracts at a glance — with one-click drill-down into every metric.",
    accent: "#2563eb",
    lightBg: "#eff6ff",
    mockup: (
      <div className="p-4 font-sans">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 14 }}>
          {[
            { label: "Services Today", value: "12", color: "#2563eb" },
            { label: "Missed Services", value: "3", color: "#dc2626" },
            { label: "Low Stock Items", value: "5", color: "#d97706" },
            { label: "Expiring Contracts", value: "2", color: "#7c3aed" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 600, color: "#374151" }}>Recent Services</div>
          {[
            { client: "ABC Company", type: "Monthly Service", status: "completed", color: "#16a34a" },
            { client: "XYZ Corp", type: "Weekly Clean", status: "scheduled", color: "#2563eb" },
            { client: "Retail Hub", type: "Quarterly Install", status: "missed", color: "#dc2626" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#1e293b" }}>{s.client}</div>
                <div style={{ fontSize: 10, color: "#94a3b8" }}>{s.type}</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: s.color, background: s.color + "18", padding: "2px 8px", borderRadius: 99 }}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "services",
    badge: "Scheduling",
    title: "Smart Service Scheduling",
    description: "Manage once-off installations and complex recurring contracts — daily, weekly, fortnightly, monthly and beyond. Full calendar view with team colour-coding and instant status updates.",
    accent: "#0891b2",
    lightBg: "#ecfeff",
    mockup: (
      <div className="p-4 font-sans">
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["Mon 17", "Tue 18", "Wed 19", "Thu 20", "Fri 21"].map((d, i) => (
            <div key={d} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#64748b", marginBottom: 4 }}>{d}</div>
              {i === 2
                ? <div style={{ background: "#0891b2", color: "#fff", borderRadius: 6, padding: "5px 4px", fontSize: 9, fontWeight: 600 }}>Today</div>
                : <div style={{ background: "#f1f5f9", borderRadius: 6, padding: "5px 4px", fontSize: 9, color: "#374151" }}>&nbsp;</div>}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[
            { client: "Shopping Mall A", time: "08:00", team: "Hygiene", teamColor: "#2563eb", status: "completed" },
            { client: "Office Park B", time: "10:30", team: "Tech", teamColor: "#7c3aed", status: "scheduled" },
            { client: "Hospital C", time: "14:00", team: "Hygiene", teamColor: "#2563eb", status: "missed" },
            { client: "Retail Strip D", time: "16:00", team: "Tech", teamColor: "#7c3aed", status: "scheduled" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: s.teamColor + "0d", border: `1px solid ${s.teamColor}30`, borderRadius: 8, padding: "7px 10px" }}>
              <div style={{ width: 3, height: 32, borderRadius: 99, background: s.teamColor, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b" }}>{s.client}</div>
                <div style={{ fontSize: 9, color: "#94a3b8" }}>{s.time} · {s.team}</div>
              </div>
              <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: s.status === "completed" ? "#dcfce7" : s.status === "missed" ? "#fee2e2" : "#dbeafe", color: s.status === "completed" ? "#16a34a" : s.status === "missed" ? "#dc2626" : "#2563eb", fontWeight: 600 }}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "mobile",
    badge: "Mobile App",
    title: "Android Field App",
    description: "Empower field teams with a native Android app. Workers view their daily schedule, record consumable usage, capture photos, collect digital signatures from clients — all offline-capable.",
    accent: "#16a34a",
    lightBg: "#f0fdf4",
    mockup: (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "12px 4px" }}>
        <div style={{ width: 140, background: "#111827", borderRadius: 20, padding: "10px 8px", boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }}>
          <div style={{ background: "#1f2937", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ background: "#16a34a", padding: "10px 10px 8px", color: "#fff" }}>
              <div style={{ fontSize: 9, opacity: 0.8 }}>Today's Services</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>4 scheduled</div>
            </div>
            <div style={{ padding: "6px 8px", display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { name: "Hospital Ward", time: "08:00", done: true },
                { name: "Office Park", time: "10:30", done: true },
                { name: "Shopping Mall", time: "13:00", done: false },
                { name: "Retail Store", time: "15:30", done: false },
              ].map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#374151", borderRadius: 8, padding: "5px 8px" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 7, background: s.done ? "#16a34a" : "#4b5563", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {s.done && <span style={{ color: "#fff", fontSize: 8, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 8, fontWeight: 600, color: "#f9fafb" }}>{s.name}</div>
                    <div style={{ fontSize: 7, color: "#9ca3af" }}>{s.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "4px 8px 8px" }}>
              <div style={{ background: "#16a34a", color: "#fff", borderRadius: 8, padding: "6px", textAlign: "center", fontSize: 8, fontWeight: 700 }}>Complete Service →</div>
            </div>
          </div>
        </div>
        <div style={{ marginLeft: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {["Photo capture", "Digital sign-off", "Consumable log", "GPS verified"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 14, height: 14, borderRadius: 7, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 8, color: "#16a34a", fontWeight: 700 }}>✓</span>
              </div>
              <span style={{ fontSize: 10, color: "#374151" }}>{f}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "invoicing",
    badge: "Billing",
    title: "Seamless Invoicing",
    description: "Every completed service is captured — including recurring visits. Filter by date, team or status, mark jobs as invoiced individually or in bulk, and keep billing perfectly in sync.",
    accent: "#7c3aed",
    lightBg: "#f5f3ff",
    mockup: (
      <div className="p-4 font-sans">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Completed", value: "48", color: "#374151" },
            { label: "Invoiced", value: "41", color: "#16a34a" },
            { label: "Pending", value: "7", color: "#d97706" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 10px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ background: "#f8fafc", padding: "5px 10px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 4, borderBottom: "1px solid #e2e8f0" }}>
            {["Client", "Date", "Status"].map(h => <div key={h} style={{ fontSize: 9, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>{h}</div>)}
          </div>
          {[
            { client: "Shopping Mall A", date: "15 Mar", status: "invoiced", color: "#16a34a", bg: "#dcfce7" },
            { client: "Office Park B", date: "16 Mar", status: "invoiced", color: "#16a34a", bg: "#dcfce7" },
            { client: "Hospital C", date: "18 Mar", status: "pending", color: "#d97706", bg: "#fef3c7" },
            { client: "Retail Strip D", date: "19 Mar", status: "pending", color: "#d97706", bg: "#fef3c7" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "6px 10px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 4, alignItems: "center", borderBottom: i < 3 ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#1e293b" }}>{s.client}</div>
              <div style={{ fontSize: 10, color: "#64748b" }}>{s.date}</div>
              <span style={{ fontSize: 8, fontWeight: 700, color: s.color, background: s.bg, padding: "2px 6px", borderRadius: 99, display: "inline-block" }}>{s.status}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "inventory",
    badge: "Stock Control",
    title: "Inventory Management",
    description: "Track every equipment unit and consumable with stock codes, barcodes and QR codes. Set minimum stock thresholds, get automatic low-stock alerts, and manage equipment templates for fast setup.",
    accent: "#ea580c",
    lightBg: "#fff7ed",
    mockup: (
      <div className="p-4 font-sans">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 12 }}>
          {[
            { label: "Equipment", value: "64", color: "#2563eb" },
            { label: "In Field", value: "38", color: "#16a34a" },
            { label: "Consumables", value: "12", color: "#7c3aed" },
            { label: "Low Stock", value: "3", color: "#dc2626" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {[
            { name: "Hygiene Station Pro", code: "HS-001", stock: 12, status: "in_warehouse", alert: false },
            { name: "Foam Soap 700ml", code: "CS-042", stock: 2, status: "low_stock", alert: true },
            { name: "Sanitiser Dispenser", code: "SD-007", stock: 8, status: "in_field", alert: false },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: item.alert ? "#fff7ed" : "#f8fafc", borderRadius: 8, padding: "8px 12px", border: `1px solid ${item.alert ? "#fed7aa" : "#e2e8f0"}` }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#1e293b" }}>{item.name}</div>
                <div style={{ fontSize: 9, color: "#94a3b8" }}>{item.code}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: item.alert ? "#ea580c" : "#374151" }}>{item.stock}</div>
                <div style={{ fontSize: 8, color: item.alert ? "#ea580c" : "#94a3b8" }}>{item.alert ? "⚠ low stock" : item.status.replace("_", " ")}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "warehouse",
    badge: "Forecasting",
    title: "Warehouse & Stock Forecasting",
    description: "Know exactly what leaves the warehouse before it does. Daily and weekly forecasts calculate consumable requirements based on your live service schedule — so you're never caught short.",
    accent: "#0f766e",
    lightBg: "#f0fdfa",
    mockup: (
      <div className="p-4 font-sans">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 12 }}>
          {[
            { label: "Total Units", value: "128", color: "#374151" },
            { label: "In Warehouse", value: "90", color: "#0f766e" },
            { label: "In Field", value: "38", color: "#2563eb" },
            { label: "Low Stock", value: "3", color: "#d97706" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 6px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden" }}>
          <div style={{ background: "#f0fdfa", padding: "6px 10px", borderBottom: "1px solid #e2e8f0", fontSize: 10, fontWeight: 600, color: "#0f766e" }}>Week 12 Forecast — Consumables Required</div>
          {[
            { name: "Foam Soap 700ml", mon: 8, tue: 6, wed: 10, thu: 6, total: 30 },
            { name: "Hand Sanitiser", mon: 4, tue: 4, wed: 6, thu: 4, total: 18 },
            { name: "Bin Liner 50L", mon: 12, tue: 10, wed: 14, thu: 10, total: 46 },
          ].map((row, i) => (
            <div key={i} style={{ padding: "6px 10px", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr 1fr", gap: 4, alignItems: "center", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#1e293b" }}>{row.name}</div>
              {[row.mon, row.tue, row.wed, row.thu, row.total].map((v, j) => (
                <div key={j} style={{ fontSize: 9, textAlign: "center", color: j === 4 ? "#0f766e" : "#374151", fontWeight: j === 4 ? 700 : 400 }}>{v}</div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "teams",
    badge: "People",
    title: "Team Management",
    description: "Build service teams, assign skilled members, and link them to recurring routes. Role-based access ensures everyone sees only what they need — from field workers to managers.",
    accent: "#be185d",
    lightBg: "#fdf2f8",
    mockup: (
      <div className="p-4 font-sans">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Teams", value: "4", color: "#2563eb" },
            { label: "Members", value: "11", color: "#16a34a" },
            { label: "Assignments", value: "18", color: "#7c3aed" },
          ].map(k => (
            <div key={k.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px", border: "1px solid #e2e8f0", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{k.label}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            { team: "Hygiene Team", color: "#2563eb", members: ["Chris M.", "Sarah K.", "James L."] },
            { team: "Tech Team", color: "#7c3aed", members: ["Mike R.", "Anna T."] },
            { team: "Cleaning Crew", color: "#16a34a", members: ["David P.", "Lisa Q."] },
            { team: "Install Team", color: "#ea580c", members: ["Tom B.", "Kate S.", "Ben H."] },
          ].map((t, i) => (
            <div key={i} style={{ borderRadius: 8, border: `1px solid ${t.color}30`, background: t.color + "08", padding: "8px 10px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.team}</div>
              {t.members.map(m => (
                <div key={m} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, color: "#fff", fontWeight: 700, flexShrink: 0 }}>{m[0]}</div>
                  <span style={{ fontSize: 9, color: "#374151" }}>{m}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "reports",
    badge: "Analytics",
    title: "Reports & Export",
    description: "Generate detailed invoicing reports filtered by date range, team, service interval, and billing status. Export to CSV for your accounting system or PDF for client-ready documents.",
    accent: "#4f46e5",
    lightBg: "#eef2ff",
    mockup: (
      <div className="p-4 font-sans">
        <div style={{ display: "flex", gap: 6, marginBottom: 10, background: "#f1f5f9", padding: 4, borderRadius: 8 }}>
          {["Month", "Week", "Day"].map((v, i) => (
            <div key={v} style={{ flex: 1, textAlign: "center", padding: "4px", borderRadius: 6, background: i === 0 ? "#fff" : "transparent", boxShadow: i === 0 ? "0 1px 3px rgba(0,0,0,0.1)" : "none", fontSize: 9, fontWeight: i === 0 ? 700 : 400, color: i === 0 ? "#1e293b" : "#64748b" }}>{v}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[
            { label: "48 total", color: "#374151", bg: "#f1f5f9" },
            { label: "41 invoiced", color: "#16a34a", bg: "#dcfce7" },
            { label: "7 pending", color: "#d97706", bg: "#fef3c7" },
          ].map(chip => (
            <span key={chip.label} style={{ fontSize: 9, fontWeight: 600, color: chip.color, background: chip.bg, padding: "3px 8px", borderRadius: 99 }}>{chip.label}</span>
          ))}
        </div>
        <div style={{ borderRadius: 8, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 10 }}>
          {[
            { client: "Shopping Mall A", type: "Monthly Service", status: "Invoiced", color: "#16a34a" },
            { client: "Office Park B", type: "Weekly Clean", status: "Invoiced", color: "#16a34a" },
            { client: "Hospital C", type: "Monthly Service", status: "Pending", color: "#d97706" },
          ].map((s, i) => (
            <div key={i} style={{ padding: "6px 10px", display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: 4, alignItems: "center", borderBottom: i < 2 ? "1px solid #f1f5f9" : "none" }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: "#1e293b" }}>{s.client}</div>
              <div style={{ fontSize: 9, color: "#64748b" }}>{s.type}</div>
              <span style={{ fontSize: 8, fontWeight: 700, color: s.color }}>{s.status}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <div style={{ flex: 1, background: "#f1f5f9", borderRadius: 8, padding: "6px", textAlign: "center", fontSize: 9, fontWeight: 600, color: "#374151", border: "1px solid #e2e8f0" }}>↓ Export CSV</div>
          <div style={{ flex: 1, background: "#4f46e5", borderRadius: 8, padding: "6px", textAlign: "center", fontSize: 9, fontWeight: 600, color: "#fff" }}>⎙ Export PDF</div>
        </div>
      </div>
    ),
  },
];

export default function Showcase() {
  useEffect(() => {
    document.title = "Field Service Management – Site Sensei";
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif", background: "#fff", color: "#111827", lineHeight: 1.5, minHeight: "100vh" }}>
      {/* ─── NAV ─── */}
      <nav style={{ borderBottom: "1px solid #f1f5f9", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60, position: "sticky", top: 0, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)", zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>S</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>Site Sensei</span>
        </div>
        <div style={{ display: "flex", gap: 28 }}>
          {features.map(f => (
            <a key={f.id} href={`#${f.id}`} style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget.style.color = "#1e293b")}
              onMouseLeave={e => (e.currentTarget.style.color = "#64748b")}
            >{f.badge}</a>
          ))}
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section style={{ textAlign: "center", padding: "80px 40px 64px", background: "linear-gradient(180deg,#f8fafc 0%,#fff 100%)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 40%, #dbeafe55 0%, transparent 50%), radial-gradient(circle at 80% 60%, #ede9fe55 0%, transparent 50%)", pointerEvents: "none" }} />
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 99, padding: "4px 14px", marginBottom: 24 }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#2563eb" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>Field Service Management Platform</span>
        </div>
        <h1 style={{ fontSize: 52, fontWeight: 800, color: "#0f172a", margin: "0 0 20px", lineHeight: 1.15, letterSpacing: "-1px" }}>
          Every service.<br />
          <span style={{ background: "linear-gradient(90deg,#2563eb,#7c3aed)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Always under control.
          </span>
        </h1>
        <p style={{ fontSize: 18, color: "#64748b", maxWidth: 600, margin: "0 auto 40px", lineHeight: 1.7 }}>
          A unified platform for scheduling recurring field services, managing warehouse stock, tracking field teams, and keeping billing completely in sync.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#2563eb", color: "#fff", padding: "12px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none", boxShadow: "0 4px 16px rgba(37,99,235,0.3)" }}>
            Open Application
          </a>
          <a href="#dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#fff", color: "#374151", padding: "12px 28px", borderRadius: 10, fontWeight: 600, fontSize: 14, textDecoration: "none", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            See Features ↓
          </a>
        </div>

        {/* Stats strip */}
        <div style={{ display: "flex", gap: 48, justifyContent: "center", marginTop: 56, paddingTop: 40, borderTop: "1px solid #f1f5f9" }}>
          {[
            { value: "8", label: "Core Modules" },
            { value: "∞", label: "Recurring Schedules" },
            { value: "PDF + CSV", label: "Report Exports" },
            { value: "Android", label: "Mobile App" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1e293b" }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section style={{ maxWidth: 1140, margin: "0 auto", padding: "24px 40px 80px" }}>
        {features.map((feature, idx) => {
          const isEven = idx % 2 === 0;
          return (
            <div
              id={feature.id}
              key={feature.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 56,
                alignItems: "center",
                padding: "72px 0",
                borderBottom: idx < features.length - 1 ? "1px solid #f1f5f9" : "none",
              }}
            >
              {/* Text */}
              <div style={{ order: isEven ? 0 : 1 }}>
                <span style={{ display: "inline-block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: feature.accent, background: feature.lightBg, padding: "4px 10px", borderRadius: 6, marginBottom: 16 }}>
                  {feature.badge}
                </span>
                <h2 style={{ fontSize: 34, fontWeight: 800, color: "#0f172a", margin: "0 0 16px", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
                  {feature.title}
                </h2>
                <p style={{ fontSize: 16, color: "#64748b", lineHeight: 1.75, margin: 0 }}>
                  {feature.description}
                </p>
              </div>

              {/* Mockup */}
              <div style={{ order: isEven ? 1 : 0 }}>
                <div style={{
                  borderRadius: 16,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                  background: "#fff",
                }}>
                  {/* Browser chrome */}
                  <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ display: "flex", gap: 5 }}>
                      {["#fc5c57", "#fdbc40", "#33c748"].map(c => (
                        <div key={c} style={{ width: 10, height: 10, borderRadius: 5, background: c }} />
                      ))}
                    </div>
                    <div style={{ flex: 1, background: "#fff", borderRadius: 6, height: 22, border: "1px solid #e2e8f0", display: "flex", alignItems: "center", paddingLeft: 8 }}>
                      <span style={{ fontSize: 9, color: "#94a3b8" }}>sitesensei.app / {feature.id}</span>
                    </div>
                  </div>
                  {/* Feature mockup */}
                  {feature.mockup}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* ─── CTA ─── */}
      <section style={{ background: "linear-gradient(135deg,#1e293b,#0f172a)", padding: "72px 40px", textAlign: "center" }}>
        <h2 style={{ fontSize: 38, fontWeight: 800, color: "#fff", margin: "0 0 16px", letterSpacing: "-0.5px" }}>
          Ready to take control of your operations?
        </h2>
        <p style={{ fontSize: 17, color: "#94a3b8", margin: "0 0 36px" }}>
          Start managing services, stock, and field teams from one unified platform.
        </p>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#2563eb", color: "#fff", padding: "14px 36px", borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: "none", boxShadow: "0 4px 24px rgba(37,99,235,0.4)" }}>
          Open the Application →
        </a>
      </section>

      {/* ─── FOOTER / CREDITS ─── */}
      <footer style={{ borderTop: "1px solid #f1f5f9", padding: "40px 40px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg,#2563eb,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 12 }}>S</span>
          </div>
          <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 14 }}>Site Sensei</span>
          <span style={{ color: "#cbd5e1", fontSize: 14 }}>·</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>Field Service Management Platform</span>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>Built &amp; maintained by</div>
          <a href="https://www.gasco.digital" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#60a5fa", fontWeight: 800, fontSize: 10 }}>G</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>Global Application Solutions</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>gasco.digital ↗</span>
          </a>
        </div>
      </footer>
    </div>
  );
}
