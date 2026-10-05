import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { ArrowUpRight, BookOpen, CheckCircle2, Clipboard, Clock3, FileSignature, FolderOpen, Handshake, Mail, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import { SalesPageHeading } from '@/components/SalesLayout';
import { salesApi } from '@/features/sales/salesApi';
import type { SalesRep, SalesHubMetrics } from '@/features/sales/types';
import { formatBusinessPhone, ghlUrl, onboardingUrl, playbookUrl, salesDriveUrl, salesSignature, salesWonUrl } from '@/features/sales/salesHome.mjs';

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border p-5 sm:p-6 ${className}`} style={{ backgroundColor: 'var(--as-surface)', borderColor: 'var(--as-border)' }}>{children}</section>;
}

const resources = [
  { title: 'Gmail', detail: 'Your company inbox and email signature settings.', href: 'https://mail.google.com/', icon: Mail },
  { title: 'Google Meet', detail: 'Start or join a meeting with your company account.', href: 'https://meet.google.com/', icon: Handshake },
  { title: 'Slack', detail: 'Internal questions, #salesteam, and caller follow-up.', href: 'https://slack.com/signin', icon: MessageSquare },
  { title: 'GHL pipeline', detail: 'Leads, ownership, calls, notes, and next steps.', href: ghlUrl, icon: Phone },
  { title: 'Sales playbook', detail: 'Product guidance and the current closing workflow.', href: playbookUrl, icon: BookOpen },
  { title: 'Onboarding checklist', detail: 'Your access, setup, and contractor onboarding.', href: onboardingUrl, icon: CheckCircle2 },
  { title: 'Sales resource library', detail: 'Operating Philosophy and approved materials.', href: salesDriveUrl, icon: FolderOpen },
  { title: 'Operating Philosophy', detail: 'Our principles and how we serve customers.', href: 'https://drive.google.com/file/d/1oJ75E5cGKS0BDoNdJ8cUUEDc2-absDvh/view', icon: BookOpen },
  { title: 'Playbook PDF', detail: 'The printable product and workflow field guide.', href: 'https://drive.google.com/file/d/1kIAmU1wU6xy-yf370KcWUOqFEwPlJOdq/view', icon: FileSignature },
  { title: '#sales-won', detail: 'Celebrate confirmed wins with the group.', href: salesWonUrl, icon: MessageSquare },
  { title: 'Customer support', detail: 'For product or account help: support@alphasourceai.com.', href: 'mailto:support@alphasourceai.com', icon: Mail },
];
const checks = [
  'Sign in to your company email, Slack, GHL, and this sales dashboard with your own accounts.',
  'Join #salesteam and #sales-won; enable Slack and company-email notifications.',
  'Install the GHL app; verify your assigned caller ID, microphone, and incoming-call notifications.',
  'Arrange an answered and a missed-call check on your own device with your alphaSource contact.',
];

export default function SalesHomePage({ rep }: { rep: SalesRep }) {
  const [counts, setCounts] = useState<SalesHubMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [copyStatus, setCopyStatus] = useState('');
  const signature = salesSignature(rep);
  const businessPhone = formatBusinessPhone(rep.business_phone_e164);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setCounts(null);
    void salesApi.getHubMetrics().then((metrics) => {
      if (!active) return;
      if (!['ready', 'in_progress', 'activated', 'activated_mtd'].every(key => Number.isSafeInteger(metrics[key as keyof SalesHubMetrics]) && Number(metrics[key as keyof SalesHubMetrics]) >= 0) || !Number.isFinite(Date.parse(metrics.generated_at))) throw new Error('Team metrics could not be verified.');
      setCounts(metrics);
      setRefreshedAt(new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver' }).format(new Date(metrics.generated_at)));
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Team metrics could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rep.user_id, refresh]);

  async function copySignature() {
    setCopyStatus('');
    try {
      if (typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([signature.html], { type: 'text/html' }),
          'text/plain': new Blob([signature.text], { type: 'text/plain' }),
        })]);
        setCopyStatus('Formatted signature copied. Paste it into Gmail → Settings → See all settings → Signature.');
        return;
      }
    } catch { /* Some browsers allow text but not rich clipboard content. */ }
    try {
      await navigator.clipboard.writeText(signature.text);
      setCopyStatus('Plain-text signature copied. Paste it into your email signature settings.');
    } catch {
      setCopyStatus('Clipboard access is unavailable. Select and copy the plain-text version below.');
    }
  }

  const metrics = [
    { label: 'Ready from GHL', value: counts?.ready, icon: ArrowUpRight, tone: 'text-sky-600 bg-sky-50' },
    { label: 'Deals in progress', value: counts?.in_progress, icon: Clock3, tone: 'text-violet-600 bg-violet-50' },
    { label: 'Closed won · all time', value: counts?.activated, icon: CheckCircle2, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Closed won · this month', value: counts?.activated_mtd, icon: FileSignature, tone: 'text-sky-600 bg-sky-50' },
  ];

  return <>
    <SalesPageHeading eyebrow="Your daily starting point" title="Sales hub" description={`Welcome, ${rep.display_name.split(' ')[0] || 'there'}. Your deals, resources, and next steps in one place.`} action={<Link href="/sales" className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#A380F6] px-5 py-3 text-sm font-black text-white">Open my deals <ArrowUpRight className="h-4 w-4" /></Link>} />

    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-sm font-black" style={{ color: 'var(--as-text)' }}>Team sales snapshot</h2>
      <button type="button" onClick={() => setRefresh(v => v + 1)} disabled={loading} className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-bold disabled:opacity-40" style={{ color: 'var(--as-text-muted)' }}><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>
    </div>
    {error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error} No totals are shown until a successful refresh.</div> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
      {metrics.map(({ label, value, icon: Icon, tone }) => <Panel key={label} className="!p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold" style={{ color: 'var(--as-text-muted)' }}>{label}</p><p className="mt-3 text-2xl font-black" style={{ color: 'var(--as-text)' }}>{loading ? '…' : value ?? '—'}</p></div><span className={`rounded-xl p-3 ${tone}`}><Icon className="h-5 w-5" /></span></div></Panel>)}
    </div>
    <p className="mb-6 mt-3 text-xs leading-relaxed" style={{ color: 'var(--as-text-muted)' }}>Team-wide counts from the sales dashboard. Ready/in-progress are current; wins require activation. This month uses America/Denver; these are not revenue or payroll figures.{refreshedAt && !loading && !error ? ` Updated ${refreshedAt} Mountain time.` : ''}</p>

    <div className="mb-6 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <Panel>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#A380F6]">From pipeline to payment</p>
        <h2 className="mt-2 text-lg font-black" style={{ color: 'var(--as-text)' }}>How to complete a sale</h2>
        <ol className="mt-5 space-y-4">
          {[
            ['Move it in GHL', 'Keep the opportunity assigned to you and Open. Move it to Agreement/Checkout.'],
            ['Complete sale', 'In My deals, find Ready from GHL → Complete sale. Confirm the imported buyer, choose Essential or Pro, and preview the agreement.'],
            ['Send and guide', 'Send the agreement. The buyer signs and pays through the emailed link. Watch the deal status in your workspace.'],
            ['Wait for confirmed activation', 'Closed Won requires signature, required payment, and account activation—not a signature alone. GHL and Slack updates run automatically afterward.'],
          ].map(([title, detail], i) => <li key={title} className="flex gap-3"><span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[#A380F6]/10 text-xs font-black text-[#A380F6]">{i + 1}</span><div><h3 className="text-sm font-black" style={{ color: 'var(--as-text)' }}>{title}</h3><p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: 'var(--as-text-muted)' }}>{detail}</p></div></li>)}
        </ol>
        <p className="mt-5 border-t pt-4 text-xs font-semibold leading-relaxed" style={{ borderColor: 'var(--as-border)', color: 'var(--as-text-muted)' }}>Missing Ready card? Confirm the owner and stage, refresh My deals, then ask in #salesteam. Do not recreate the GHL-linked sale manually or change ownership to force it through.</p>
      </Panel>
      <Panel>
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#02ABE0]">Calls and follow-up</p>
        <h2 className="mt-2 text-lg font-black" style={{ color: 'var(--as-text)' }}>Your business line</h2>
        <p className="mt-4 text-2xl font-black tracking-tight" style={{ color: 'var(--as-text)' }}>{businessPhone || 'No active line assigned'}</p>
        <p className="mt-4 text-sm font-semibold leading-relaxed" style={{ color: 'var(--as-text-muted)' }}>Answer in the GHL mobile or Web App. Do not forward to a personal number. After 15 seconds unanswered, the shared AI assistant can collect an approved message.</p>
        <div className="mt-5 rounded-xl bg-[#02ABE0]/[0.07] p-4 text-xs font-semibold leading-relaxed" style={{ color: 'var(--as-text)' }}>Caller-approved messages go to your <strong>Slack DM and company email</strong>. SMS is off. Check both and follow up; no callback time is promised.</div>
        <Link href="/sales/enterprise" className="mt-5 flex items-center gap-2 text-sm font-black text-[#A380F6]"><Handshake className="h-4 w-4" />Enterprise handoff & demo booking <ArrowUpRight className="h-4 w-4" /></Link>
      </Panel>
    </div>

    <Panel className="mb-6">
      <h2 className="text-lg font-black" style={{ color: 'var(--as-text)' }}>At your fingertips</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{resources.map(({ title, detail, href, icon: Icon }) => <a key={title} href={href} target="_blank" rel="noopener noreferrer" className="group flex gap-3 rounded-xl border p-4 transition-colors hover:border-[#A380F6]/60" style={{ borderColor: 'var(--as-border)' }}><Icon className="mt-0.5 h-4 w-4 flex-none text-[#A380F6]" /><div className="flex-1"><h3 className="flex items-center justify-between gap-2 text-sm font-black" style={{ color: 'var(--as-text)' }}>{title}<ArrowUpRight className="h-3.5 w-3.5 opacity-40" /></h3><p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: 'var(--as-text-muted)' }}>{detail}</p></div></a>)}</div>
    </Panel>

    <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
      <Panel>
        <h2 className="text-lg font-black" style={{ color: 'var(--as-text)' }}>Your email signature</h2>
        <p className="mt-2 text-xs font-semibold leading-relaxed" style={{ color: 'var(--as-text-muted)' }}>Based on Jason’s brand layout, personalized with your company email and assigned business line.</p>
        {rep.access_role === 'sales_rep' ? <>
          <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 text-[#27304e]" dangerouslySetInnerHTML={{ __html: signature.html }} />
          {!businessPhone ? <p className="mt-3 text-xs font-semibold text-amber-600">No active business line is assigned, so this signature omits a phone number. Ask your alphaSource contact before adding one.</p> : null}
          <button type="button" onClick={() => void copySignature()} className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-[#0A1547] px-4 py-2.5 text-xs font-black text-white"><Clipboard className="h-4 w-4" />Copy signature</button>
          <p role="status" className="mt-3 text-xs font-semibold leading-relaxed" style={{ color: 'var(--as-text-muted)' }}>{copyStatus || 'Paste into Gmail signature settings, send yourself a test, and save changes.'}</p>
          <details className="mt-4 text-xs" style={{ color: 'var(--as-text-muted)' }}><summary className="cursor-pointer font-bold">Plain-text version</summary><pre className="mt-3 whitespace-pre-wrap rounded-lg border p-3 font-sans" style={{ borderColor: 'var(--as-border)' }}>{signature.text}</pre></details>
        </> : <p className="mt-5 text-sm font-semibold" style={{ color: 'var(--as-text-muted)' }}>Sign in as a sales representative to view that account’s signature and business line. Admin access does not expose other representatives’ profiles here.</p>}
      </Panel>
      <Panel>
        <h2 className="text-lg font-black" style={{ color: 'var(--as-text)' }}>First-day essentials</h2>
        <p className="mt-2 text-xs font-semibold leading-relaxed" style={{ color: 'var(--as-text-muted)' }}>A session-only self-check—not verified readiness. Track official progress in the onboarding portal.</p>
        <div className="mt-5 space-y-4">{checks.map((item, i) => <label key={item} className="flex cursor-pointer items-start gap-3 text-xs font-semibold leading-relaxed" style={{ color: 'var(--as-text-muted)' }}><input type="checkbox" checked={!!checked[i]} onChange={e => setChecked(v => ({ ...v, [i]: e.target.checked }))} className="mt-0.5 h-4 w-4 flex-none accent-[#A380F6]" />{item}</label>)}</div>
        <p className="mt-5 border-t pt-4 text-xs font-semibold leading-relaxed" style={{ borderColor: 'var(--as-border)', color: 'var(--as-text-muted)' }}>Keep passwords, candidate data, payment details, private agreement links, and tax forms out of Slack and GHL notes. Use only approved pricing and promotions; Enterprise terms go to the executive team.</p>
      </Panel>
    </div>
  </>;
}
