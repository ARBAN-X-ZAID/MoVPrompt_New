import type { Db, Document } from "mongodb";
import { ObjectId } from "mongodb";
import { COLLECTIONS as C } from "@movprompt/db";
const ids = (rows: Document[], key: string) => [...new Set(rows.map(row => String(row[key] ?? "")).filter(value => /^[a-f\d]{24}$/i.test(value)))].map(value => new ObjectId(value));
/** Only presentation labels are added. Relationship identifiers remain internal routing data. */
export async function addAdminRecordLabels(db: Db, rows: Document[]) {
  const [users, projects] = await Promise.all([
    db.collection("users").find({ _id: { $in: ids(rows, "userId") } }, { projection: { name: 1, email: 1 } }).toArray(),
    db.collection(C.creatorProjects).find({ _id: { $in: ids(rows, "projectId") } }, { projection: { title: 1 } }).toArray(),
  ]);
  const userMap = new Map(users.map(row => [String(row._id), row]));
  const projectMap = new Map(projects.map(row => [String(row._id), row]));
  for (const row of rows) {
    if (row.userId) {
      const user = userMap.get(String(row.userId));
      row.customerName = user?.name ?? { en: "Customer unavailable", ar: "العميل غير متاح" };
      row.customerEmail = user?.email ?? "";
    }
    if (row.projectId) row.campaignTitle = projectMap.get(String(row.projectId))?.title ?? { en: "Untitled campaign", ar: "حملة بدون عنوان" };
  }
}
