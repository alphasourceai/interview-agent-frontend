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
      treatment="duotone"
      wordmarkTone={mode === "dark" ? "white" : "navy"}
      className={isCompact ? "h-8 w-8" : undefined}
      markClassName="h-8 w-8"
      wordmarkClassName="text-[17px]"
    />
  );
}
