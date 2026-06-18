import { Info } from "lucide-react";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";

interface InfoTooltipProps {
  content: string;
  side?: "top" | "bottom";
  iconClassName?: string;
}

export default function InfoTooltip({
  content,
  side = "bottom",
  iconClassName = "w-3 h-3 text-[#0A1547]/25",
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = () => {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setCoords({
        top:  side === "bottom" ? r.bottom + 8 : r.top - 8,
        left: r.left + r.width / 2,
      });
    }
    setVisible(true);
  };

  const hide = () => setVisible(false);

  const translateY = side === "top" ? "-100%" : "0%";
  const portalTarget = typeof document !== "undefined" ? document.body : null;

  return (
    <span
      ref={triggerRef}
      className="inline-flex items-center cursor-default"
      tabIndex={0}
      aria-label={content}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <Info className={iconClassName} />

      {visible && portalTarget &&
        createPortal(
          <span
            role="tooltip"
            className="fixed z-[9999] w-max max-w-[260px] rounded-xl px-3 py-2.5
                       bg-[#0A1547] text-white text-[11px] font-medium leading-snug
                       shadow-xl whitespace-normal pointer-events-none"
            style={{
              top:       coords.top,
              left:      coords.left,
              transform: `translateX(-50%) translateY(${translateY})`,
            }}
          >
            {content}
            {/* Arrow */}
            <span
              className={[
                "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
                side === "top"
                  ? "top-full border-t-[#0A1547]"
                  : "bottom-full border-b-[#0A1547]",
              ].join(" ")}
            />
          </span>,
          portalTarget
        )}
    </span>
  );
}
