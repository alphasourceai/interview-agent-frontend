import type { ReactNode } from "react";
import { AlphaScreenLockup } from "@/components/AlphaScreenBrand";
import { cn } from "@/lib/utils";

type CandidateHeaderProps = {
  children?: ReactNode;
  className?: string;
};

export default function CandidateHeader({ children, className }: CandidateHeaderProps) {
  return (
    <header
      className={cn(
        "flex h-14 flex-shrink-0 items-center border-b border-[#0A1547]/[0.07] bg-white px-6",
        className,
      )}
    >
      <AlphaScreenLockup
        treatment="teal"
        wordmarkWeight="extralight"
        markClassName="h-8 w-8"
        wordmarkClassName="text-2xl"
      />
      {children}
    </header>
  );
}
