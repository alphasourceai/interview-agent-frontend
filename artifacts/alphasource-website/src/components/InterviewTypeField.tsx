import type { ChangeEvent, CSSProperties } from "react";
import {
  getInterviewTypeOption,
  INTERVIEW_TYPE_OPTIONS,
  type InterviewType,
} from "@/lib/interviewContract";

const visuallyHidden: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
};

export default function InterviewTypeField({
  id = "interview-type",
  value,
  onChange,
  className = "",
  selectStyle,
  label = "Interview type",
  showLabel = true,
  showDescription = true,
  disabled = false,
}: {
  id?: string;
  value: InterviewType;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  selectStyle?: CSSProperties;
  label?: string;
  showLabel?: boolean;
  showDescription?: boolean;
  disabled?: boolean;
}) {
  const selected = getInterviewTypeOption(value) || INTERVIEW_TYPE_OPTIONS[0];
  const descriptionId = `${id}-description`;

  return (
    <div className="grid min-w-0 gap-1.5">
      <label
        htmlFor={id}
        className={showLabel ? "text-[10px] font-black uppercase tracking-widest" : undefined}
        style={showLabel ? { color: "var(--as-text-muted)" } : visuallyHidden}
      >
        {label}
      </label>
      <select
        id={id}
        className={className}
        value={selected.value}
        onChange={onChange}
        aria-describedby={descriptionId}
        title={selected.tooltip}
        style={selectStyle}
        disabled={disabled}
      >
        {INTERVIEW_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} title={option.tooltip}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        id={descriptionId}
        className={showDescription ? "text-xs leading-relaxed" : undefined}
        style={showDescription ? { color: "var(--as-text-muted)" } : visuallyHidden}
      >
        {selected.tooltip}{selected.supporting ? ` ${selected.supporting}` : ""}
      </span>
    </div>
  );
}
