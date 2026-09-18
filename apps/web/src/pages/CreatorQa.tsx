import { useSearchParams } from "react-router-dom";
import { GenerationProgressPreview } from "@/features/create/GenerationProgressPreview";
import { CreateStudio } from "@/features/create/CreateStudio";
import CreatorProjects from "./CreatorProjects";
import CreatorTemplates from "./CreatorTemplates";

export default function CreatorQa() {
  const [params] = useSearchParams();
  const view = params.get("view");
  if (view === "generation-progress") return <GenerationProgressPreview />;
  if (view === "templates") return <CreatorTemplates qaMode />;
  if (view === "projects") return <CreatorProjects qaMode />;
  return <CreateStudio qaMode />;
}
