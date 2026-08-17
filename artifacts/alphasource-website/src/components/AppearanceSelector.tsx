import { ChevronDown, Monitor, Moon, Sun } from "lucide-react";
import { useAppearance, type AppearanceMode } from "@/context/AppearanceContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const OPTIONS = [
  { value: "light" as const, label: "Light", detail: "Always use the light theme", icon: Sun },
  { value: "dark" as const, label: "Dark", detail: "Always use the dark theme", icon: Moon },
  { value: "system" as const, label: "System", detail: "Match this device", icon: Monitor },
];

export default function AppearanceSelector({ alwaysShowLabel = false }: { alwaysShowLabel?: boolean }) {
  const { mode, resolvedMode, setMode } = useAppearance();
  const Icon = mode === "system" ? Monitor : resolvedMode === "dark" ? Moon : Sun;
  const selectedOption = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[2];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Appearance: ${selectedOption.label}`}
          className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border px-3 text-xs font-black shadow-sm transition-all hover:border-[#A380F6]/45 hover:bg-[var(--as-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A380F6]/40 ${alwaysShowLabel ? "w-full" : ""}`}
          style={{
            backgroundColor: "var(--as-surface)",
            borderColor: "var(--as-border)",
            color: "var(--as-text)",
          }}
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#A380F6]/12 text-[#8B68E8]">
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          </span>
          <span className={alwaysShowLabel ? "inline" : "hidden xl:inline"}>Appearance</span>
          <span
            className={alwaysShowLabel ? "ml-auto inline" : "hidden sm:inline"}
            style={{ color: "var(--as-text-muted)" }}
          >
            {selectedOption.label}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-3.5 w-3.5"
            style={{ color: "var(--as-text-muted)" }}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className={`w-56 rounded-xl border p-1.5 shadow-xl ${resolvedMode === "dark" ? "dark" : ""}`}
        data-theme={resolvedMode}
        style={{
          backgroundColor: "var(--as-surface)",
          borderColor: "var(--as-border)",
          color: "var(--as-text)",
        }}
      >
        <DropdownMenuLabel
          className="px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.14em]"
          style={{ color: "var(--as-text-muted)" }}
        >
          Appearance
        </DropdownMenuLabel>
        <DropdownMenuSeparator
          style={{ backgroundColor: "var(--as-border)" }}
        />
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(value) => setMode(value as AppearanceMode)}
        >
          {OPTIONS.map((option) => {
            const OptionIcon = option.icon;
            return (
              <DropdownMenuRadioItem
                key={option.value}
                value={option.value}
                className="cursor-pointer rounded-lg py-2.5 pl-9 pr-2.5 focus:bg-[var(--as-hover)]"
              >
                <OptionIcon aria-hidden="true" className="h-4 w-4 text-[#8B68E8]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-black">{option.label}</span>
                  <span className="block text-[10px] font-semibold" style={{ color: "var(--as-text-muted)" }}>{option.detail}</span>
                </span>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
