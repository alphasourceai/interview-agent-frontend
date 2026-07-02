import { useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Clipboard,
  ClipboardCheck,
  Download,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import AdminLayout from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import playbookMarkdown from "../../../../../docs/alphascreen-public-purchase-support-playbook.md?raw";

type MarkdownBlock =
  | { type: "paragraph"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; ordered: boolean; items: string[] };

interface PlaybookSubsection {
  id: string;
  title: string;
  blocks: MarkdownBlock[];
}

interface PlaybookSection {
  id: string;
  title: string;
  shortTitle: string;
  blocks: MarkdownBlock[];
  subsections: PlaybookSubsection[];
  searchText: string;
  isScenario: boolean;
}

const SUPPORT_STANDARD =
  "Every purchase row should be triaged from Admin Public Purchases. Do not manually mark agreements, payments, billing, or account activation outside an approved escalation.";

const quickScenarios = [
  { label: "Agreement pending", match: "agreement pending" },
  { label: "Checkout pending", match: "checkout pending" },
  { label: "Did not return from Stripe", match: "did not return from stripe" },
  { label: "Setup pending", match: "setup pending" },
  { label: "Existing user purchase", match: "existing user purchase" },
  { label: "Wrong buyer email", match: "wrong buyer email" },
  { label: "Duplicate purchase", match: "duplicate purchase" },
  { label: "Refund/cancellation/change request", match: "cancellation, refund, or membership change request" },
  { label: "Webhook/payment mismatch", match: "webhook or payment mismatch" },
];

const defaultOpenTitles = new Set([
  "How a public purchase moves through alphaScreen",
  "1. Overview",
  "2. Public purchase lifecycle",
  "3. Admin Public Purchases page",
]);

const surfaceCardStyle = {
  backgroundColor: "var(--as-surface)",
  border: "1px solid var(--as-border)",
  boxShadow: "var(--as-shadow)",
};
const fieldStyle = {
  backgroundColor: "var(--as-surface)",
  borderColor: "var(--as-border)",
  color: "var(--as-text)",
};
const mutedPanelStyle = {
  backgroundColor: "color-mix(in srgb, var(--as-text) 4%, transparent)",
  borderColor: "var(--as-border)",
};
const primaryTextStyle = { color: "var(--as-text)" };
const mutedTextStyle = { color: "var(--as-text-muted)" };
const subtleTextStyle = { color: "var(--as-text-subtle)" };
const env =
  typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};

function trimTrailingSlashes(value: unknown): string {
  return String(value || "").trim().replace(/\/+$/, "");
}

function firstBase(...values: unknown[]): string {
  for (const value of values) {
    const normalized = trimTrailingSlashes(value);
    if (normalized) return normalized;
  }
  return "";
}

