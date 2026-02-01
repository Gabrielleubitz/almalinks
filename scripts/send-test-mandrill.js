/**
 * One-off: send a test Mandrill email. Loads .env from project root.
 * Usage: node scripts/send-test-mandrill.js [email]
 * Default email: gabrielleubitz@gmail.com
 */
import '../lib/server/load-env.js';
import { sendTransactionalEmail } from '../lib/server/mandrill.js';

const to = process.argv[2] || 'gabrielleubitz@gmail.com';
const result = await sendTransactionalEmail({
  to,
  subject: 'Mandrill Test Email ✅',
  html: '<h1>Mandrill is working 🎉</h1><p>This is a test email.</p>',
  text: 'Mandrill is working. This is a test email.',
});

if (result.ok) {
  console.log('Sent to', to, '— mandrillStatus:', result.status, 'messageId:', result.messageId);
} else {
  console.error('Send failed:', result.error, result.details || '');
  process.exit(1);
}
