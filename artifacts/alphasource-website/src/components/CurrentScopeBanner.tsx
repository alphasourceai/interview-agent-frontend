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
      className="bg-white rounded-2xl px-4 py-3 mb-5 flex items-center gap-3"
      style={{ border: "1px solid rgba(10,21,71,0.07)", boxShadow: "0 2px 12px rgba(10,21,71,0.05)" }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-[#A380F6] bg-[#A380F6]/10 flex-shrink-0"
        aria-hidden="true"
      >
        {initial}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-[#0A1547]/35 mb-1">
          Current client/entity
        </p>
        <p className="text-sm font-black text-[#0A1547] leading-tight truncate">
          {client.name}
        </p>
        <p className="text-xs font-semibold text-[#0A1547]/45 mt-0.5 truncate">
          {scopeMetadata(client)}
        </p>
      </div>
    </div>
  );
}
