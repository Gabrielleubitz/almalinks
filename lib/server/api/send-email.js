import { sendTransactionalEmail } from "../transactional-email.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isDev = process.env.NODE_ENV === "development";

function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const body = req.body || {};
    const to = typeof body.to === "string" ? body.to.trim().toLowerCase() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const text = typeof body.text === "string" ? body.text : "";
    const html = typeof body.html === "string" ? body.html : "";

    if (!to || !subject) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing to or subject" });
    }
    if (!text && !html) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing text or html body" });
    }

    if (!EMAIL_REGEX.test(to)) {
      return res.status(400).json({ ok: false, error: "Invalid email address" });
    }

    const innerHtml = html || text.split(/\n/).map((p) => `<p>${escapeHtml(p)}</p>`).join("");
    const result = await sendTransactionalEmail({
      to,
      subject,
      html: innerHtml,
      text: text || undefined,
    });

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: result.error || "Failed to send email",
      });
    }
    return res.status(200).json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error("[send-email] Error:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: isDev ? (err?.message || String(err)) : "Failed to send email"
    });
  }
}
