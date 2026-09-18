import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampaignExportDialog } from "./CampaignExportDialog";
import type { CreatorAspectRatio } from "./types";

function Harness({ onDownload = vi.fn(), onGenerate = vi.fn(), arabic = false }: {
  onDownload?: () => Promise<void> | void;
  onGenerate?: (ratio: CreatorAspectRatio) => Promise<void> | void;
  arabic?: boolean;
}) {
  const [selectedRatio, setSelectedRatio] = useState<CreatorAspectRatio>("9:16");
  return <CampaignExportDialog open onOpenChange={vi.fn()} arabic={arabic} currentRatio="9:16" selectedRatio={selectedRatio} onSelectRatio={setSelectedRatio} resolution="480p" audio hasVideo previewOnly={false} onDownload={onDownload} onGenerate={onGenerate} />;
}

describe("campaign export", () => {
  it("downloads the existing video once with visible pending feedback", async () => {
    let finish!: () => void;
    const onDownload = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const onGenerate = vi.fn();
    render(<Harness onDownload={onDownload} onGenerate={onGenerate} />);
    fireEvent.click(screen.getByRole("button", { name: "Download 9:16" }));
    const pending = screen.getByRole("button", { name: "Preparing download…" });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(onGenerate).not.toHaveBeenCalled();
    await act(async () => finish());
    expect(screen.getByRole("button", { name: "Download 9:16" })).toBeEnabled();
  });

  it("selects an alternate format without silently generating another video", async () => {
    const onGenerate = vi.fn();
    const onDownload = vi.fn();
    render(<Harness onGenerate={onGenerate} onDownload={onDownload} />);
    fireEvent.click(screen.getByRole("button", { name: /4:5 Instagram portrait/ }));
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Download 9:16" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get quote for 4:5" }));
    await waitFor(() => expect(onGenerate).toHaveBeenCalledWith("4:5"));
    expect(onDownload).not.toHaveBeenCalled();
  });

  it("keeps a failed download retryable and reports the error in the dialog", async () => {
    render(<Harness onDownload={() => Promise.reject(new Error("network"))} />);
    fireEvent.click(screen.getByRole("button", { name: "Download 9:16" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your video remains saved");
    expect(screen.getByRole("button", { name: "Download 9:16" })).toBeEnabled();
  });

  it("provides an Arabic dialog and localized close control", () => {
    render(<Harness arabic />);
    expect(screen.getByRole("dialog", { name: "تصدير الحملة" })).toHaveAttribute("dir", "rtl");
    expect(screen.getByRole("button", { name: "إغلاق" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تنزيل 9:16" })).toBeEnabled();
  });
});
