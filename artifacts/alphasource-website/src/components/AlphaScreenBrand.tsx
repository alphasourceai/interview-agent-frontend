import type { CSSProperties, ImgHTMLAttributes } from "react";
import {
  alphaScreenMark08Duotone,
  alphaScreenMark08Gradient,
  alphaScreenMark08Navy,
  alphaScreenMark08Teal,
  alphaScreenMark08White,
  alphaScreenMark09Duotone,
  alphaScreenMark09Gradient,
  alphaScreenMark09Navy,
  alphaScreenMark09Teal,
  alphaScreenMark09White,
} from "@/assets/branding";
import { cn } from "@/lib/utils";

export type AlphaScreenMarkTreatment = "duotone" | "gradient" | "navy" | "teal" | "white";
export type AlphaScreenMarkGeometry = "08" | "09";

const MARK_SOURCES: Record<
  AlphaScreenMarkGeometry,
  Record<AlphaScreenMarkTreatment, string>
> = {
  "08": {
    duotone: alphaScreenMark08Duotone,
    gradient: alphaScreenMark08Gradient,
    navy: alphaScreenMark08Navy,
    teal: alphaScreenMark08Teal,
    white: alphaScreenMark08White,
  },
  "09": {
    duotone: alphaScreenMark09Duotone,
    gradient: alphaScreenMark09Gradient,
    navy: alphaScreenMark09Navy,
    teal: alphaScreenMark09Teal,
    white: alphaScreenMark09White,
  },
};

type AlphaScreenMarkProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  geometry?: AlphaScreenMarkGeometry;
  treatment?: AlphaScreenMarkTreatment;
};

export function AlphaScreenMark({
  geometry = "08",
  treatment = "duotone",
  className,
  alt = "alphaScreen",
  ...props
}: AlphaScreenMarkProps) {
  return (
    <img
      src={MARK_SOURCES[geometry][treatment]}
      alt={alt}
      className={cn("block shrink-0 object-contain", className)}
      {...props}
    />
  );
}

type AlphaScreenLockupProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  treatment?: AlphaScreenMarkTreatment;
  wordmarkTone?: "navy" | "white";
  wordmarkWeight?: "extralight" | "medium";
  compact?: boolean;
};

export function AlphaScreenLockup({
  className,
  markClassName,
  wordmarkClassName,
  treatment = "duotone",
  wordmarkTone = "navy",
  wordmarkWeight = "medium",
  compact = false,
}: AlphaScreenLockupProps) {
  if (compact) {
    return (
      <AlphaScreenMark
        geometry="08"
        treatment={treatment}
        className={cn("h-8 w-8", markClassName, className)}
      />
    );
  }

  return (
    <span
      className={cn("inline-flex items-center gap-2.5", className)}
    >
      <AlphaScreenMark
        geometry="08"
        treatment={treatment}
        alt=""
        aria-hidden="true"
        className={cn("h-9 w-9", markClassName)}
      />
      <span
        data-alphascreen-wordmark="true"
        className={cn(
          "whitespace-nowrap font-sans text-xl leading-none tracking-[-0.03em]",
          wordmarkWeight === "extralight" ? "font-[200] tracking-[0.01em]" : "font-medium",
          wordmarkTone === "white" ? "text-white" : "text-[#0A1547]",
          wordmarkClassName,
        )}
      >
        alphaScreen
      </span>
    </span>
  );
}

type AlphaScreenBreathingMarkProps = {
  className?: string;
  imageClassName?: string;
  treatment?: AlphaScreenMarkTreatment;
  label?: string;
  decorative?: boolean;
};

export function AlphaScreenBreathingMark({
  className,
  imageClassName,
  treatment = "duotone",
  label = "alphaScreen is processing",
  decorative = false,
}: AlphaScreenBreathingMarkProps) {
  const animationStyle = {
    "--alphascreen-breath-duration": "2400ms",
  } as CSSProperties;

  return (
    <span
      role={decorative ? undefined : "status"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative ? "true" : undefined}
      className={cn("alphascreen-breathing-mark relative inline-grid", className)}
      style={animationStyle}
    >
      <AlphaScreenMark
        geometry="08"
        treatment={treatment}
        alt=""
        aria-hidden="true"
        className={cn(
          "alphascreen-breathing-mark__rest col-start-1 row-start-1 h-full w-full",
          imageClassName,
        )}
      />
      <AlphaScreenMark
        geometry="09"
        treatment={treatment}
        alt=""
        aria-hidden="true"
        className={cn(
          "alphascreen-breathing-mark__active col-start-1 row-start-1 h-full w-full",
          imageClassName,
        )}
      />
    </span>
  );
}

type AlphaScreenBreathingLockupProps = {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  treatment?: AlphaScreenMarkTreatment;
  wordmarkTone?: "navy" | "white";
};

export function AlphaScreenBreathingLockup({
  className,
  markClassName,
  wordmarkClassName,
  treatment = "teal",
  wordmarkTone = "navy",
}: AlphaScreenBreathingLockupProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-3", className)}
    >
      <AlphaScreenBreathingMark
        decorative
        treatment={treatment}
        className={cn("h-12 w-12 shrink-0", markClassName)}
      />
      <span
        data-alphascreen-wordmark="true"
        className={cn(
          "whitespace-nowrap font-sans text-4xl font-[200] leading-none tracking-[0.01em]",
          wordmarkTone === "white" ? "text-white" : "text-[#0A1547]",
          wordmarkClassName,
        )}
      >
        alphaScreen
      </span>
    </span>
  );
}

type AlphaScreenStatusMarkProps = {
  className?: string;
  state: "ready" | "listening" | "processing" | "complete";
  treatment?: AlphaScreenMarkTreatment;
};

const STATUS_LABELS = {
  ready: "Ready",
  listening: "Listening",
  processing: "Processing",
  complete: "Complete",
} as const;

export function AlphaScreenStatusMark({
  className,
  state,
  treatment = "duotone",
}: AlphaScreenStatusMarkProps) {
  const isActive = state === "listening" || state === "processing";

  return (
    <span
      className={cn("alphascreen-status-mark inline-flex items-center gap-2", className)}
      data-state={state}
    >
      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center">
        <span className="alphascreen-status-mark__ring absolute inset-0 rounded-[0.7rem]" />
        {isActive ? (
          <AlphaScreenBreathingMark
            treatment={treatment}
            label={`alphaScreen is ${state}`}
            className="h-8 w-8"
          />
        ) : (
          <AlphaScreenMark
            geometry="08"
            treatment={treatment}
            alt=""
            aria-hidden="true"
            className="h-8 w-8"
          />
        )}
      </span>
      <span className="text-xs font-bold text-current">{STATUS_LABELS[state]}</span>
    </span>
  );
}
