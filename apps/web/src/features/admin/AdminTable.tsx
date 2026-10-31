import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { AdminEmpty } from "./AdminChrome";

export type AdminColumn<Row> = {
  key: string;
  label: string;
  render: (row: Row) => ReactNode;
  align?: "start" | "end";
  width?: string;
};
type Meta = { align?: "start" | "end"; width?: string; label: string };

export function AdminTable<Row extends Record<string, unknown>>({ columns, rows, empty, emptyHint, rowHref, rowLabel, caption }: {
  columns: AdminColumn<Row>[];
  rows: Row[];
  empty: string;
  emptyHint?: string;
  /** Makes the whole row open this path; nested links and buttons keep working. */
  rowHref?: (row: Row) => string | undefined;
  rowLabel?: (row: Row) => string;
  caption?: string;
}) {
  const definitions = useMemo<ColumnDef<Row>[]>(() => columns.map(column => ({
    id: column.key,
    header: column.label,
    cell: ({ row }) => column.render(row.original),
    meta: { align: column.align, width: column.width, label: column.label } satisfies Meta,
  })), [columns]);
  const table = useReactTable({
    data: rows,
    columns: definitions,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => String(row.id ?? index),
  });
  if (!rows.length) return <AdminEmpty title={empty} hint={emptyHint} />;
  return <div className="admin-table-frame">
    <table className="admin-table">
      {caption && <caption className="sr-only">{caption}</caption>}
      <thead>
        {table.getHeaderGroups().map(group => <tr key={group.id}>
          {group.headers.map(header => {
            const meta = header.column.columnDef.meta as Meta;
            return <th key={header.id} scope="col" data-align={meta.align} style={meta.width ? { width: meta.width } : undefined}>
              {flexRender(header.column.columnDef.header, header.getContext())}
            </th>;
          })}
        </tr>)}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => {
          const href = rowHref?.(row.original);
          return <tr key={row.id} data-href={href ? "" : undefined}>
            {row.getVisibleCells().map((cell, index) => {
              const meta = cell.column.columnDef.meta as Meta;
              return <td key={cell.id} data-label={meta.label} data-align={meta.align}>
                {index === 0 && href && <Link className="admin-row-link" to={href} aria-label={rowLabel?.(row.original) ?? meta.label} />}
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>;
            })}
          </tr>;
        })}
      </tbody>
    </table>
  </div>;
}

export function AdminPagination({ page, total, limit = 25, onPage, ar, totalCapped = false }: {
  page: number; total: number; limit?: number; onPage: (page: number) => void; ar: boolean; totalCapped?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const first = total ? (page - 1) * limit + 1 : 0;
  const last = Math.min(total, page * limit);
  const count = `${total.toLocaleString()}${totalCapped ? "+" : ""}`;
  return <nav className="admin-pagination" aria-label={ar ? "الصفحات" : "Pagination"}>
    <p>{ar ? `${first}–${last} من ${count}` : `${first}–${last} of ${count}`}</p>
    <div>
      <Button variant="outline" size="icon" aria-label={ar ? "الصفحة السابقة" : "Previous page"} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></Button>
      <span>{ar ? `صفحة ${page} من ${pages}` : `Page ${page} of ${pages}${totalCapped ? "+" : ""}`}</span>
      <Button variant="outline" size="icon" aria-label={ar ? "الصفحة التالية" : "Next page"} disabled={page * limit >= total} onClick={() => onPage(page + 1)}><ChevronRight className="h-4 w-4 rtl:rotate-180" /></Button>
    </div>
  </nav>;
}
