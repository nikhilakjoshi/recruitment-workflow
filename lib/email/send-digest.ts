// Lazy Resend client — instantiated only when send-digest is called with
// RESEND_API_KEY actually set. Keeps the worker importable in environments
// (tests, dev without email) that never send email.
export type SendDigestArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

type Sender = (args: SendDigestArgs) => Promise<{ id: string | null }>;

let senderOverride: Sender | null = null;

// Test-only injection: avoid hitting Resend during tests.
export function _setSenderForTests(fn: Sender | null): void {
  senderOverride = fn;
}

export async function sendDigestEmail(args: SendDigestArgs): Promise<{ id: string | null }> {
  if (senderOverride) return senderOverride(args);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { id: null };
  }
  const { Resend } = await import("resend");
  const client = new Resend(apiKey);
  const result = await client.emails.send({
    from: process.env.RESEND_FROM_ADDRESS ?? "Career OS <digest@careeros.local>",
    to: args.to,
    subject: args.subject,
    text: args.text,
    html: args.html,
  });
  return { id: result.data?.id ?? null };
}
