import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/i18n/LanguageContext", () => ({ useLanguage: () => ({ locale: "en" }) }));
import { AdminTable } from "./AdminTable";
import { AdminBack } from "./AdminChrome";
import { safeReturnTo, withReturnTo } from "./adminNav";
afterEach(cleanup);

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}{location.search}</p>;
}

describe("admin tables and navigation", () => {
  it("opens the record from anywhere on the row while nested controls keep their own action", () => {
    const action = vi.fn();
    const { container } = render(<MemoryRouter><AdminTable
      rows={[{ id: "a", name: "Local retailer" }]}
      rowHref={row => `/admin/customers/${row.id}`}
      rowLabel={row => `Open ${row.name}`}
      empty="None"
      columns={[{ key: "name", label: "Customer", render: row => String(row.name) }, { key: "action", label: "Action", render: () => <button onClick={action}>Refund</button> }]}
    /><Where /></MemoryRouter>);
    const overlay = screen.getByRole("link", { name: "Open Local retailer" });
    expect(overlay).toHaveAttribute("href", "/admin/customers/a");
    expect(overlay).toHaveClass("admin-row-link");
    expect(container.querySelector("tr[data-href]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Refund" }));
    expect(action).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("where")).toHaveTextContent("/");
  });
  it("shows an empty state and no clickable overlay without rows", () => {
    render(<MemoryRouter><AdminTable rows={[]} columns={[]} empty="No customers" emptyHint="Try another search" rowHref={() => "/x"} /></MemoryRouter>);
    expect(screen.getByText("No customers")).toBeVisible();
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("keeps the filtered list when going back and rejects outside targets", () => {
    const href = withReturnTo("/admin/customers/a", { pathname: "/admin/customers", search: "?status=active&page=3" });
    render(<MemoryRouter initialEntries={[href]}><Routes><Route path="*" element={<><AdminBack fallback="/admin/customers" label="Back to customers" /><Where /></>} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole("link", { name: "Back to customers" }));
    expect(screen.getByTestId("where")).toHaveTextContent("/admin/customers?status=active&page=3");
    expect(safeReturnTo("https://evil.test/admin", "/admin")).toBe("/admin");
    expect(safeReturnTo("//evil.test", "/admin")).toBe("/admin");
    expect(safeReturnTo("/templates", "/admin")).toBe("/admin");
    expect(safeReturnTo("/admin/support?status=open", "/admin")).toBe("/admin/support?status=open");
  });
});
