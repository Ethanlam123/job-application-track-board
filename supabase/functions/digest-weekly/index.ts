// Weekly deadline digest: pg_cron (see supabase/cron.sql) or a manual request
// with the service key triggers this. It emails every user whose applications
// have deadlines in the next 7 days, via Resend.
//
// Secrets (supabase secrets set):
//   RESEND_API_KEY       required to send anything
//   DIGEST_FROM_EMAIL    optional, defaults to Resend's test sender
import postgres from 'npm:postgres@3';

const escHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

Deno.serve(async (req) => {
  // verify_jwt is off (pg_cron cannot mint a user JWT); the service key gates access
  const auth = req.headers.get('Authorization') ?? '';
  if (auth !== `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`) {
    return new Response('unauthorized', { status: 401 });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('DIGEST_FROM_EMAIL') ?? 'Pipeline <onboarding@resend.dev>';
  if (!resendKey) {
    return new Response('digest skipped: RESEND_API_KEY not set', { status: 200 });
  }

  const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1 });
  const rows = await sql`
    select u.email, a.company, a.role, a.deadline
    from public.applications a
    join auth.users u on u.id = a.user_id
    where a.deadline between current_date and current_date + interval '7 days'
    order by a.deadline asc`;
  await sql.end({ timeout: 5 });

  const byUser = new Map<string, { company: string; role: string; deadline: string }[]>();
  for (const r of rows) {
    const list = byUser.get(r.email) ?? [];
    list.push({ company: r.company, role: r.role, deadline: String(r.deadline) });
    byUser.set(r.email, list);
  }

  let sent = 0;
  const errors: string[] = [];
  for (const [email, items] of byUser) {
    const list = items
      .map((i) => `<li><strong>${escHtml(i.company)}</strong> - ${escHtml(i.role)} - due ${i.deadline}</li>`)
      .join('');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: email,
        subject: `Pipeline: ${items.length} deadline${items.length > 1 ? 's' : ''} this week`,
        html: `<h2>Due in the next 7 days</h2><ul>${list}</ul><p style="color:#666">Sent by Pipeline, your job application tracker.</p>`,
      }),
    });
    if (res.ok) sent++;
    else errors.push(`${email}: ${res.status}`);
  }

  return new Response(JSON.stringify({ users: byUser.size, sent, errors }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
