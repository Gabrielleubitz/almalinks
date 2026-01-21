import mailchimp from "@mailchimp/mailchimp_transactional";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Use POST" });
  }

  try {
    const apiKey = process.env.MANDRILL_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ ok: false, error: "Missing MANDRILL_API_KEY" });
    }

    const body = req.body || {};
    const to = body.to;
    const subject = body.subject;
    const text = body.text;

    if (!to || !subject || !text) {
      return res
        .status(400)
        .json({ ok: false, error: "Missing to/subject/text" });
    }

    const client = mailchimp(apiKey);

    const result = await client.messages.send({
      message: {
        subject,
        text,
        from_email: process.env.EMAIL_FROM || "Communications@almalinks.org",
        to: [{ email: to, type: "to" }]
      }
    });

    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, error: err?.message || String(err) });
  }
}
