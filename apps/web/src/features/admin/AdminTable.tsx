import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
export function AdminTable({
  columns,
  rows,
  empty,
}: {
  columns: {
    key: string;
    label: string;
    render: (row: Record<string, unknown>) => ReactNode;
  }[];
  rows: Record<string, unknown>[];
  empty: string;
}) {
  return rows.length ? (
    <table className="admin-table">
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={String(row.id)}>
            {columns.map((column) => (
              <td key={column.key} data-label={column.label}>
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ) : (
    <p className="admin-empty">{empty}</p>
  );
}
export function AdminPagination({
  page,
  total,
  limit = 25,
  onPage,
  ar,
}: {
  page: number;
  total: number;
  limit?: number;
  onPage: (page: number) => void;
  ar: boolean;
}) {
  return (
    <nav
      className="mt-5 flex items-center justify-between gap-3"
      aria-label={ar ? "الصفحات" : "Pagination"}
    >
      <Button
        variant="outline"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        {ar ? "السابق" : "Previous"}
      </Button>
      <span className="text-sm text-muted-foreground">
        {ar
          ? `الصفحة ${page} من ${Math.max(1, Math.ceil(total / limit))}`
          : `Page ${page} of ${Math.max(1, Math.ceil(total / limit))}`}
      </span>
      <Button
        variant="outline"
        disabled={page * limit >= total}
        onClick={() => onPage(page + 1)}
      >
        {ar ? "التالي" : "Next"}
      </Button>
    </nav>
  );
}