const backendBase = firstBase(
  (env as Record<string, unknown>).VITE_BACKEND_URL,
  (env as Record<string, unknown>).VITE_API_URL,
  (env as Record<string, unknown>).VITE_PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).PUBLIC_BACKEND_URL,
  (env as Record<string, unknown>).BACKEND_URL,
);

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function displayTitle(title: string): string {
  return title.replace(/^\d+\.\s*/, "");
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function stripMarkdown(value: string): string {
  return value.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
}

function parseMarkdownBlocks(lines: string[]): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const paragraphLines: string[] = [];
  let activeList: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: "paragraph", text: paragraphLines.join(" ") });
    paragraphLines.length = 0;
  };

  const flushList = () => {
    if (!activeList) return;
    blocks.push({ type: "list", ordered: activeList.ordered, items: activeList.items });
    activeList = null;
  };

  const flushAll = () => {
    flushParagraph();
    flushList();
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushAll();
      continue;
    }

    const quoteMatch = /^>\s?(.+)$/.exec(line);
    if (quoteMatch) {
      flushAll();
      blocks.push({ type: "quote", text: quoteMatch[1].trim() });
      continue;
    }

    const orderedMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (orderedMatch) {
      flushParagraph();
      if (!activeList || !activeList.ordered) {
        flushList();
        activeList = { ordered: true, items: [] };
      }
      activeList.items.push(orderedMatch[1].trim());
      continue;
    }

    const unorderedMatch = /^-\s+(.+)$/.exec(line);
    if (unorderedMatch) {
      flushParagraph();
      if (!activeList || activeList.ordered) {
        flushList();
        activeList = { ordered: false, items: [] };
      }
      activeList.items.push(unorderedMatch[1].trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushAll();
  return blocks;
}

function parsePlaybook(markdown: string): PlaybookSection[] {
  const sections: PlaybookSection[] = [];
  let current:
    | {
        title: string;
        lines: string[];
        subsections: Array<{ title: string; lines: string[] }>;
      }
    | null = null;
  let currentSubsection: { title: string; lines: string[] } | null = null;

  const finishSubsection = () => {
    if (!current || !currentSubsection) return;
    current.subsections.push(currentSubsection);
    currentSubsection = null;
  };

  const finishSection = () => {
    if (!current) return;
    finishSubsection();
    const sectionId = slugify(current.title);
    const blocks = parseMarkdownBlocks(current.lines);
    const subsections = current.subsections.map((subsection) => ({
      id: `${sectionId}-${slugify(subsection.title)}`,
      title: subsection.title,
      blocks: parseMarkdownBlocks(subsection.lines),
    }));
    const searchText = [
      current.title,
      ...blocks.flatMap((block) =>
        block.type === "list" ? block.items : [block.text],
      ),
      ...subsections.flatMap((subsection) => [
        subsection.title,
        ...subsection.blocks.flatMap((block) =>
          block.type === "list" ? block.items : [block.text],
        ),
      ]),
    ].join(" ").toLowerCase();
    const sectionNumber = /^(\d+)\./.exec(current.title)?.[1];
    sections.push({
      id: sectionId,
      title: current.title,
      shortTitle: displayTitle(current.title),
      blocks,
      subsections,
      searchText,
      isScenario: Boolean(sectionNumber && Number(sectionNumber) >= 5 && Number(sectionNumber) <= 16),
    });
    current = null;
  };

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    if (line.startsWith("# ")) continue;
    if (line === "alphaScreen by alphaSource - internal support guide") continue;
    if (line.startsWith("Audience:")) continue;
    if (line.startsWith("Use this guide when")) continue;
    if (line === "## Support standard") continue;
    if (line.includes(SUPPORT_STANDARD)) continue;
    if (line.startsWith("Admin Public Purchases is the support source of truth")) continue;
    if (line.startsWith("Do not use spreadsheets")) continue;

    const h2 = /^##\s+(.+)$/.exec(line);
    if (h2) {
      finishSection();
      current = { title: h2[1].trim(), lines: [], subsections: [] };
      continue;
    }

    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3 && current) {
      finishSubsection();
      currentSubsection = { title: h3[1].trim(), lines: [] };
      continue;
    }

    if (!current) continue;
    if (currentSubsection) {
      currentSubsection.lines.push(line);
    } else {
      current.lines.push(line);
    }
  }

  finishSection();
  return sections.filter((section) => section.title !== "Table of contents");
}

function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function sectionMatches(section: PlaybookSection, searchTerm: string): boolean {
  if (!searchTerm) return true;
  return section.searchText.includes(searchTerm);
}

function subsectionTone(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized === "support action") return "border-[#A380F6]/25 bg-[#A380F6]/5";
  if (normalized === "do not") return "border-rose-200 bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10";
  if (normalized === "escalate when") return "border-amber-200 bg-amber-50 dark:border-amber-500/25 dark:bg-amber-500/10";
  if (normalized === "symptoms") return "border-sky-200 bg-sky-50 dark:border-sky-500/25 dark:bg-sky-500/10";
  if (normalized === "suggested wording") return "border-[#02D99D]/25 bg-[#02D99D]/5";
  return "border-[var(--as-border)]";
}

function scrollToSection(id: string) {
  const element = document.getElementById(id);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "start" });
  if (typeof window !== "undefined") {
    window.history.replaceState(null, "", `#${id}`);
  }
}

