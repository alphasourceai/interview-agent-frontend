import { useEffect, useMemo, useRef, useState } from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { LoaderCircle, Plus, Trash2, X } from "lucide-react";

export interface EditRoleRubricModalRole {
  id: string;
  clientId: string;
  title: string;
  entityName?: string | null;
  parentClientName?: string | null;
  status?: string | null;
}

interface RubricQuestion {
  id: string;
  text: string;
}

interface LoadedConfig {
  tavusPrompt: string;
  questions: RubricQuestion[];
}

interface ServerError {
  status: number;
  code: string;
  detail: string;
}

const UPDATE_FAILURE = "The role configuration could not be updated. No changes were saved.";
let questionSequence = 0;

function nextQuestionId(): string {
  questionSequence += 1;
  return `rubric-question-${questionSequence}`;
}

function parseJsonSafe(text: string): Record<string, unknown> | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const text = typeof value === "string" ? value.trim() : "";
    if (text) return text;
  }
  return "";
}

function readServerError(status: number, text: string): ServerError {
  const payload = parseJsonSafe(text);
  return {
    status,
    code: firstText(payload?.code),
    detail: firstText(payload?.detail, payload?.message, payload?.error, text),
  };
}

function toQuestions(values: unknown): RubricQuestion[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .map((text) => ({ id: nextQuestionId(), text }));
}

function roleStatusLabel(status: string | null | undefined): string {
  const normalized = String(status || "active").trim().toLowerCase();
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "Active";
}

function scopeLabel(role: EditRoleRubricModalRole): string {
  const parent = String(role.parentClientName || "").trim();
  const entity = String(role.entityName || "").trim();
  if (parent && entity && parent !== entity) return `${parent} / ${entity}`;
  return parent || entity || "Current client";
}

function questionsValidation(questions: RubricQuestion[]): string {
  if (questions.some((question) => !question.text.trim())) {
    return "Remove or complete blank rubric questions before saving.";
  }

  const seen = new Set<string>();
  const closedEndedStartRe = /^(do you|are you|did you|have you|can you|will you|would you|were you|is there|is it)\b/i;
  const openEndedContinuationRe = /^(do you|are you|did you|have you|can you|will you|would you|were you|is there|is it)\b[\s,:-]*(please\s+)?(tell me about|walk me through|describe\b|how have you\b|what was your approach to\b|explain\b|share\b|give me an example\b)/i;

  for (const question of questions) {
    const text = question.text.trim();
    const key = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) return "Rubric questions must be distinct.";
    seen.add(key);
    if (closedEndedStartRe.test(text) && !openEndedContinuationRe.test(text)) {
      return "Rubric questions must be open-ended and not yes/no style.";
    }
  }

  return "";
}

function configSnapshot(tavusPrompt: string, questions: RubricQuestion[]): string {
  return JSON.stringify({ tavusPrompt, questions: questions.map((question) => question.text) });
}

function shouldOfferReload(error: ServerError): boolean {
  return error.status === 404 || error.status === 409 || ["ROLE_NOT_FOUND", "ROLE_CONFIG_STALE", "ROLE_CONFIG_CONFLICT"].includes(error.code);
}

