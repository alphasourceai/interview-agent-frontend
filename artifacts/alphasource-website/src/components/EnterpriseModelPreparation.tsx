import { useState } from "react";

export default function EnterpriseModelPreparation() {
  const [model, setModel] = useState("");
  return (
    <section
      className="rounded-xl p-4 border mb-3"
      style={{
        backgroundColor: "var(--as-surface-muted)",
        borderColor: "var(--as-border)",
        color: "var(--as-text)",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <h3 className="text-sm font-black mb-2">Enterprise billing model</h3>
      <label className="block text-xs font-bold">
        Model preview
        <select
          className="block w-full rounded-lg border p-2 mt-1 mb-3"
          style={{
            backgroundColor: "var(--as-surface)",
            borderColor: "var(--as-border)",
          }}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        >
          <option value="">Choose a model to preview</option>
          <option value="standard">
            Standard — platform fee + per-role cost
          </option>
          <option value="usage">
            Usage-based — platform fee + per-interview cost
          </option>
        </select>
      </label>
      {model && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            "Platform fee ($)",
            model === "standard"
              ? "Per-role cost ($)"
              : "Per-interview cost ($)",
          ].map((label) => (
            <label key={`${model}:${label}`} className="text-xs font-bold">
              {label}
              <input
                type="number"
                min="0"
                step="0.01"
                className="block w-full rounded-lg border p-2 mt-1"
                style={{
                  backgroundColor: "var(--as-surface)",
                  borderColor: "var(--as-border)",
                }}
                placeholder="Not configured"
              />
            </label>
          ))}
        </div>
      )}
      <p className="text-xs mt-3" role="status">
        Preview only — the new Enterprise backend is not ready. These values are
        not saved and do not change an existing agreement or enable checkout.
        Fully customizable, with a dedicated Client Support Agent.
      </p>
    </section>
  );
}
