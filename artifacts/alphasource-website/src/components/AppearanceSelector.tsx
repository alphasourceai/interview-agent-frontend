import { ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useAppearance, type AppearanceMode } from "@/context/AppearanceContext";

const OPTIONS: Array<{ value: AppearanceMode; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function AppearanceSelector() {
  const { mode, resolvedMode, setMode } = useAppearance();
  const Icon = mode === "system" ? Monitor : resolvedMode === "dark" ? Moon : Sun;

  return (
    <label
      className="relative inline-flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-bold transition-colors"
      style={{
        backgroundColor: "var(--as-surface-muted)",
        borderColor: "var(--as-border)",
        color: "var(--as-text)",
      }}
    >
      <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--as-accent)" }} />
      <span className="hidden sm:inline">Appearance</span>
      <select
        aria-label="Appearance"
        value={mode}
        onChange={(event) => setMode(event.target.value as AppearanceMode)}
        className="appearance-none bg-transparent pr-4 text-xs font-bold outline-none cursor-pointer"
        style={{ color: "var(--as-text)" }}
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-3 w-3" style={{ color: "var(--as-text-muted)" }} />
    </label>
  );
}
