import { useEffect, useId, useMemo, useState } from "react";

import type { CampaignPresenter } from "@movprompt/contracts";

import type { CreatorAsset } from "./types";

export type PresenterCompatibility = {
  aiUgc: boolean;
  uploadedSpokesperson: boolean;
};

type PresenterChoiceProps = {
  value?: CampaignPresenter;
  compatibility: PresenterCompatibility;
  eligibleFootage: CreatorAsset[];
  onChange: (presenter: CampaignPresenter) => void;
  arabic?: boolean;
};

function copy(arabic: boolean, english: string, arabicText: string) {
  return arabic ? arabicText : english;
}

function isEligibleFootage(asset: CreatorAsset) {
  return Boolean(
    asset.mimeType && /^video\/(mp4|quicktime)$/i.test(asset.mimeType)
    && asset.storagePath
    && /^[a-f0-9]{64}$/i.test(asset.checksum ?? "")
    && Boolean(asset.durationMs && asset.durationMs > 0 && asset.durationMs <= 10 * 60 * 1_000),
  );
}

function allowedPresenter(value: CampaignPresenter | undefined, compatibility: PresenterCompatibility, footage: CreatorAsset[]): CampaignPresenter {
  if (!value || value.mode === "none") return { mode: "none" };
  if (value.mode === "ai_ugc" && compatibility.aiUgc) return value;
  if (value.mode === "uploaded_spokesperson" && compatibility.uploadedSpokesperson && footage.some((asset) => asset.id === value.assetId)) return value;
  return { mode: "none" };
}

/**
 * People choices are intentionally rendered only from server-projected
 * compatibility. The component keeps no provider identities or avatar data.
 */
export function PresenterChoice({
  value,
  compatibility,
  eligibleFootage,
  onChange,
  arabic = false,
}: PresenterChoiceProps) {
  const groupId = useId();
  const footage = useMemo(() => eligibleFootage.filter(isEligibleFootage), [eligibleFootage]);
  const initial = allowedPresenter(value, compatibility, footage);
  const [selectedMode, setSelectedMode] = useState<CampaignPresenter["mode"]>(initial.mode);
  const [selectedAssetId, setSelectedAssetId] = useState(
    initial.mode === "uploaded_spokesperson" ? initial.assetId : footage[0]?.id ?? "",
  );
  const [rightsAttested, setRightsAttested] = useState(initial.mode === "uploaded_spokesperson");

  useEffect(() => {
    const next = allowedPresenter(value, compatibility, footage);
    setSelectedMode(next.mode);
    if (next.mode === "uploaded_spokesperson") {
      setSelectedAssetId(next.assetId);
      setRightsAttested(true);
    }
  }, [compatibility, footage, value]);

  const selectMode = (mode: CampaignPresenter["mode"]) => {
    setSelectedMode(mode);
    if (mode === "none") {
      setRightsAttested(false);
      onChange({ mode: "none" });
      return;
    }
    if (mode === "ai_ugc") {
      setRightsAttested(false);
      onChange({ mode: "ai_ugc" });
      return;
    }
    setRightsAttested(false);
  };

  const updateUploadedPresenter = (assetId: string, attested: boolean) => {
    setSelectedAssetId(assetId);
    setRightsAttested(attested);
    if (!assetId || !attested) {
      // Consent is part of the persisted presenter identity. Removing it must
      // immediately clear the authoritative selection, not merely hide the
      // acknowledgement in local component state.
      setSelectedMode("none");
      onChange({ mode: "none" });
      return;
    }
    onChange({
      mode: "uploaded_spokesperson",
      assetId,
      rights: {
        version: "person-media-rights-v1",
        assetId,
        personMediaRightsAttested: true,
      },
    });
  };

  return (
    <fieldset className="creator-presenter-choice" aria-describedby={`${groupId}-help`}>
      <legend className="sr-only">{copy(arabic, "Who appears in this video?", "من يظهر في هذا الفيديو؟")}</legend>
      <p id={`${groupId}-help`} className="creator-field-help">
        {copy(arabic, "Only options approved for this template are shown.", "تظهر فقط الخيارات المعتمدة لهذا القالب.")}
      </p>
      <div className="creator-presenter-options">
        <label className={`creator-presenter-option ${selectedMode === "none" ? "is-selected" : ""}`}>
          <input type="radio" name={groupId} aria-label={copy(arabic, "No presenter", "بدون مقدّم")} checked={selectedMode === "none"} onChange={() => selectMode("none")} />
          <span><strong>{copy(arabic, "No presenter", "بدون مقدّم")}</strong><small>{copy(arabic, "Keep the focus on your confirmed product or service.", "خلي التركيز على منتجك أو خدمتك المؤكدة.")}</small></span>
        </label>
        {compatibility.aiUgc && <label className={`creator-presenter-option ${selectedMode === "ai_ugc" ? "is-selected" : ""}`}>
          <input type="radio" name={groupId} aria-label={copy(arabic, "AI UGC presenter", "مقدّم محتوى UGC بالذكاء الاصطناعي")} checked={selectedMode === "ai_ugc"} onChange={() => selectMode("ai_ugc")} />
          <span><strong>{copy(arabic, "AI UGC presenter", "مقدّم محتوى UGC بالذكاء الاصطناعي")}</strong><small>{copy(arabic, "A presenter style approved for this campaign language.", "أسلوب مقدّم معتمد للغة هذه الحملة.")}</small></span>
        </label>}
        {compatibility.uploadedSpokesperson && footage.length > 0 && <label className={`creator-presenter-option ${selectedMode === "uploaded_spokesperson" ? "is-selected" : ""}`}>
          <input type="radio" name={groupId} aria-label={copy(arabic, "Uploaded spokesperson", "متحدث تم رفعه")} checked={selectedMode === "uploaded_spokesperson"} onChange={() => selectMode("uploaded_spokesperson")} />
          <span><strong>{copy(arabic, "Uploaded spokesperson", "متحدث تم رفعه")}</strong><small>{copy(arabic, "Use your approved footage with an explicit rights acknowledgement.", "استخدم لقطاتك المعتمدة مع إقرار صريح بالحقوق.")}</small></span>
        </label>}
      </div>
      {compatibility.uploadedSpokesperson && footage.length === 0 && <p className="creator-field-help creator-presenter-unavailable">{copy(arabic, "Add a verified video in Source to use an uploaded spokesperson with this template.", "أضف فيديو موثقاً في المصدر لاستخدام متحدث مرفوع مع هذا القالب.")}</p>}
      {selectedMode === "uploaded_spokesperson" && footage.length > 0 && <div className="creator-presenter-confirmation">
        <label htmlFor={`${groupId}-asset`}>{copy(arabic, "Exact footage", "اللقطات المحددة")}</label>
        <select id={`${groupId}-asset`} className="creator-select" value={selectedAssetId} onChange={(event) => updateUploadedPresenter(event.target.value, rightsAttested)}>
          {footage.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
        </select>
        <label className="creator-check-row"><input type="checkbox" aria-label={copy(arabic, "I have permission to use this exact footage and the person shown has agreed to appear in this campaign.", "لدي إذن لاستخدام هذه اللقطات المحددة والشخص الظاهر وافق على الظهور في هذه الحملة.")} checked={rightsAttested} onChange={(event) => updateUploadedPresenter(selectedAssetId, event.target.checked)} /><span>{copy(arabic, "I have permission to use this exact footage and the person shown has agreed to appear in this campaign.", "لدي إذن لاستخدام هذه اللقطات المحددة والشخص الظاهر وافق على الظهور في هذه الحملة.")}</span></label>
      </div>}
    </fieldset>
  );
}
