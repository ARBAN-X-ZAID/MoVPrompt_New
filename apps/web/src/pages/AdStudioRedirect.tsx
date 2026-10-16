import { Navigate, useLocation, useParams } from "react-router-dom";
import { AD_STUDIO_BRAND_AD_ID } from "@movprompt/contracts";
import { templateDetailPath, templateSection } from "@/features/create/templatePlacement";

/** Ad Studio is a single form, so its library paths open the brand ad creator directly. */
export default function AdStudioRedirect() {
  const { slug } = useParams();
  const location = useLocation();
  if (slug && slug !== AD_STUDIO_BRAND_AD_ID && templateSection(slug) !== "ad-studio") {
    return <Navigate replace to={`${templateDetailPath(slug)}${location.search}${location.hash}`} />;
  }
  const current = new URLSearchParams(location.search);
  const next = new URLSearchParams({ template: slug ?? AD_STUDIO_BRAND_AD_ID });
  for (const key of ["draft", "project", "resume"]) {
    const value = current.get(key);
    if (value) next.set(key, value);
  }
  return <Navigate replace to={`/create?${next}${location.hash}`} />;
}
