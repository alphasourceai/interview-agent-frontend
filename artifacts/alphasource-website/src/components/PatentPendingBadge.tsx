type PatentPendingBadgeProps = {
  className?: string;
};

export default function PatentPendingBadge({ className = "" }: PatentPendingBadgeProps) {
  return (
    <span
      className={`inline-flex min-h-7 items-center whitespace-nowrap rounded-full border border-[#A380F6]/30 bg-[#A380F6]/10 px-3 py-1 text-xs font-black tracking-[0.04em] text-[#7657C8] dark:border-[#A380F6]/45 dark:bg-[#A380F6]/15 dark:text-[#C9B8FF] ${className}`}
    >
      Patent Pending
    </span>
  );
}
