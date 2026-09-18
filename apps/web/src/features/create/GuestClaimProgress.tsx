import type { GuestClaimProgress as GuestClaimProgressState } from "./creatorAssets";

export type GuestClaimProgressCopy = {
  heading: string;
  detail: string;
  creating: string;
  asset: (current: number, total: number) => string;
  verifying: string;
  cancel: string;
};

export function GuestClaimProgress({
  progress,
  copy,
  onCancel,
}: {
  progress: GuestClaimProgressState;
  copy: GuestClaimProgressCopy;
  onCancel: () => void;
}) {
  const stage = progress.stage === "asset"
    ? copy.asset(progress.current, progress.total)
    : progress.stage === "verifying"
      ? copy.verifying
      : copy.creating;

  return (
    <section className="creator-claim-page" aria-label={copy.heading}>
      <div className="creator-claim-panel creator-panel">
        <div className="creator-claim-status" role="status" aria-live="polite" aria-atomic="true">
          <p className="creator-kicker">{stage}</p>
          <h1>{copy.heading}</h1>
          <p>{copy.detail}</p>
        </div>
        <button className="creator-button creator-button-secondary" type="button" onClick={onCancel}>
          {copy.cancel}
        </button>
      </div>
    </section>
  );
}
