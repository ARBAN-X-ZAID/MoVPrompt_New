import { AD_STUDIO_BRAND_AD_ID, PRODUCT_MODEL_AD_ID } from "@movprompt/contracts";
import { CreateScreen } from "./CreateScreen";
import { ProductModelAdScreen, type ProductModelAdScreenProps } from "./ProductModelAdScreen";
import { AdStudioBrandAdScreen, type AdStudioBrandAdScreenProps } from "./AdStudioBrandAdScreen";

export type TemplateCreateScreenProps = ProductModelAdScreenProps & Partial<Pick<AdStudioBrandAdScreenProps, "onBrandAdSettingsChange" | "onProjectSettingsChange" | "resumeNotice">>;

/** Existing templates continue to render their original component and props. */
export function TemplateCreateScreen(props: TemplateCreateScreenProps) {
  if (props.project.templateId === AD_STUDIO_BRAND_AD_ID) {
    const { onBrandAdSettingsChange = () => undefined, onProjectSettingsChange = () => undefined } = props;
    return <AdStudioBrandAdScreen {...props} onBrandAdSettingsChange={onBrandAdSettingsChange} onProjectSettingsChange={onProjectSettingsChange} />;
  }
  return props.project.templateId === PRODUCT_MODEL_AD_ID ? <ProductModelAdScreen {...props} /> : <CreateScreen {...props} />;
}
