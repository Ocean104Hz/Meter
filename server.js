// server.js
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyCOu3CTzb8uTOj-F295poMuY_kd1E4FnYoI8HyuPaWcAHW1bohVGTDAJUS7DUJcq0rOw/exec";

// ใช้ /api/addMessage สำหรับ Vercel
app.post("/api/addMessage", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.message && !payload.name && !payload.email) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing required fields" });
    }

    const resp = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    let data;
    if (ct.includes("application/json")) {
      data = await resp.json();
    } else {
      const text = await resp.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { ok: resp.ok, status: resp.status, raw: text };
      }
    }

    return res.status(resp.ok ? 200 : 502).json(data);
  } catch (err) {
    console.error("Error sending to Apps Script:", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// 👇 สำคัญ: ไม่มี app.listen ใน Vercel
module.exports = (req, res) => app(req, res);
