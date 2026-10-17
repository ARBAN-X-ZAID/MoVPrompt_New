import { createContext } from "react";
import type { TemplatePhotoActions } from "../create/TemplatePhotos";

export type UploadChoice = { role: "subject" | "character"; replace: boolean; upload: () => void; onFiles: TemplatePhotoActions["onFiles"] };
export const AssetUploadContext = createContext<{ enabled: boolean; open: (choice: UploadChoice) => void; close: () => void } | null>(null);
