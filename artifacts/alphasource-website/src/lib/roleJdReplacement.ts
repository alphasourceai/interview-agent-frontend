import { joinUrl, publicBackendBase } from "@/lib/urlConfig";

export interface RebuiltRole {
  id?: unknown;
  client_id?: unknown;
  title?: unknown;
  status?: unknown;
  job_description_url?: unknown;
  job_description_text?: unknown;
  rubric?: unknown;
  rubric_questions?: unknown;
  kb_document_id?: unknown;
  tavus_document_id?: unknown;
  tavus_prompt?: unknown;
}

export interface RoleJdReplacementResult {
  ok: true;
  replacement_id: string;
  role: RebuiltRole;
}

interface ReplacementErrorPayload {
  error?: unknown;
  message?: unknown;
  detail?: unknown;
  code?: unknown;
}

export class RoleJdReplacementRequestError extends Error {
  status: number;
  code: string;
  detail: string | null;

  constructor({ status, code, message, detail }: { status: number; code?: string; message: string; detail?: string | null }) {
    super(message);
    this.name = "RoleJdReplacementRequestError";
    this.status = status;
    this.code = code || "ROLE_JD_REPLACEMENT_FAILED";
    this.detail = detail || null;
  }
}

function parsePayload(text: string): ReplacementErrorPayload | null {
  if (!text) return null;
  try {
    const payload = JSON.parse(text);
    return payload && typeof payload === "object" ? payload as ReplacementErrorPayload : null;
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

export async function replaceRoleJobDescription({
  roleId,
  clientId,
  file,
  reason,
  accessToken,
  backendBase = publicBackendBase,
}: {
  roleId: string;
  clientId: string;
  file: File;
  reason?: string;
  accessToken: string;
  backendBase?: string;
}): Promise<RoleJdReplacementResult> {
  const normalizedRoleId = String(roleId || "").trim();
  const normalizedClientId = String(clientId || "").trim();
  const normalizedToken = String(accessToken || "").trim();
  const normalizedBase = String(backendBase || "").trim().replace(/\/+$/, "");

  if (!normalizedBase) {
    throw new RoleJdReplacementRequestError({
      status: 0,
      code: "BACKEND_BASE_MISSING",
      message: "Missing backend base URL configuration.",
    });
  }
  if (!normalizedRoleId || !normalizedClientId || !file || !normalizedToken) {
    throw new RoleJdReplacementRequestError({
      status: 0,
      code: "ROLE_JD_REPLACEMENT_REQUEST_INVALID",
      message: "Could not prepare the job description replacement request.",
    });
  }

  const form = new FormData();
  form.append("client_id", normalizedClientId);
  form.append("file", file);
  const normalizedReason = String(reason || "").trim();
  if (normalizedReason) form.append("reason", normalizedReason);

  const response = await fetch(
    joinUrl(normalizedBase, `/roles/${encodeURIComponent(normalizedRoleId)}/job-description-replacement`),
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${normalizedToken}`,
        Accept: "application/json",
      },
      credentials: "omit",
      body: form,
    },
  );
  const text = await response.text();
  const payload = parsePayload(text);

  if (!response.ok) {
    const detail = firstText(payload?.detail);
    throw new RoleJdReplacementRequestError({
      status: response.status,
      code: firstText(payload?.code),
      message: firstText(payload?.error, payload?.message) || `HTTP ${response.status}`,
      detail,
    });
  }

  const replacementId = firstText((payload as { replacement_id?: unknown } | null)?.replacement_id);
  const role = payload && typeof (payload as { role?: unknown }).role === "object"
    ? (payload as { role: RebuiltRole }).role
    : null;
  if ((payload as { ok?: unknown } | null)?.ok !== true || !replacementId || !role) {
    throw new RoleJdReplacementRequestError({
      status: response.status,
      code: "ROLE_JD_REPLACEMENT_RESPONSE_INVALID",
      message: "The role replacement response was incomplete. The active role was not updated in this screen.",
    });
  }

  return { ok: true, replacement_id: replacementId, role };
}