function MarkdownBlocks({
  blocks,
  copyKey,
  copiedKey,
  onCopy,
}: {
  blocks: MarkdownBlock[];
  copyKey: string;
  copiedKey: string | null;
  onCopy: (key: string, text: string) => void;
}) {
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        if (block.type === "quote") {
          const plainText = stripMarkdown(block.text);
          const key = `${copyKey}-quote-${index}`;
          const copied = copiedKey === key;
          return (
            <div key={key} className="rounded-xl border border-[#02D99D]/25 bg-white/70 p-3 dark:bg-white/5">
              <blockquote className="text-sm font-semibold leading-relaxed" style={primaryTextStyle}>
                {renderInline(block.text)}
              </blockquote>
              <button
                type="button"
                onClick={() => onCopy(key, plainText)}
                className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black transition hover:border-[#02D99D] focus:outline-none focus:ring-2 focus:ring-[#02D99D]"
                style={fieldStyle}
              >
                {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />}
                {copied ? "Copied" : "Copy wording"}
              </button>
            </div>
          );
        }

        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={`${copyKey}-list-${index}`}
              className={`${block.ordered ? "list-decimal" : "list-disc"} space-y-2 pl-5 text-sm font-semibold leading-relaxed`}
              style={mutedTextStyle}
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${copyKey}-list-${index}-${itemIndex}`}>{renderInline(item)}</li>
              ))}
            </ListTag>
          );
        }

        return (
          <p key={`${copyKey}-paragraph-${index}`} className="text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}

function PlaybookSectionCard({
  section,
  expanded,
  copiedKey,
  onToggle,
  onCopy,
}: {
  section: PlaybookSection;
  expanded: boolean;
  copiedKey: string | null;
  onToggle: () => void;
  onCopy: (key: string, text: string) => void;
}) {
  const screenshotSection = section.title.includes("Screenshot slots");

  return (
    <section id={section.id} className="scroll-mt-6 rounded-2xl border" style={surfaceCardStyle}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {section.isScenario && (
              <span className="rounded-full bg-[#A380F6]/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#7C5FCC]">
                Scenario
              </span>
            )}
            {screenshotSection && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Placeholder
              </span>
            )}
          </div>
          <h2 className="mt-2 text-lg font-black sm:text-xl" style={primaryTextStyle}>
            {section.shortTitle}
          </h2>
        </div>
        <ChevronDown className={`mt-1 h-5 w-5 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} style={subtleTextStyle} aria-hidden="true" />
      </button>

      {expanded && (
        <div className="space-y-4 border-t px-5 py-5" style={{ borderColor: "var(--as-border)" }}>
          {section.blocks.length > 0 && (
            <MarkdownBlocks blocks={section.blocks} copyKey={section.id} copiedKey={copiedKey} onCopy={onCopy} />
          )}

          <div className={section.subsections.length ? "space-y-3" : "hidden"}>
            {section.subsections.map((subsection) => (
              <div key={subsection.id} className={`rounded-2xl border p-4 ${subsectionTone(subsection.title)}`}>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-sm font-black" style={primaryTextStyle}>
                    {subsection.title}
                  </h3>
                </div>
                <MarkdownBlocks blocks={subsection.blocks} copyKey={subsection.id} copiedKey={copiedKey} onCopy={onCopy} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default function AdminPublicPurchasePlaybookPage() {
  const sections = useMemo(() => parsePlaybook(playbookMarkdown), []);
  const defaultOpenIds = useMemo(
    () => new Set(sections.filter((section) => defaultOpenTitles.has(section.title)).map((section) => section.id)),
    [sections],
  );
  const [searchValue, setSearchValue] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultOpenIds);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [pdfDownloadError, setPdfDownloadError] = useState("");
  const searchTerm = normalizeSearch(searchValue);
  const matchingSections = useMemo(
    () => sections.filter((section) => sectionMatches(section, searchTerm)),
    [sections, searchTerm],
  );
  const scenarioSections = sections.filter((section) => section.isScenario);

  const setSectionExpanded = (id: string, expanded: boolean) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (expanded) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const jumpToSection = (id: string) => {
    setSectionExpanded(id, true);
    window.setTimeout(() => scrollToSection(id), 0);
  };

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1600);
    } catch {
      setCopiedKey(null);
    }
  };

  const expandAll = () => setExpandedIds(new Set(matchingSections.map((section) => section.id)));
  const collapseAll = () => setExpandedIds(new Set());
  const downloadPdf = async () => {
    setPdfDownloadError("");
    if (!backendBase) {
      setPdfDownloadError("PDF download is not configured.");
      return;
    }
    setPdfDownloading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Admin session is required to download the PDF.");

      const response = await fetch(`${backendBase}/admin/public-purchases/playbook.pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "omit",
      });
      if (!response.ok) throw new Error("Could not download the playbook PDF.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "alphascreen-public-purchase-support-playbook.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setPdfDownloadError(error instanceof Error ? error.message : "Could not download the playbook PDF.");
    } finally {
      setPdfDownloading(false);
    }
  };

  return (
    <AdminLayout title="Public Purchase Support Playbook">
      <div className="space-y-6">
        <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={subtleTextStyle}>Admin only</p>
            <h1 className="mt-2 text-2xl font-black sm:text-3xl" style={primaryTextStyle}>
              alphaScreen Public Purchase Support Playbook
            </h1>
            <p className="mt-2 text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
              Internal support guide for self-serve alphaScreen membership purchases.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={downloadPdf}
              disabled={pdfDownloading}
              className="inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-black text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
              style={{ backgroundColor: "#A380F6" }}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {pdfDownloading ? "Downloading..." : "Download PDF"}
            </button>
            <Link
              href="/admin/public-purchases"
              className="inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-black transition hover:border-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
              style={fieldStyle}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Public Purchases
            </Link>
          </div>
        </section>
        {pdfDownloadError && (
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-300">
            {pdfDownloadError}
          </section>
        )}

        <section className="rounded-2xl border p-5" style={surfaceCardStyle}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#A380F6]" aria-hidden="true" />
            <div>
              <p className="text-sm font-black" style={primaryTextStyle}>Support standard</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed" style={mutedTextStyle}>
                {SUPPORT_STANDARD}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border p-4" style={surfaceCardStyle}>
            <BookOpen className="h-5 w-5 text-[#A380F6]" aria-hidden="true" />
            <p className="mt-3 text-sm font-black" style={primaryTextStyle}>Source of truth</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
              Use Admin Public Purchases to review agreement, checkout, setup, and email state.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={surfaceCardStyle}>
            <ClipboardCheck className="h-5 w-5 text-[#02ABE0]" aria-hidden="true" />
            <p className="mt-3 text-sm font-black" style={primaryTextStyle}>Recovery actions</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
              Resend the correct agreement, checkout, setup, or welcome email only when the row allows it.
            </p>
          </div>
          <div className="rounded-2xl border p-4" style={surfaceCardStyle}>
            <ShieldAlert className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-black" style={primaryTextStyle}>Escalation boundary</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed" style={mutedTextStyle}>
              Payment, agreement, billing, identity, and cancellation mismatches require escalation.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <label className="flex-1 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest" style={subtleTextStyle}>Search playbook</span>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 focus-within:ring-2 focus-within:ring-[#A380F6]" style={fieldStyle}>
                <Search className="h-4 w-4" style={subtleTextStyle} aria-hidden="true" />
                <input
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Search scenarios, actions, or support wording"
                  className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchValue("")}
                    className="rounded-full p-1 transition hover:bg-black/5 dark:hover:bg-white/10"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold" style={mutedTextStyle}>
                {searchTerm ? `${matchingSections.length} matching sections` : `${sections.length} sections`}
              </span>
              <button type="button" onClick={expandAll} className="rounded-full border px-3 py-2 text-xs font-black transition hover:border-[#A380F6]" style={fieldStyle}>
                Expand all
              </button>
              <button type="button" onClick={collapseAll} className="rounded-full border px-3 py-2 text-xs font-black transition hover:border-[#A380F6]" style={fieldStyle}>
                Collapse all
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border p-4" style={surfaceCardStyle}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-sm font-black" style={primaryTextStyle}>Quick scenarios</h2>
            <p className="text-xs font-semibold" style={subtleTextStyle}>Jump to common support paths</p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {quickScenarios.map(({ label, match }) => {
              const target = scenarioSections.find((section) => section.title.toLowerCase().includes(match));
              if (!target) return null;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => jumpToSection(target.id)}
                  className="rounded-xl border px-3 py-3 text-left text-sm font-black transition hover:border-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]"
                  style={fieldStyle}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <nav className="rounded-2xl border p-4" style={surfaceCardStyle} aria-label="Playbook sections">
              <p className="mb-3 text-xs font-black uppercase tracking-widest" style={subtleTextStyle}>Contents</p>
              <div className="max-h-[70vh] space-y-1 overflow-auto pr-1">
                {sections.map((section) => {
                  const visible = sectionMatches(section, searchTerm);
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => jumpToSection(section.id)}
                      className={`block w-full rounded-lg px-3 py-2 text-left text-xs font-black transition focus:outline-none focus:ring-2 focus:ring-[#A380F6] ${
                        visible ? "hover:bg-[#A380F6]/10" : "opacity-40"
                      }`}
                      style={visible ? primaryTextStyle : subtleTextStyle}
                    >
                      {section.shortTitle}
                    </button>
                  );
                })}
              </div>
            </nav>
          </aside>

          <main className="space-y-4">
            {matchingSections.length === 0 ? (
              <section className="rounded-2xl border p-6 text-sm font-semibold" style={surfaceCardStyle}>
                No playbook sections match this search.
              </section>
            ) : (
              matchingSections.map((section) => (
                <PlaybookSectionCard
                  key={section.id}
                  section={section}
                  expanded={searchTerm ? true : expandedIds.has(section.id)}
                  copiedKey={copiedKey}
                  onToggle={() => setSectionExpanded(section.id, searchTerm ? false : !expandedIds.has(section.id))}
                  onCopy={copyText}
                />
              ))
            )}
          </main>
        </div>
      </div>
    </AdminLayout>
  );
}
