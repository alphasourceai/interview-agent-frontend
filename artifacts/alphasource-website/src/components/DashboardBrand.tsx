import { useEffect, useState } from "react";
import { alphaSourceLogo, alphaSourceLogoDark, alphaSourceSymbol } from "@/assets/branding";

type DashboardBrandMode = "dark" | "light";
type DashboardBrandVariant = "compact" | "full";
type LogoStage = "full" | "symbol" | "text";

type DashboardBrandProps = {
  mode: DashboardBrandMode;
  variant: DashboardBrandVariant;
};

const COMPACT_LOGO_SRC = alphaSourceSymbol;

function initialStage(variant: DashboardBrandVariant): LogoStage {
  return variant === "compact" ? "symbol" : "full";
}

export default function DashboardBrand({ mode, variant }: DashboardBrandProps) {
  const fullLogoSrc = mode === "dark" ? alphaSourceLogoDark : alphaSourceLogo;
  const [stage, setStage] = useState<LogoStage>(() => initialStage(variant));

  useEffect(() => {
    setStage(initialStage(variant));
  }, [fullLogoSrc, variant]);

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = "none";
    setStage("text");
  };

  if (stage === "text") {
    if (variant === "compact") {
      return (
        <span
          aria-label="alphaSource AI"
          role="img"
          data-dashboard-brand-stage="text"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-[#A380F6]/20 text-lg font-black text-[#5D43CC]"
          title="alphaSource AI"
        >
          α
        </span>
      );
    }

    return (
      <span
        aria-label="alphaSource AI"
        role="img"
        data-dashboard-brand-stage="text"
        className="inline-flex h-8 w-[135px] items-center text-sm font-black text-[var(--as-text)]"
      >
        alphaSource <span className="ml-1 text-[#A380F6]">AI</span>
      </span>
    );
  }

  const isFullLogo = stage === "full";
  const src = isFullLogo ? fullLogoSrc : COMPACT_LOGO_SRC;
  const width = isFullLogo ? 135 : 32;
  const height = 32;

  return (
    <img
      key={src}
      src={src}
      alt="alphaSource AI"
      width={width}
      height={height}
      data-dashboard-brand-stage={stage}
      onError={handleImageError}
      className={
        isFullLogo
          ? "h-8 w-[135px] object-contain object-left"
          : "h-8 w-8 object-contain"
      }
    />
  );
}
