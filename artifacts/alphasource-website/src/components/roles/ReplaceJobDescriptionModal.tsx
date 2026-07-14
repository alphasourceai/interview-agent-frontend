import { useEffect, useMemo, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CheckCircle2, FileUp, LoaderCircle, X } from "lucide-react";
import {
  RoleJdReplacementRequestError,
  replaceRoleJobDescription,
  type RebuiltRole,
} from "@/lib/roleJdReplacement";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

export interface ReplaceJobDescriptionRole {
  id: string;
  clientId: string;
  title: string;
  status?: string | null;
  jobDescriptionUrl?: string | null;
}

interface ReplacementErrorState {
  title: string;
  message: string;
  blockers: string[];
}

function normalizeFilename(url: string | null | undefined): string {
  const value = String(url || "").trim();
  if (!value) return "Current job description";
  const filename = value.split("?")[0].split("/").filter(Boolean).pop() || "Current job description";
  try {
    return decodeURIComponent(filename);
  } catch {
    return filename;
  }
}

function roleStatusLabel(status: string | null | undefined): string {
  const normalized = String(status || "active").trim().toLowerCase();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "Active";
}

function validateFile(file: File): string {
  const filename = String(file.name || "").trim();
  const extension = filename.includes(".") ? filename.slice(filename.lastIndexOf(".")).toLowerCase() : "";
  if (extension !== ".pdf" && extension !== ".docx") {
    return "Upload a PDF or DOCX file no larger than 20 MB.";
  }
  if (file.size > MAX_FILE_BYTES) {
    return "Upload a PDF or DOCX file no larger than 20 MB.";
  }
  return "";
}

