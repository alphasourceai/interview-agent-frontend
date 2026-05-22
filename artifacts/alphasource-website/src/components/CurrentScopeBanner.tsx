import type { Client } from "@/context/ClientContext";

function displayEntityLabel(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function scopeMetadata(client: Client): string {
  const parts: string[] = [];
  const isChild = client.is_child_client === true || Boolean(client.parent_client_id);

  if (isChild) {
    const label = displayEntityLabel(client.entity_label);
    parts.push(label ? `${label} · Child entity` : "Child entity");
  } else {
    parts.push("Parent client");
  }

  if (client.inherited === true) parts.push("Inherited access");
  return parts.join(" · ");
}

export default function CurrentScopeBanner({ client }: { client?: Client | null }) {
  if (!client) return null;

  return (
    <div
      className="bg-white rounded-2xl px-5 py-3.5 mb-5 flex flex-wrap items-center justify-between gap-3"
      style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/35 mb-1">
          Current scope
        </p>
        <h2 className="text-lg font-black text-[#0A1547] leading-tight truncate">
          {client.name}
        </h2>
      </div>
      <p className="text-xs font-semibold text-[#0A1547]/45">
        {scopeMetadata(client)}
      </p>
    </div>
  );
}