export default function EditRoleRubricModal({
  open,
  role,
  sessionKey,
  backendBase,
  getSessionToken,
  onClose,
  onSuccess,
  getRestoreFocusTarget,
}: {
  open: boolean;
  role: EditRoleRubricModalRole | null;
  sessionKey: number;
  backendBase: string;
  getSessionToken: () => Promise<string>;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  getRestoreFocusTarget?: () => HTMLElement | null;
}) {
  const [loadedConfig, setLoadedConfig] = useState<LoadedConfig | null>(null);
  const [loadedSession, setLoadedSession] = useState<number | null>(null);
  const [tavusPrompt, setTavusPrompt] = useState("");
  const [questions, setQuestions] = useState<RubricQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");
  const [offerReload, setOfferReload] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(open);
  const movedInitialFocusRef = useRef(false);

  const isLoaded = Boolean(loadedConfig) && loadedSession === sessionKey;
  const baseline = useMemo(
    () => isLoaded && loadedConfig ? configSnapshot(loadedConfig.tavusPrompt, loadedConfig.questions) : "",
    [isLoaded, loadedConfig],
  );
  const isDirty = isLoaded && configSnapshot(tavusPrompt, questions) !== baseline;
  const validationError = useMemo(() => questionsValidation(questions), [questions]);
  const canSave = isLoaded && isDirty && !validationError && !saving;

  useEffect(() => {
    if (!open || !role) return;
    let active = true;
    movedInitialFocusRef.current = false;
    setLoading(true);
    setError("");
    setOfferReload(false);
    setDiscardConfirmOpen(false);
    setLoadedConfig(null);
    setLoadedSession(null);

    const loadCurrentConfig = async () => {
      if (!backendBase) {
        if (!active) return;
        setError("Could not load current role configuration. Missing backend base URL configuration.");
        setOfferReload(false);
        setLoading(false);
        return;
      }

      try {
        const token = await getSessionToken();
        const response = await fetch(
          `${backendBase}/admin/roles/${encodeURIComponent(role.id)}/interview-config?client_id=${encodeURIComponent(role.clientId)}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            credentials: "omit",
          },
        );
        const text = await response.text();
        if (!response.ok) {
          const requestError = readServerError(response.status, text);
          throw requestError;
        }

        const payload = parseJsonSafe(text);
        const item = payload?.item && typeof payload.item === "object"
          ? payload.item as Record<string, unknown>
          : null;
        const nextConfig = {
          tavusPrompt: typeof item?.tavus_prompt === "string" ? item.tavus_prompt : "",
          questions: toQuestions(item?.rubric_questions),
        };

        if (!active) return;
        setLoadedConfig(nextConfig);
        setLoadedSession(sessionKey);
        setTavusPrompt(nextConfig.tavusPrompt);
        setQuestions(nextConfig.questions);
      } catch (loadError) {
        if (!active) return;
        const requestError = loadError as Partial<ServerError>;
        const detail = firstText(requestError.detail);
        setError(`Could not load current role configuration.${detail ? ` ${detail}` : ""}`);
        setOfferReload(true);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadCurrentConfig();
    return () => {
      active = false;
    };
  }, [open, role?.id, role?.clientId, backendBase, reloadNonce, sessionKey]);

  useEffect(() => {
    if (!open || !isLoaded || movedInitialFocusRef.current) return;
    const timer = window.setTimeout(() => {
      (promptRef.current || contentRef.current)?.focus();
      movedInitialFocusRef.current = true;
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, isLoaded]);

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

  if (!role) return null;

  const requestClose = () => {
    if (saving) return;
    if (isDirty) {
      setDiscardConfirmOpen(true);
      return;
    }
    onClose();
  };

  const interceptDismiss = (event: Event) => {
    if (saving || isDirty) {
      event.preventDefault();
      if (!saving && isDirty) setDiscardConfirmOpen(true);
    }
  };

  const updateQuestion = (id: string, text: string) => {
    setQuestions((current) => current.map((question) => question.id === id ? { ...question, text } : question));
    setError("");
    setOfferReload(false);
  };

  const addQuestion = () => {
    setQuestions((current) => [...current, { id: nextQuestionId(), text: "" }]);
    setError("");
    setOfferReload(false);
  };

  const removeQuestion = (id: string) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
    setError("");
    setOfferReload(false);
  };

  const save = async () => {
    if (!canSave || !isLoaded) return;

    setSaving(true);
    setError("");
    setOfferReload(false);
    try {
      const token = await getSessionToken();
      const response = await fetch(
        `${backendBase}/admin/roles/${encodeURIComponent(role.id)}/interview-config?client_id=${encodeURIComponent(role.clientId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "omit",
          body: JSON.stringify({
            tavus_prompt: tavusPrompt.trim() || null,
            rubric_questions: questions.map((question) => question.text.trim()),
          }),
        },
      );
      const text = await response.text();
      if (!response.ok) {
        const requestError = readServerError(response.status, text);
        if (shouldOfferReload(requestError)) {
          setError("The role configuration changed or is no longer available. Reload current configuration before trying again.");
          setOfferReload(true);
        } else {
          setError(`${UPDATE_FAILURE}${requestError.detail ? ` ${requestError.detail}` : ""}`);
        }
        return;
      }

      await onSuccess();
      onClose();
    } catch (saveError) {
      const detail = saveError instanceof Error ? saveError.message : "";
      setError(`${UPDATE_FAILURE}${detail ? ` ${detail}` : ""}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(nextOpen) => { if (!nextOpen) requestClose(); }}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-[#0A1547]/45 backdrop-blur-[1px]" />
          <DialogPrimitive.Content
            ref={contentRef}
            tabIndex={-1}
            className="fixed left-1/2 top-1/2 z-[91] flex max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border bg-[var(--as-surface)] shadow-[0_24px_70px_rgba(10,21,71,0.28)] focus:outline-none"
            style={{ borderColor: "var(--as-border)" }}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              contentRef.current?.focus();
            }}
            onEscapeKeyDown={interceptDismiss}
            onPointerDownOutside={interceptDismiss}
            onInteractOutside={interceptDismiss}
          >
            <div className="flex items-start justify-between gap-4 border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--as-border)" }}>
              <div className="min-w-0">
                <DialogPrimitive.Title className="text-base font-black" style={{ color: "var(--as-text)" }}>
                  Edit rubric questions
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="mt-1 text-sm leading-5" style={{ color: "var(--as-text-muted)" }}>
                  Update the interview rubric and Tavus prompt for this role.
                </DialogPrimitive.Description>
              </div>
              {!saving && (
                <button
                  type="button"
                  onClick={requestClose}
                  className="p-1.5 text-[var(--as-text-subtle)] transition-colors hover:text-[#A380F6] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/40"
                  aria-label="Close edit rubric questions"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">
              <div className="space-y-5">
                <dl className="grid grid-cols-1 gap-x-5 gap-y-3 border-y py-4 text-sm sm:grid-cols-4" style={{ borderColor: "var(--as-border)" }}>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Role</dt>
                    <dd className="mt-1 truncate font-bold" style={{ color: "var(--as-text)" }} title={role.title}>{role.title}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Client / Entity</dt>
                    <dd className="mt-1 truncate font-semibold" style={{ color: "var(--as-text-muted)" }} title={scopeLabel(role)}>{scopeLabel(role)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Status</dt>
                    <dd className="mt-1 font-semibold" style={{ color: "var(--as-text-muted)" }}>{roleStatusLabel(role.status)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-subtle)" }}>Questions</dt>
                    <dd className="mt-1 font-semibold" style={{ color: "var(--as-text-muted)" }}>{loading ? "Loading" : questions.length}</dd>
                  </div>
                </dl>

                <div className="border-l-4 border-[#F0A500] bg-[#F0A500]/8 px-4 py-3 text-sm leading-6" style={{ color: "var(--as-text-muted)" }}>
                  Changes affect future interviews for this role. Existing completed interviews and reports are not recalculated.
                </div>

                {error && (
                  <div className="border-l-4 border-red-500 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700" role="alert" aria-live="assertive">
                    <p>{error}</p>
                    {offerReload && (
                      <button
                        type="button"
                        onClick={() => setReloadNonce((value) => value + 1)}
                        disabled={saving}
                        className="mt-2 font-bold underline underline-offset-2 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reload current configuration
                      </button>
                    )}
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center gap-3 py-7 text-sm" role="status" aria-live="polite" style={{ color: "var(--as-text-muted)" }}>
                    <LoaderCircle className="h-4 w-4 animate-spin text-[#7C5FCC]" />
                    Loading current configuration...
                  </div>
                ) : isLoaded && loadedConfig && (
                  <div className="space-y-5">
                    <div>
                      <label htmlFor="edit-role-rubric-tavus-prompt" className="mb-2 block text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-muted)" }}>
                        Tavus prompt
                      </label>
                      <textarea
                        ref={promptRef}
                        id="edit-role-rubric-tavus-prompt"
                        rows={3}
                        value={tavusPrompt}
                        onChange={(event) => {
                          setTavusPrompt(event.target.value);
                          setError("");
                          setOfferReload(false);
                        }}
                        disabled={saving}
                        placeholder="Enter Tavus persona prompt..."
                        className="w-full resize-none rounded-lg border bg-[var(--as-surface-muted)] px-3 py-2.5 text-sm font-medium leading-relaxed text-[var(--as-text)] placeholder:text-[#0A1547]/25 focus:border-[#A380F6] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:placeholder:text-slate-400/45"
                        style={{ borderColor: "var(--as-border)" }}
                      />
                    </div>

                    <div>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <label className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--as-text-muted)" }}>
                          Rubric questions
                        </label>
                        <span className="text-xs font-semibold" style={{ color: "var(--as-text-subtle)" }}>{questions.length} total</span>
                      </div>
                      <div className="space-y-3">
                        {questions.map((question, index) => (
                          <div key={question.id} className="flex items-start gap-2">
                            <textarea
                              rows={2}
                              value={question.text}
                              onChange={(event) => updateQuestion(question.id, event.target.value)}
                              disabled={saving}
                              aria-label={`Rubric question ${index + 1}`}
                              placeholder={`Question ${index + 1}`}
                              className="min-w-0 flex-1 resize-none rounded-lg border bg-[var(--as-surface-muted)] px-3 py-2.5 text-sm font-medium leading-relaxed text-[var(--as-text)] placeholder:text-[#0A1547]/25 focus:border-[#A380F6] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:placeholder:text-slate-400/45"
                              style={{ borderColor: "var(--as-border)" }}
                            />
                            <button
                              type="button"
                              onClick={() => removeQuestion(question.id)}
                              disabled={saving}
                              className="mt-1 rounded-md p-2 text-[var(--as-text-subtle)] transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`Delete rubric question ${index + 1}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      {validationError && (
                        <p className="mt-3 text-sm font-semibold text-red-600" role="alert">{validationError}</p>
                      )}
                      <button
                        type="button"
                        onClick={addQuestion}
                        disabled={saving}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#A380F6]/40 px-3 py-2 text-xs font-bold text-[#7C5FCC] transition-colors hover:bg-[#A380F6]/10 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/35 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add question
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-6" style={{ borderColor: "var(--as-border)" }}>
              <button
                type="button"
                onClick={requestClose}
                disabled={saving}
                className="rounded-md px-3 py-2 text-sm font-bold text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-surface-muted)] hover:text-[var(--as-text)] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/35 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { void save(); }}
                disabled={!canSave}
                className="inline-flex items-center gap-2 rounded-md bg-[#A380F6] px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#A380F6]/45 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <AlertDialogPrimitive.Root open={discardConfirmOpen} onOpenChange={setDiscardConfirmOpen}>
        <AlertDialogPrimitive.Portal>
          <AlertDialogPrimitive.Overlay className="fixed inset-0 z-[92] bg-[#0A1547]/55" />
          <AlertDialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-[93] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-[var(--as-surface)] p-5 shadow-[0_20px_60px_rgba(10,21,71,0.28)] focus:outline-none"
            style={{ borderColor: "var(--as-border)" }}
          >
            <AlertDialogPrimitive.Title className="text-base font-black" style={{ color: "var(--as-text)" }}>
              Discard unsaved changes?
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="mt-2 text-sm leading-5" style={{ color: "var(--as-text-muted)" }}>
              Your edits to this role's interview configuration will be lost.
            </AlertDialogPrimitive.Description>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <AlertDialogPrimitive.Cancel className="rounded-md border px-3 py-2 text-sm font-bold text-[var(--as-text-muted)] transition-colors hover:bg-[var(--as-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[#A380F6]/35" style={{ borderColor: "var(--as-border)" }}>
                Keep editing
              </AlertDialogPrimitive.Cancel>
              <AlertDialogPrimitive.Action
                onClick={() => {
                  setDiscardConfirmOpen(false);
                  onClose();
                }}
                className="rounded-md bg-red-600 px-3 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-red-400"
              >
                Discard changes
              </AlertDialogPrimitive.Action>
            </div>
          </AlertDialogPrimitive.Content>
        </AlertDialogPrimitive.Portal>
      </AlertDialogPrimitive.Root>
    </>
  );
}