function displayBlockers(detail: string | null): string[] {
  const labels: Record<string, string> = {
    candidates: "Candidates",
    interviews: "Interviews",
    reports: "Reports",
    otp_tokens: "Interview access records",
    accommodation_requests: "Accommodation activity",
    automation_rules: "Automation activity",
    automation_evaluations: "Automation activity",
    automation_actions: "Automation activity",
    automation_digest_deliveries: "Automation activity",
    digest_logs: "Automation activity",
  };
  const seen = new Set<string>();
  return String(detail || "")
    .split(",")
    .map((value) => labels[String(value || "").trim()] || "")
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function errorStateFor(error: unknown): ReplacementErrorState {
  const requestError = error instanceof RoleJdReplacementRequestError ? error : null;
  const code = String(requestError?.code || "").trim();
  const status = Number(requestError?.status || 0);

  if (status === 409 && code === "ROLE_ACTIVITY_EXISTS") {
    return {
      title: "Job description cannot be replaced",
      message: "This role already has candidate or interview activity. To protect interview consistency, its job description and rubric can no longer be replaced.",
      blockers: displayBlockers(requestError?.detail || null),
    };
  }
  if (status === 409 && code === "ROLE_NOT_ACTIVE") {
    return {
      title: "Role is inactive",
      message: "Only active roles can have their job description replaced. The existing role was not changed.",
      blockers: [],
    };
  }
  if (status === 401 || status === 403 || code === "ROLE_REPLACEMENT_FORBIDDEN") {
    return {
      title: "Permission required",
      message: "You do not have permission to replace this role's job description.",
      blockers: [],
    };
  }
  if (["UNSUPPORTED_JD_FILE", "JD_FILE_TOO_LARGE", "JD_FILE_REQUIRED", "INVALID_JD_UPLOAD"].includes(code)) {
    return {
      title: "Choose a supported file",
      message: "Upload a PDF or DOCX file no larger than 20 MB.",
      blockers: [],
    };
  }
  if (code === "RUBRIC_QUESTION_QUALITY_FAILED") {
    return {
      title: "Interview rubric incomplete",
      message: "The new job description could not produce a complete interview rubric. The existing role was not changed. Review the document and try again.",
      blockers: [],
    };
  }
  if (["JD_PARSE_FAILED", "JD_TEXT_EMPTY", "JD_ARTIFACT_GENERATION_FAILED", "JD_ARTIFACTS_INCOMPLETE", "TAVUS_DOCUMENT_CREATION_FAILED", "TAVUS_DOCUMENT_UNAVAILABLE", "ROLE_JD_COMPLETION_FAILED"].includes(code)) {
    return {
      title: "Role configuration was not rebuilt",
      message: "The role could not be rebuilt. The existing job description and interview configuration were left unchanged.",
      blockers: [],
    };
  }
  return {
    title: "Replacement did not complete",
    message: "Something went wrong while replacing the job description. No changes were applied to the active role.",
    blockers: [],
  };
}

export default function ReplaceJobDescriptionModal({
  open,
  role,
  getSessionToken,
  onClose,
  onSuccess,
  getRestoreFocusTarget,
}: {
  open: boolean;
  role: ReplaceJobDescriptionRole | null;
  getSessionToken: () => Promise<string>;
  onClose: () => void;
  onSuccess: (role: RebuiltRole) => void | Promise<void>;
  getRestoreFocusTarget?: () => HTMLElement | null;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [phase, setPhase] = useState<"form" | "submitting" | "success">("form");
  const [error, setError] = useState<ReplacementErrorState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(open);
  const fileError = useMemo(() => (file ? validateFile(file) : ""), [file]);
  const isSubmitting = phase === "submitting";
  const canSubmit = Boolean(role?.id && role.clientId && file && !fileError && confirmed && !isSubmitting);

  useEffect(() => {
    if (!open || !role?.id) return;
    setFile(null);
    setReason("");
    setConfirmed(false);
    setPhase("form");
    setError(null);
  }, [open, role?.id]);

  useEffect(() => {
    let timer: number | null = null;
    if (wasOpenRef.current && !open) {
      timer = window.setTimeout(() => getRestoreFocusTarget?.()?.focus(), 0);
      wasOpenRef.current = false;
    } else {
      wasOpenRef.current = open;
    }
    return () => {
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [open, getRestoreFocusTarget]);

  const requestClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const chooseFile = (nextFile: File | null) => {
    setFile(nextFile);
    setError(null);
  };

  const submit = async () => {
    if (!role || !file || !canSubmit) return;
    setError(null);
    setPhase("submitting");
    try {
      const accessToken = await getSessionToken();
      const result = await replaceRoleJobDescription({
        roleId: role.id,
        clientId: role.clientId,
        file,
        reason,
        accessToken,
      });
      await onSuccess(result.role);
      setPhase("success");
    } catch (requestError) {
      setError(errorStateFor(requestError));
      setPhase("form");
    }
  };

  const currentJd = normalizeFilename(role?.jobDescriptionUrl);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) requestClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-[#0A1547]/45 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-[91] flex w-[calc(100%-2rem)] max-w-xl max-h-[calc(100vh-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-[var(--as-surface)] shadow-[0_24px_70px_rgba(10,21,71,0.28)] focus:outline-none"
          style={{ borderColor: "var(--as-border)" }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            fileInputRef.current?.focus();
          }}
          onEscapeKeyDown={(event) => {
            if (isSubmitting) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (isSubmitting) event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (isSubmitting) event.preventDefault();
          }}
        >
          <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--as-border)" }}>
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-base font-black" style={{ color: "var(--as-text)" }}>
                Replace job description
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm leading-5" style={{ color: "var(--as-text-muted)" }}>
                Replace the source document before candidate activity starts.
              </DialogPrimitive.Description>
            </div>
            {!isSubmitting && (
              <button
                type="button"
                onClick={requestClose}
                className="p-1.5 text-[var(--as-text-subtle)] transition-colors hover:text-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/40"
                aria-label="Close replace job description"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
            {phase === "success" ? (
              <div className="py-5 text-center" role="status" aria-live="polite">
                <CheckCircle2 className="mx-auto h-9 w-9 text-[#009E73]" />
                <h4 className="mt-3 text-base font-black" style={{ color: "var(--as-text)" }}>
                  Job description replaced and role configuration rebuilt.
                </h4>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6" style={{ color: "var(--as-text-muted)" }}>
                  The latest job description and interview configuration are now available for {role?.title || "this role"}.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="border-l-4 border-[#F0A500] bg-[#F0A500]/8 px-4 py-3 text-sm leading-6" style={{ color: "var(--as-text-muted)" }}>
                  <p>Replacing the job description will rebuild the rubric and interview configuration for this role. This is only available before candidates start.</p>
                  <p className="mt-1 font-semibold" style={{ color: "var(--as-text)" }}>The role, billing history, and purchase records will remain unchanged.</p>
                </div>

                <dl className="grid grid-cols-1 gap-x-5 gap-y-3 border-y py-4 text-sm sm:grid-cols-3" style={{ borderColor: "var(--as-border)" }}>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Role</dt>
                    <dd className="mt-1 truncate font-bold" style={{ color: "var(--as-text)" }}>{role?.title || "Role"}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Current JD</dt>
                    <dd className="mt-1 truncate font-semibold" style={{ color: "var(--as-text-muted)" }} title={currentJd}>{currentJd}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Status</dt>
                    <dd className="mt-1 font-semibold" style={{ color: "var(--as-text-muted)" }}>{roleStatusLabel(role?.status)}</dd>
                  </div>
                </dl>

                {error && (
                  <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm" role="alert" aria-live="assertive">
                    <p className="font-black text-red-700">{error.title}</p>
                    <p className="mt-1 leading-5 text-red-700">{error.message}</p>
                    {error.blockers.length > 0 && (
                      <ul className="mt-2 list-disc pl-5 text-red-700">
                        {error.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}
                      </ul>
                    )}
                  </div>
                )}

                <div>
                  <label htmlFor="replace-job-description-file" className="mb-1.5 block text-xs font-black" style={{ color: "var(--as-text)" }}>
                    New job description
                  </label>
                  <input
                    ref={fileInputRef}
                    id="replace-job-description-file"
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(event) => chooseFile(event.target.files?.[0] || null)}
                    disabled={isSubmitting}
                    className="block w-full cursor-pointer rounded-md border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#A380F6]/12 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#7C5FCC] hover:file:bg-[#A380F6]/18 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ borderColor: "var(--as-border)", color: "var(--as-text)", backgroundColor: "var(--as-surface-muted)" }}
                  />
                  <p className="mt-1.5 text-xs" style={{ color: "var(--as-text-subtle)" }}>PDF or DOCX, up to 20 MB.</p>
                  {file && (
                    <div className="mt-2 flex items-center justify-between gap-3 text-sm" style={{ color: "var(--as-text-muted)" }}>
                      <span className="min-w-0 truncate"><FileUp className="mr-1.5 inline h-4 w-4 text-[#A380F6]" />{file.name}</span>
                      <button type="button" onClick={() => chooseFile(null)} disabled={isSubmitting} className="shrink-0 text-xs font-bold text-[#7C5FCC] hover:text-[#6B4FC0] disabled:opacity-60">Remove</button>
                    </div>
                  )}
                  {fileError && <p className="mt-2 text-xs font-semibold text-red-600" role="alert">{fileError}</p>}
                </div>

                <div>
                  <label htmlFor="replace-job-description-reason" className="mb-1.5 block text-xs font-black" style={{ color: "var(--as-text)" }}>
                    Reason <span className="font-semibold" style={{ color: "var(--as-text-subtle)" }}>(optional)</span>
                  </label>
                  <textarea
                    id="replace-job-description-reason"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    disabled={isSubmitting}
                    maxLength={2000}
                    rows={2}
                    placeholder="Wrong job description uploaded"
                    className="w-full resize-y rounded-md border px-3 py-2 text-sm placeholder:text-[#0A1547]/35 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/25 disabled:opacity-60"
                    style={{ borderColor: "var(--as-border)", color: "var(--as-text)", backgroundColor: "var(--as-surface-muted)" }}
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-5" style={{ color: "var(--as-text)" }}>
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={isSubmitting}
                    className="mt-0.5 h-4 w-4 accent-[#A380F6]"
                  />
                  <span>I understand the current rubric and interview configuration will be replaced.</span>
                </label>

                {isSubmitting && (
                  <div className="flex items-start gap-3 border-l-4 border-[#A380F6] bg-[#A380F6]/8 px-4 py-3 text-sm" role="status" aria-live="assertive">
                    <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[#7C5FCC]" />
                    <div>
                      <p className="font-bold" style={{ color: "var(--as-text)" }}>Uploading the new job description and rebuilding the role configuration...</p>
                      <p className="mt-1 leading-5" style={{ color: "var(--as-text-muted)" }}>This may take up to a minute. Do not close this window.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 border-t px-5 py-4 sm:flex-row sm:justify-end sm:px-6" style={{ borderColor: "var(--as-border)", backgroundColor: "var(--as-surface-muted)" }}>
            {phase === "success" ? (
              <button type="button" onClick={requestClose} className="rounded-md bg-[#A380F6] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90">Done</button>
            ) : (
              <>
                <button type="button" onClick={requestClose} disabled={isSubmitting} className="rounded-md border px-4 py-2 text-sm font-bold transition-colors hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: "var(--as-border)", color: "var(--as-text-muted)", backgroundColor: "var(--as-surface)" }}>Cancel</button>
                <button type="button" onClick={() => { void submit(); }} disabled={!canSubmit} className="rounded-md bg-[#A380F6] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45">
                  {isSubmitting ? "Rebuilding role..." : "Replace and rebuild role"}
                </button>
              </>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
