import type { Client } from "@/context/ClientContext";

function scopeMetadata(client: Client): string {
  const parts: string[] = [];
  const isChild = client.is_child_client === true || Boolean(client.parent_client_id);

  if (isChild) {
    const parentName = String(client.parent_client_name || "").trim();
    parts.push(parentName ? `Child entity of ${parentName}` : "Child entity");
  } else {
    parts.push("Parent client");
  }

  if (client.inherited === true) parts.push("Inherited access");
  return parts.join(" · ");
}

export default function CurrentScopeBanner({ client }: { client?: Client | null }) {
  if (!client) return null;
  const initial = String(client.name || "C").trim().charAt(0).toUpperCase() || "C";

  return (
    <div
      className="rounded-2xl px-4 py-3 mb-5 flex items-center gap-3"
      style={{
        backgroundColor: "var(--as-surface)",
        border: "1px solid var(--as-border)",
        boxShadow: "var(--as-shadow)",
      }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
        style={{ backgroundColor: "var(--as-accent-soft)", color: "var(--as-accent)" }}
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "var(--as-text-subtle)" }}>
          Current client/entity
        </p>
        <p className="text-sm font-black leading-tight truncate" style={{ color: "var(--as-text)" }}>
          {client.name}
        </p>
        <p className="text-xs font-semibold mt-0.5 truncate" style={{ color: "var(--as-text-muted)" }}>
          {scopeMetadata(client)}
        </p>
      </div>
    </div>
  );
}
