import mailchimp from "@mailchimp/mailchimp_transactional";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isDev = process.env.NODE_ENV === "development";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const apiKey = process.env.MAILCHIMP_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing MAILCHIMP_API_KEY" });
    }

    const body = req.body || {};
    const to = typeof body.to === "string" ? body.to.trim() : "";
    const subject = typeof body.subject === "string" ? body.subject.trim() : "";
    const text = typeof body.text === "string" ? body.text : "";

    if (!to || !subject || !text) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing to, subject, or text" });
    }

    if (!EMAIL_REGEX.test(to)) {
      return res.status(400).json({ ok: false, error: "Invalid email address" });
    }

    const fromEmail = process.env.EMAIL_FROM || "Communications@almalinks.org";
    const client = mailchimp(apiKey);

    const result = await client.messages.send({
      message: {
        subject,
        text,
        from_email: fromEmail,
        to: [{ email: to, type: "to" }]
      }
    });

    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error("[send-email] Error:", err?.message || err);
    return res.status(500).json({
      ok: false,
      error: isDev ? (err?.message || String(err)) : "Failed to send email"
    });
  }
}
