import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  type OptionalTrackingSelection,
  useTrackingConsent,
} from "@/context/TrackingConsentContext";

const EMPTY_OPTIONAL_TRACKING_SELECTION: OptionalTrackingSelection = {
  analytics: false,
  marketingAttribution: false,
  visitorChat: false,
};

type TrackingConsentNoticeProps = {
  visible: boolean;
};

type PreferenceRowProps = {
  checked: boolean;
  description: string;
  id: string;
  label: string;
  locked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

function PreferenceRow({
  checked,
  description,
  id,
  label,
  locked = false,
  onCheckedChange,
}: PreferenceRowProps) {
  const labelId = `tracking-preference-${id}-label`;
  const descriptionId = `tracking-preference-${id}-description`;

  return (
    <section className="flex items-start justify-between gap-4 border-t border-[#0A1547]/10 py-4 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 id={labelId} className="text-sm font-semibold text-[#0A1547]">
            {label}
          </h3>
          {locked ? <Lock className="h-3.5 w-3.5 text-[#0A1547]/60" aria-hidden="true" /> : null}
        </div>
        <p id={descriptionId} className="mt-1 text-sm leading-5 text-[#38415E]">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
        <Switch
          checked={checked}
          disabled={locked}
          onCheckedChange={onCheckedChange}
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          className="data-[state=checked]:bg-[#5D43CC]"
        />
        <span className="text-xs font-medium text-[#38415E]">
          {locked ? "Always on" : checked ? "Enabled" : "Disabled"}
        </span>
      </div>
    </section>
  );
}

export default function TrackingConsentNotice({ visible }: TrackingConsentNoticeProps) {
  const {
    allowAllOptionalTracking,
    closeTrackingPreferences,
    hasSavedPreferences,
    preferences,
    preferencesOpen,
    rejectOptionalTracking,
    savePreferences,
    openTrackingPreferences,
  } = useTrackingConsent();
  const [draft, setDraft] = useState<OptionalTrackingSelection>(EMPTY_OPTIONAL_TRACKING_SELECTION);

  useEffect(() => {
    if (preferencesOpen) {
      setDraft({
        analytics: preferences?.analytics ?? false,
        marketingAttribution: preferences?.marketingAttribution ?? false,
        visitorChat: preferences?.visitorChat ?? false,
      });
    }
  }, [preferences, preferencesOpen]);

  const showInitialBanner = visible && !hasSavedPreferences;
  const showPreferencesDialog = visible && preferencesOpen;

  return (
    <>
      {showInitialBanner ? (
        <section
          aria-hidden={preferencesOpen}
          aria-label="Privacy choices"
          data-testid="tracking-consent-banner"
          className={`fixed inset-x-0 bottom-0 z-[80] border-t border-[#A380F6]/55 bg-[#F8F9FD] shadow-[0_-8px_24px_rgba(10,21,71,0.10)] ${
            preferencesOpen ? "invisible pointer-events-none" : ""
          }`}
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
            <div className="max-w-3xl">
              <h2 className="text-sm font-semibold text-[#0A1547]">Privacy choices</h2>
              <p className="mt-1 text-sm leading-5 text-[#38415E]">
                We use optional analytics, marketing attribution, and visitor chat tools. You can allow all
                optional technologies or choose which categories to enable. Essential sign-in and security
                functions always remain active.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={allowAllOptionalTracking}
                className="min-h-10 rounded-md bg-[#A380F6] px-4 text-sm font-semibold text-[#0A1547] transition-colors hover:bg-[#9270E8] focus:outline-none focus:ring-2 focus:ring-[#5D43CC] focus:ring-offset-2"
              >
                Allow all
              </button>
              <button
                type="button"
                onClick={openTrackingPreferences}
                className="min-h-10 rounded-md border border-[#0A1547]/20 bg-white px-4 text-sm font-semibold text-[#0A1547] transition-colors hover:border-[#5D43CC] hover:bg-[#F1EDFF] focus:outline-none focus:ring-2 focus:ring-[#5D43CC] focus:ring-offset-2"
              >
                Configure preferences
              </button>
              <a
                href="/privacy/"
                className="inline-flex min-h-10 items-center justify-center px-2 text-sm font-semibold text-[#3F2B96] underline underline-offset-4 focus:outline-none focus:ring-2 focus:ring-[#5D43CC] focus:ring-offset-2"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <Dialog
        open={showPreferencesDialog}
        onOpenChange={(open) => {
          if (!open) closeTrackingPreferences();
        }}
      >
        <DialogContent
          data-testid="tracking-preferences-dialog"
          className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto border-[#0A1547]/15 bg-white p-0 sm:rounded-lg"
        >
          <div className="p-5 sm:p-6">
            <DialogHeader className="pr-8">
              <DialogTitle className="text-xl text-[#0A1547]">Configure privacy preferences</DialogTitle>
              <DialogDescription className="pt-2 text-sm leading-5 text-[#38415E]">
                Choose which optional technologies alphaSource AI may use on this device. Essential functions
                are always enabled.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6">
              <PreferenceRow
                checked
                description="Required for sign-in, security, session management, and core site functionality."
                id="essential"
                label="Essential"
                locked
              />
              <PreferenceRow
                checked={draft.analytics}
                description="Helps us understand how visitors use the public site so we can improve navigation and content."
                id="analytics"
                label="Analytics"
                onCheckedChange={(analytics) => setDraft((current) => ({ ...current, analytics }))}
              />
              <PreferenceRow
                checked={draft.marketingAttribution}
                description="Helps our marketing team understand where website traffic originates and how visitors navigate the public site."
                id="marketing-attribution"
                label="Marketing attribution"
                onCheckedChange={(marketingAttribution) =>
                  setDraft((current) => ({ ...current, marketingAttribution }))
                }
              />
              <PreferenceRow
                checked={draft.visitorChat}
                description="Enables the optional public chat tool so visitors can contact us while browsing the site."
                id="visitor-chat"
                label="Visitor chat"
                onCheckedChange={(visitorChat) => setDraft((current) => ({ ...current, visitorChat }))}
              />
            </div>

            <DialogFooter className="mt-6 flex-col gap-2 sm:flex-row sm:justify-end sm:space-x-0">
              <button
                type="button"
                onClick={allowAllOptionalTracking}
                className="min-h-10 rounded-md border border-[#0A1547]/20 bg-white px-4 text-sm font-semibold text-[#0A1547] transition-colors hover:border-[#5D43CC] hover:bg-[#F1EDFF] focus:outline-none focus:ring-2 focus:ring-[#5D43CC] focus:ring-offset-2"
              >
                Allow all
              </button>
              <button
                type="button"
                onClick={rejectOptionalTracking}
                className="min-h-10 rounded-md border border-[#0A1547]/20 bg-white px-4 text-sm font-semibold text-[#0A1547] transition-colors hover:border-[#5D43CC] hover:bg-[#F1EDFF] focus:outline-none focus:ring-2 focus:ring-[#5D43CC] focus:ring-offset-2"
              >
                Reject optional
              </button>
              <button
                type="button"
                onClick={() => savePreferences(draft)}
                className="min-h-10 rounded-md bg-[#A380F6] px-4 text-sm font-semibold text-[#0A1547] transition-colors hover:bg-[#9270E8] focus:outline-none focus:ring-2 focus:ring-[#5D43CC] focus:ring-offset-2"
              >
                Save preferences
              </button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
