import { PRODUCT_MODEL_AD_ID } from "@movprompt/contracts";
import { CreateScreen } from "./CreateScreen";
import { ProductModelAdScreen, type ProductModelAdScreenProps } from "./ProductModelAdScreen";

/** Existing templates continue to render their original component and props. */
export function TemplateCreateScreen(props: ProductModelAdScreenProps) {
  return props.project.templateId === PRODUCT_MODEL_AD_ID ? <ProductModelAdScreen {...props} /> : <CreateScreen {...props} />;
}
