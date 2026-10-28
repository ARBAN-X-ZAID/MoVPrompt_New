import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
/** Keep navigation available after a render failure. Reloading never repeats
 * an admin mutation automatically. */
export class AdminPageBoundary extends Component<
  { ar: boolean; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="admin-panel" role="alert">
        <h2 className="font-semibold">
          {this.props.ar
            ? "تعذر عرض هذا القسم"
            : "This section could not be displayed"}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {this.props.ar
            ? "أعد التحميل لاسترجاع آخر حالة محفوظة. قد تحتاج إلى إدخال التعديلات غير المحفوظة من جديد. لن يتكرر أي إجراء تلقائياً."
            : "Reload to retrieve the latest saved state. Unsaved edits may need to be entered again. Actions will not be repeated automatically."}
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          {this.props.ar ? "إعادة تحميل القسم" : "Reload section"}
        </Button>
      </section>
    );
  }
}
