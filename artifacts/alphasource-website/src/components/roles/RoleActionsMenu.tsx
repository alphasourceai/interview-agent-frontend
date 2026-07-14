import { ChevronDown, Copy, FileText, ListChecks, RefreshCw, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  replacementBlockerDescription,
  type RoleJdReplacementEligibility,
} from "@/lib/roleJdReplacementEligibility";

function ActionItemDetails({ label, description }: { label: string; description: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold leading-4">{label}</span>
      <span className="mt-0.5 block text-[11px] font-medium leading-4" style={{ color: "var(--as-text-subtle)" }}>
        {description}
      </span>
    </span>
  );
}

export default function RoleActionsMenu({
  open,
  onOpenChange,
  roleTitle,
  canManageRole,
  canCopyInterviewLink,
  copyDisabledReason,
  hasJobDescription,
  hasRubric,
  openingJobDescription,
  loadingRubric,
  replacementEligibility,
  updatingStatus,
  deleting,
  isInactive,
  onTriggerFocus,
  onCopyInterviewLink,
  onViewJobDescription,
  onViewRubric,
  onEditRubricQuestions,
  onReplaceJobDescription,
  onToggleRoleStatus,
  onDeleteRole,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roleTitle: string;
  canManageRole: boolean;
  canCopyInterviewLink: boolean;
  copyDisabledReason?: string;
  hasJobDescription: boolean;
  hasRubric: boolean;
  openingJobDescription: boolean;
  loadingRubric: boolean;
  replacementEligibility: RoleJdReplacementEligibility;
  updatingStatus: boolean;
  deleting: boolean;
  isInactive: boolean;
  onTriggerFocus?: (trigger: HTMLButtonElement) => void;
  onCopyInterviewLink: () => void;
  onViewJobDescription: () => void;
  onViewRubric: () => void;
  onEditRubricQuestions?: () => void;
  onReplaceJobDescription: () => void;
  onToggleRoleStatus: () => void;
  onDeleteRole: () => void;
}) {
  const replacementUnavailable = !replacementEligibility.eligible;
  const replacementReason = replacementBlockerDescription(replacementEligibility);
  const copyDescription = canCopyInterviewLink
    ? "Copy the candidate interview link."
    : copyDisabledReason || "Copy the candidate interview link.";
  const jobDescriptionLabel = openingJobDescription ? "Opening job description..." : "View job description";
  const jobDescriptionDescription = openingJobDescription
    ? "Opening the current job description."
    : hasJobDescription
      ? "Open the current job description."
      : "No job description is available for this role.";
  const rubricLabel = loadingRubric ? "Loading rubric..." : "View rubric";
  const rubricDescription = loadingRubric
    ? "Loading the current interview questions."
    : hasRubric
      ? "Review the current interview questions."
      : "No interview questions are available for this role.";
  const replacementDescription = replacementUnavailable
    ? replacementReason
    : "Upload a new JD and rebuild the role configuration.";
  const statusLabel = isInactive ? "Reopen role" : "Close role";
  const statusDescription = isInactive
    ? "Make this role available again."
    : "Stop new candidates from using this role.";

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(event) => onTriggerFocus?.(event.currentTarget)}
          className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-xs font-bold transition-colors hover:border-[#A380F6]/60 hover:text-[#7C5FCC] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/35"
          style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text-muted)" }}
          aria-label={`Actions for ${roleTitle}`}
        >
          Actions
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        collisionPadding={12}
        className="z-[95] w-72 rounded-md border p-1.5"
        style={{ backgroundColor: "var(--as-surface)", borderColor: "var(--as-border)", color: "var(--as-text)" }}
      >
        <DropdownMenuItem
          disabled={!canCopyInterviewLink}
          onSelect={onCopyInterviewLink}
          className="items-start gap-2.5 rounded-md px-2.5 py-2 focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
        >
          <Copy className="mt-0.5 h-4 w-4 text-[#A380F6]" aria-hidden="true" />
          <ActionItemDetails label="Copy interview link" description={copyDescription} />
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasJobDescription || openingJobDescription}
          onSelect={onViewJobDescription}
          className="items-start gap-2.5 rounded-md px-2.5 py-2 focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
        >
          <FileText className="mt-0.5 h-4 w-4 text-[#A380F6]" aria-hidden="true" />
          <ActionItemDetails label={jobDescriptionLabel} description={jobDescriptionDescription} />
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasRubric || loadingRubric}
          onSelect={onViewRubric}
          className="items-start gap-2.5 rounded-md px-2.5 py-2 focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
        >
          <FileText className="mt-0.5 h-4 w-4 text-[#A380F6]" aria-hidden="true" />
          <ActionItemDetails label={rubricLabel} description={rubricDescription} />
        </DropdownMenuItem>

        {canManageRole && (
          <>
            <DropdownMenuSeparator style={{ backgroundColor: "var(--as-border)" }} />
            {onEditRubricQuestions && (
              <DropdownMenuItem
                onSelect={onEditRubricQuestions}
                className="items-start gap-2.5 rounded-md px-2.5 py-2 focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
              >
                <ListChecks className="mt-0.5 h-4 w-4 text-[#A380F6]" aria-hidden="true" />
                <ActionItemDetails
                  label="Edit rubric questions"
                  description="Edit the Tavus prompt and interview questions."
                />
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={replacementUnavailable}
              onSelect={() => {
                if (replacementEligibility.eligible) onReplaceJobDescription();
              }}
              className="items-start gap-2.5 rounded-md px-2.5 py-2 focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
            >
              <RefreshCw className="mt-0.5 h-4 w-4 text-[#A380F6]" aria-hidden="true" />
              <ActionItemDetails label="Replace job description" description={replacementDescription} />
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ backgroundColor: "var(--as-border)" }} />
            <DropdownMenuItem
              disabled={updatingStatus}
              onSelect={onToggleRoleStatus}
              className="items-start gap-2.5 rounded-md px-2.5 py-2 focus:bg-[#A380F6]/10 focus:text-[#7C5FCC]"
            >
              <RefreshCw className="mt-0.5 h-4 w-4 text-[#A380F6]" aria-hidden="true" />
              <ActionItemDetails label={statusLabel} description={statusDescription} />
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ backgroundColor: "var(--as-border)" }} />
            <DropdownMenuItem
              disabled={deleting}
              onSelect={onDeleteRole}
              className="items-start gap-2.5 rounded-md px-2.5 py-2 text-red-600 focus:bg-red-50 focus:text-red-700"
            >
              <Trash2 className="mt-0.5 h-4 w-4" aria-hidden="true" />
              <ActionItemDetails label="Delete role" description="Permanently remove this role where allowed." />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
