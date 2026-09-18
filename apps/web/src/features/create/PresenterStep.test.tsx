import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PresenterChoice } from "./PresenterChoice";

const footage = {
  id: "1617bcf9-c2a5-4a15-bdfb-a7f80c4b4d76",
  name: "Founder introduction.mov",
  url: "blob:founder",
  mimeType: "video/quicktime",
  storagePath: "creator-assets/user/project/founder.mov",
  checksum: "a".repeat(64),
  durationMs: 10_000,
  source: "upload" as const,
};

describe("PresenterChoice", () => {
  it("defaults to no presenter and does not show unsupported people options", () => {
    render(
      <PresenterChoice
        value={{ mode: "ai_ugc" }}
        compatibility={{ aiUgc: false, uploadedSpokesperson: false }}
        eligibleFootage={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("radio", { name: "No presenter" })).toBeChecked();
    expect(screen.queryByRole("radio", { name: /AI UGC presenter/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/digital twin/i)).not.toBeInTheDocument();
  });

  it("shows only server-supported AI UGC and records its semantic presenter choice", () => {
    const onChange = vi.fn();
    render(
      <PresenterChoice
        value={{ mode: "none" }}
        compatibility={{ aiUgc: true, uploadedSpokesperson: false }}
        eligibleFootage={[]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "AI UGC presenter" }));
    expect(onChange).toHaveBeenCalledWith({ mode: "ai_ugc" });
  });

  it("requires the exact eligible footage and an explicit rights acknowledgement for an uploaded spokesperson", () => {
    const onChange = vi.fn();
    render(
      <PresenterChoice
        value={{ mode: "none" }}
        compatibility={{ aiUgc: false, uploadedSpokesperson: true }}
        eligibleFootage={[footage]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Uploaded spokesperson" }));
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ mode: "uploaded_spokesperson" }));
    fireEvent.click(screen.getByRole("checkbox", { name: /permission to use this exact footage/i }));
    expect(onChange).toHaveBeenCalledWith({
      mode: "uploaded_spokesperson",
      assetId: footage.id,
      rights: {
        version: "person-media-rights-v1",
        assetId: footage.id,
        personMediaRightsAttested: true,
      },
    });
  });

  it("keeps uploaded spokesperson unavailable until footage has server-verified duration metadata", () => {
    render(
      <PresenterChoice
        value={{ mode: "none" }}
        compatibility={{ aiUgc: false, uploadedSpokesperson: true }}
        eligibleFootage={[{ ...footage, durationMs: undefined }]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("radio", { name: "Uploaded spokesperson" })).not.toBeInTheDocument();
    expect(screen.getByText(/Add a verified video in Source/i)).toBeVisible();
  });

  it("clears the authoritative spokesperson selection when consent is withdrawn and stays cleared after reload", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PresenterChoice
        value={{
          mode: "uploaded_spokesperson",
          assetId: footage.id,
          rights: {
            version: "person-media-rights-v1",
            assetId: footage.id,
            personMediaRightsAttested: true,
          },
        }}
        compatibility={{ aiUgc: false, uploadedSpokesperson: true }}
        eligibleFootage={[footage]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: /permission to use this exact footage/i }));
    expect(onChange).toHaveBeenLastCalledWith({ mode: "none" });
    expect(screen.getByRole("radio", { name: "No presenter" })).toBeChecked();

    rerender(
      <PresenterChoice
        value={{ mode: "none" }}
        compatibility={{ aiUgc: false, uploadedSpokesperson: true }}
        eligibleFootage={[footage]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("radio", { name: "No presenter" })).toBeChecked();
    expect(screen.queryByRole("checkbox", { name: /permission to use this exact footage/i })).not.toBeInTheDocument();
  });
});
