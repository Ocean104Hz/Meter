const express = require("express");
const cors = require("cors");
// ถ้า Node < 18 ให้เปิดสองบรรทัดนี้
// const fetch = require("node-fetch");
// globalThis.fetch = fetch;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3000;
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyCOu3CTzb8uTOj-F295poMuY_kd1E4FnYoI8HyuPaWcAHW1bohVGTDAJUS7DUJcq0rOw/exec";

app.post("/addMessage", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.message && !payload.name && !payload.email) {
      return res.status(400).json({ ok: false, error: "Missing required fields" });
    }

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // พยายาม parse JSON ถ้าไม่ได้ ให้เก็บเป็น text
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    let data;
    if (ct.includes("application/json")) {
      data = await resp.json();
    } else {
      const text = await resp.text();
      try { data = JSON.parse(text); }
      catch {
        data = { ok: resp.ok, status: resp.status, raw: text };
      }
    }

    // ส่งกลับเป็น JSON เสมอ
    return res.status(resp.ok ? 200 : 502).json(data);

  } catch (err) {
    console.error("Error sending to Apps Script:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
