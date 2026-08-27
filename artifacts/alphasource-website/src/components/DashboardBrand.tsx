import { AlphaScreenLockup } from "@/components/AlphaScreenBrand";

type DashboardBrandMode = "dark" | "light";
type DashboardBrandVariant = "compact" | "full";
type DashboardBrandProps = {
  mode: DashboardBrandMode;
  variant: DashboardBrandVariant;
};

export default function DashboardBrand({ mode, variant }: DashboardBrandProps) {
  const isCompact = variant === "compact";

  return (
    <AlphaScreenLockup
      compact={isCompact}
      treatment="teal"
      wordmarkTone={mode === "dark" ? "white" : "navy"}
      className={isCompact ? "h-9 w-9" : undefined}
      markClassName={isCompact ? "h-9 w-9" : "h-10 w-10"}
      wordmarkClassName="text-lg"
    />
  );
}
