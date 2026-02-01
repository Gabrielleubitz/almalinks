/**
 * Send a test Mailchimp campaign email to a specific address (local only).
 * Usage: node scripts/test-mailchimp-campaign.js   OR   npm run test:mailchimp
 * Requires .env (or .env.local) with MAILCHIMP_AUDIENCE_ID, MAILCHIMP_MARKETING_API_KEY,
 * MAILCHIMP_SERVER, MAILCHIMP_REPLY_TO (and optionally MAILCHIMP_FROM_NAME).
 */
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
config({ path: join(projectRoot, '.env.local') });
config({ path: join(projectRoot, '.env') });
import { createCampaign, setCampaignContent, sendCampaignTest } from '../lib/server/mailchimp-campaign.js';

const TEST_EMAIL = 'gabrielleubitz@gmail.com';

async function main() {
  console.log('📧 Mailchimp test: sending test campaign email to', TEST_EMAIL);
  console.log('');

  try {
    const listId = process.env.MAILCHIMP_AUDIENCE_ID;
    const replyTo = process.env.MAILCHIMP_REPLY_TO;
    const fromName = process.env.MAILCHIMP_FROM_NAME || 'Alma Links';

    if (!listId || !replyTo) {
      console.error('❌ Missing env. Set MAILCHIMP_AUDIENCE_ID, MAILCHIMP_MARKETING_API_KEY, MAILCHIMP_SERVER, MAILCHIMP_REPLY_TO in .env');
      process.exit(1);
    }

    const subjectLine = 'Test – Mailchimp connection';
    const html = `
      <h1>Mailchimp test</h1>
      <p>This is a test email from your Alma Links Mailchimp integration.</p>
      <p>If you received this, the connection works.</p>
      <p><em>Sent at ${new Date().toISOString()}</em></p>
    `;

    const campaign = await createCampaign({
      listId,
      subjectLine,
      fromName,
      replyTo,
    });
    console.log('✅ Campaign created:', campaign.id);

    await setCampaignContent(campaign.id, html);
    console.log('✅ Content set');

    await sendCampaignTest(campaign.id, [TEST_EMAIL]);
    console.log('✅ Test email sent to', TEST_EMAIL);

    console.log('');
    console.log('Done. Check the inbox (and spam) for', TEST_EMAIL);
  } catch (err) {
    console.error('');
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
