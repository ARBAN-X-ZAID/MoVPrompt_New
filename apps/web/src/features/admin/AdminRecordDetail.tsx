import { BusinessRenderRequest } from "./BusinessRenderRequest";
import { EmailDeliveryPanel } from "./EmailDeliveryPanel";
import { SupportReply, SupportAttachments } from "./SupportReply";
import { ContentEditor } from "./ContentEditor";
import { OwnedMediaImport } from "./OwnedMediaImport";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download } from "lucide-react";
import type { AdminResource } from "@movprompt/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { apiOrigin } from "@/lib/api/portableApiClient";
import { adminApi } from "./api";
import { object, type RecordData } from "./adminData";
import { DataValue, ErrorState, Loading } from "./AdminDisplay";
import { useAdminActions } from "./useAdminActions";
import { AdminForm } from "./AdminForm";
import { TemplateEditor } from "./TemplateEditor";
import { adminSections, adminEnum } from "./labels";
export default function AdminRecordDetail({
  resource,
  id,
}: {
  resource: AdminResource;
  id: string;
}) {
  const { locale } = useLanguage();
  const ar = locale === "ar";
  const query = useQuery({
    queryKey: ["admin", resource, id],
    queryFn: () => adminApi.get(`${resource}/${id}`),
  });
  const { form, setForm, run, notice } = useAdminActions();
  const [media, setMedia] = useState<{ url: string; video: boolean } | null>(
    null,
  );
  const [mediaError, setMediaError] = useState(false);
  const [supportReply, setSupportReply] = useState(false);
  useEffect(() => setMediaError(false), [media?.url]);
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  const row = object(query.data.record);
  const related = object(query.data.related);
  const userId = resource === "customers" ? id : String(row.userId ?? "");
  return (
    <>
      <Link
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        to={`/admin/${resource}`}
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {ar ? "العودة إلى السجلات" : "Back to records"}
      </Link>
      {notice && (
        <p
          role="status"
          className="mb-5 rounded-lg border bg-muted/30 p-3 text-sm"
        >
          {notice}
        </p>
      )}
      {["assets", "owned-media"].includes(resource) &&
        Array.isArray(related.revisions) && (
          <section className="admin-panel mb-6 space-y-3">
            <h2 className="font-semibold">
              {ar ? "مراجعة نسخ الوسائط" : "Media revision review"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {ar
                ? "تحتاج معاينة النسخ السابقة إلى تأكيد هوية حديث وتسجل في سجل الوصول. لا تجدد الإذن للاستخدام في حملة."
                : "Historical previews require recent authentication and are access-logged. Reviewing a photo does not renew campaign permission."}
            </p>
            <div className="flex flex-wrap gap-2">
              {related.revisions.map(object).flatMap((revision) => {
                const photos =
                  resource === "assets"
                    ? object(revision.value).photos
                    : [
                        {
                          id: undefined,
                          name: revision.name,
                          mimeType: revision.mimeType,
                        },
                      ];
                return (Array.isArray(photos) ? photos : [])
                  .map(object)
                  .map((photo, index) => (
                    <Button
                      key={`${revision.revision}/${photo.id ?? index}`}
                      variant="outline"
                      onClick={() =>
                        setMedia({
                          url: adminApi.media(
                            resource === "assets" ? "asset" : "owned",
                            id,
                            typeof photo.id === "string" ? photo.id : undefined,
                            false,
                            true,
                            Number(revision.revision),
                          ),
                          video: photo.mimeType === "video/mp4",
                        })
                      }
                    >
                      v{String(revision.revision)} ·{" "}
                      {String(photo.name ?? (ar ? "وسائط" : "Media"))}
                    </Button>
                  ));
              })}
            </div>
          </section>
        )}
      {resource === "content" && String(row.kind).endsWith("email") && (
        <EmailDeliveryPanel id={id} content={row} ar={ar} />
      )}
      {resource === "support" && (
        <section className="admin-panel mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">
              {ar ? "الرسائل والمرفقات" : "Messages and attachments"}
            </h2>
            <Button onClick={() => setSupportReply(true)}>
              {ar ? "إضافة رد أو ملاحظة" : "Add reply or note"}
            </Button>
          </div>
          {(Array.isArray(related.messages) ? related.messages : [])
            .map(object)
            .map((message) => (
              <article key={String(message.id)} className="rounded border p-4">
                <p className="mb-2 text-xs text-muted-foreground">
                  {message.visibility === "private"
                    ? ar
                      ? "خاص بالمالك"
                      : "Private owner note"
                    : ar
                      ? "مرئي للعميل"
                      : "Customer-visible"}{" "}
                  · {adminEnum(String(message.delivery ?? ""), "delivery", ar)}
                </p>
                {message.emailStatus && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    {ar ? "إشعار البريد" : "Email notification"} ·{" "}
                    {adminEnum(String(message.emailStatus), "emailStatus", ar)}
                    {message.emailStatus === "smtp-accepted" &&
                      (ar
                        ? " · قبله خادم البريد، لم يتم تأكيد وصوله أو قراءته"
                        : " · accepted by the mail server; delivery and reading are unconfirmed")}
                  </p>
                )}
                <p className="whitespace-pre-wrap text-sm" dir="auto">
                  {String(message.message ?? "")}
                </p>
                <SupportAttachments
                  attachments={message.attachments}
                  caseId={id}
                  admin
                  ar={ar}
                />
              </article>
            ))}
        </section>
      )}
      {supportReply && resource === "support" && (
        <SupportReply
          caseId={id}
          revision={Number(row.revision)}
          admin
          ar={ar}
          onClose={() => setSupportReply(false)}
        />
      )}
      <div className="mb-6 flex flex-wrap gap-2">
        {userId && resource !== "customers" && (
          <Button asChild variant="outline">
            <Link to={`/admin/customers/${userId}`}>
              {ar ? "فتح العميل" : "Open customer"}
            </Link>
          </Button>
        )}
        {(
          [
            [row.projectId, "campaigns", ar ? "فتح الحملة" : "Open campaign"],
            [row.runId, "generations", ar ? "فتح التوليد" : "Open generation"],
            [row.assetId, "assets", ar ? "فتح الأصل" : "Open asset"],
            [
              row.orderId ?? row.paymentId,
              "payments",
              ar ? "فتح الدفع" : "Open payment",
            ],
          ] as const
        )
          .filter(([target]) => typeof target === "string" && target)
          .map(([target, path, label]) => (
            <Button asChild variant="outline" key={path}>
              <Link to={`/admin/${path}/${target}`}>{label}</Link>
            </Button>
          ))}
        {resource === "customers" && (
          <>
            <Button
              variant="outline"
              onClick={() =>
                run(
                  ar ? "تعديل ملف العميل" : "Update customer profile",
                  `customers/${id}/actions`,
                  [
                    {
                      name: "name",
                      label: ar ? "الاسم" : "Name",
                      value: String(row.name ?? ""),
                      required: true,
                    },
                    {
                      name: "locale",
                      label: ar ? "اللغة" : "Language",
                      type: "select",
                      options: [
                        { value: "en", label: "English" },
                        { value: "ar", label: "العربية" },
                      ],
                      value: String(row.locale ?? "en"),
                    },
                  ],
                  { action: "profile" },
                )
              }
            >
              {ar ? "تعديل الملف" : "Edit profile"}
            </Button>
            {(
              [
                ["revoke-sessions", "Revoke sessions", "إنهاء الجلسات"],
                [
                  row.suspendedAt ? "restore" : "suspend",
                  row.suspendedAt ? "Restore account" : "Suspend account",
                  row.suspendedAt ? "استعادة الحساب" : "إيقاف الحساب",
                ],
                [
                  "password-reset",
                  "Send password reset",
                  "إرسال إعادة تعيين كلمة المرور",
                ],
                [
                  "verify-email",
                  "Send verification email",
                  "إرسال توثيق البريد",
                ],
                ["export", "Export customer data", "تصدير بيانات العميل"],
                [
                  "reconcile-credits",
                  "Reconcile credit allocations",
                  "تسوية توزيع الرصيد",
                ],
                [
                  "delete-request",
                  "Request account deletion",
                  "طلب حذف الحساب",
                ],
              ] as const
            ).map(([action, en, arabic]) => (
              <Button
                key={action}
                variant="outline"
                onClick={() =>
                  run(ar ? arabic : en, `customers/${id}/actions`, [], {
                    action,
                  })
                }
              >
                {ar ? arabic : en}
              </Button>
            ))}
          </>
        )}
        {resource === "business-renders" && (
          <>
            {(
              [
                ["approve", "Approve business budget", "اعتماد ميزانية الشركة"],
                ["reject", "Reject request", "رفض الطلب"],
                ["retry-preparation", "Retry preparation", "إعادة التحضير"],
              ] as const
            )
              .filter(([action]) =>
                action === "approve"
                  ? row.status === "ready"
                  : ["preparing", "ready"].includes(String(row.status)),
              )
              .map(([action, en, arabic]) => (
                <Button
                  key={action}
                  variant="outline"
                  onClick={() =>
                    run(
                      ar ? arabic : en,
                      `business-renders/${id}/review`,
                      [],
                      {
                        action,
                        expectedRevision: row.revision,
                        ...(action === "approve"
                          ? { expectedCostMicrousd: row.worstCaseMicrousd }
                          : {}),
                      },
                      ar
                        ? "السقف التقديري يشمل محاولات الجودة. لا يخصم رصيد العميل ولا يغير الفيديو المعتمد. تبقى تكاليف المزود الفعلية منفصلة."
                        : "The estimated ceiling includes quality retries. Customer credits and accepted videos remain unchanged. Actual provider spending is recorded separately.",
                    )
                  }
                >
                  {ar ? arabic : en}
                </Button>
              ))}
            {typeof row.previewMediaId === "string" && (
              <Button asChild variant="outline">
                <Link to={`/admin/owned-media/${row.previewMediaId}`}>
                  {ar ? "مراجعة وسائط المعاينة" : "Review preview media"}
                </Link>
              </Button>
            )}
          </>
        )}
        {resource === "generations" && (
          <>
            {["failed", "cancelled", "completed"].includes(
              String(row.status),
            ) &&
              typeof row.projectVersionId === "string" && (
                <BusinessRenderRequest
                  sourceVersionId={row.projectVersionId}
                  originalRunId={id}
                  ar={ar}
                />
              )}
            {(
              [
                ["reconcile", "Recheck provider", "إعادة فحص المزود"],
                ["cancel", "Request cancellation", "طلب الإلغاء"],
                ["recover", "Recover existing output", "استعادة الناتج الحالي"],
              ] as const
            ).map(([action, en, arabic]) => (
              <Button
                key={action}
                variant="outline"
                onClick={() =>
                  run(
                    ar ? arabic : en,
                    `generations/${id}/actions`,
                    [],
                    { action },
                    action === "cancel"
                      ? ar
                        ? "قد يستمر المزود في المعالجة وتبقى تكلفته قائمة حتى بعد طلب الإلغاء."
                        : "The provider may continue processing and incur cost after cancellation is requested."
                      : undefined,
                  )
                }
              >
                {ar ? arabic : en}
              </Button>
            ))}
            {row.status === "completed" && (
              <Button
                onClick={() =>
                  setMedia({
                    url: adminApi.media("generation", id),
                    video: true,
                  })
                }
              >
                {ar ? "مشاهدة الفيديو" : "Inspect video"}
              </Button>
            )}
          </>
        )}
        {resource === "content" && (
          <ContentEditor key={String(row.revision)} id={id} initial={row} />
        )}
        {resource === "owned-media" && (
          <>
            {!row.deletedAt && <OwnedMediaImport id={id} current={row} />}
            {row.verifiedAt && (
              <Button
                variant="outline"
                onClick={() =>
                  setMedia({
                    url: adminApi.media(
                      "owned",
                      id,
                      undefined,
                      false,
                      Boolean(row.deletedAt),
                    ),
                    video: row.mimeType === "video/mp4",
                  })
                }
              >
                {ar ? "معاينة النسخة الخاصة" : "Inspect private copy"}
              </Button>
            )}
            {(
              [
                ...(["needs-review"].includes(String(row.status))
                  ? [["approve", "Approve this revision", "اعتماد هذه النسخة"]]
                  : []),
                ...(row.status === "approved"
                  ? [["withdraw-approval", "Withdraw approval", "سحب الاعتماد"]]
                  : []),
                ...(row.deletedAt
                  ? [["restore", "Restore for review", "استعادة للمراجعة"]]
                  : [
                      [
                        "trash",
                        "Move to 30-day trash",
                        "نقل إلى المهملات لمدة ٣٠ يوماً",
                      ],
                    ]),
                ...(row.status === "copying" &&
                object(related.operation).status === "failed"
                  ? [
                      [
                        "retry-copy",
                        "Retry failed copy",
                        "إعادة محاولة النسخ الفاشل",
                      ],
                    ]
                  : []),
              ] as string[][]
            ).map(([action, en, arabic]) => (
              <Button
                key={action}
                variant="outline"
                onClick={() =>
                  run(ar ? arabic! : en!, `owned-media/${id}/actions`, [], {
                    action,
                    expectedRevision: row.revision,
                    expectedStateRevision: row.stateRevision,
                  })
                }
              >
                {ar ? arabic : en}
              </Button>
            ))}
          </>
        )}
        {resource === "assets" &&
          (
            [
              ["withdraw-permission", "Withdraw permission", "سحب الإذن"],
              ["quarantine", "Quarantine", "عزل"],
              [
                "release-quarantine",
                "Release quarantine for customer review",
                "إنهاء العزل لمراجعة العميل",
              ],
              [
                "trash",
                "Move to 30-day trash",
                "نقل إلى المحذوفات لمدة ٣٠ يوماً",
              ],
              ["restore", "Restore from trash", "استعادة من المحذوفات"],
            ] as const
          ).map(([action, en, arabic]) => (
            <Button
              key={action}
              variant="outline"
              onClick={() =>
                run(ar ? arabic : en, `assets/${id}/actions`, [], {
                  action,
                  expectedRevision: object(row.value).revision,
                })
              }
            >
              {ar ? arabic : en}
            </Button>
          ))}
        {resource === "moderation" && row.status === "open" && (
          <>
            {(
              [
                ["dismiss", "Dismiss review", "رفض البلاغ"],
                [
                  "quarantine-asset",
                  "Quarantine linked asset",
                  "عزل الأصل المرتبط",
                ],
                [
                  "withdraw-permission",
                  "Withdraw asset permission",
                  "سحب إذن الأصل",
                ],
                ["suspend-account", "Suspend account", "تعليق الحساب"],
                [
                  "request-cancellation",
                  "Request generation cancellation",
                  "طلب إلغاء التوليد",
                ],
              ] as const
            ).map(([action, en, arabic]) => (
              <Button
                key={action}
                variant="outline"
                onClick={() =>
                  run(
                    ar ? arabic : en,
                    `moderation/${id}/decision`,
                    [
                      ...(["quarantine-asset", "withdraw-permission"].includes(
                        action,
                      )
                        ? [
                            {
                              name: "assetRevision",
                              label: ar
                                ? "مراجعة الأصل الحالية"
                                : "Current asset revision",
                              type: "number" as const,
                              min: 1,
                              required: true,
                            },
                          ]
                        : []),
                      ...(action === "request-cancellation"
                        ? [
                            {
                              name: "runId",
                              label: ar
                                ? "معرّف التوليد المرتبط"
                                : "Related generation ID",
                              required: true,
                            },
                          ]
                        : []),
                    ],
                    { action, expectedRevision: row.revision },
                    ar
                      ? "لا يتجاوز القرار موافقة الشخصية أو المراجعة القانونية. طلب الإلغاء ليس تأكيداً لإنهاء عملية المزود."
                      : "This does not bypass presenter consent or external clinic review. A cancellation request does not confirm provider termination.",
                  )
                }
              >
                {ar ? arabic : en}
              </Button>
            ))}
          </>
        )}
        {resource === "templates" &&
          (
            [
              ["unpublish", "Unpublish", "إلغاء النشر"],
              ["archive", "Archive", "أرشفة"],
              [
                "restore-publication",
                "Restore current publication",
                "استعادة النشر الحالي",
              ],
            ] as const
          ).map(([action, en, arabic]) => (
            <Button
              key={action}
              variant="outline"
              onClick={() =>
                run(ar ? arabic : en, `templates/${id}/state`, [], {
                  action,
                  expectedRevision: row.revision ?? 0,
                })
              }
            >
              {ar ? arabic : en}
            </Button>
          ))}
        {resource === "financial-requests" && row.status === "requested" && (
          <>
            {(
              [
                [
                  "approve",
                  "Approve reviewed impact",
                  "الموافقة على الأثر المُراجع",
                ],
                ["reject", "Reject request", "رفض الطلب"],
              ] as const
            ).map(([decision, en, arabic]) => (
              <Button
                key={decision}
                variant={decision === "approve" ? "default" : "outline"}
                onClick={() =>
                  run(
                    ar ? arabic : en,
                    `finance/requests/${id}/review`,
                    [],
                    { expectedRevision: row.revision, decision },
                    `${ar ? "الرصيد" : "Balance"}: ${object(row.impact).balance ?? "—"} · ${ar ? "المتاح" : "Available"}: ${object(row.impact).available ?? "—"} · ${ar ? "بعد الإجراء" : "After"}: ${object(row.impact).balanceAfter ?? "—"} · ${ar ? "تغيير الرصيد" : "Credit change"}: ${row.delta ?? 0}`,
                  )
                }
              >
                {ar ? arabic : en}
              </Button>
            ))}
          </>
        )}
        {resource === "reports" &&
          ["report.export", "customer.export"].includes(String(row.kind)) &&
          row.status === "completed" && (
            <Button asChild variant="outline">
              <a
                href={`${apiOrigin()}/api/v1/admin/exports/${id}/file`}
                download
              >
                <Download className="me-2 h-4 w-4" />
                {ar ? "تنزيل التصدير الخاص" : "Download private export"}
              </a>
            </Button>
          )}
        {resource === "reports" &&
          row.kind === "customer.delete-request" &&
          !["cancelled", "erased"].includes(String(row.status)) && (
            <>
              {row.status === "review-required" && (
                <Button
                  variant="destructive"
                  onClick={() =>
                    run(
                      ar
                        ? "اعتماد محو الحساب بعد فترة الاستعادة"
                        : "Approve account erasure after recovery grace",
                      `privacy/${id}/review`,
                      [
                        {
                          name: "confirmCustomerId",
                          label: ar
                            ? "اكتب معرّف العميل للتأكيد"
                            : "Type customer ID to confirm",
                          required: true,
                        },
                        {
                          name: "manifestHash",
                          label: ar
                            ? "بصمة القائمة التي تمت مراجعتها"
                            : "Reviewed manifest hash",
                          value: String(
                            object(row.manifest).manifestHash ?? "",
                          ),
                          required: true,
                        },
                        {
                          name: "policyVersion",
                          label: ar
                            ? "نسخة سياسة الاحتفاظ المعتمدة"
                            : "Approved retention policy version",
                          value: String(
                            object(row.manifest).policyVersion ?? "",
                          ),
                          required: true,
                        },
                      ],
                      {
                        action: "approve-erasure",
                        expectedRevision: Number(row.privacyRevision ?? 0),
                      },
                      ar
                        ? "هذا الإجراء لا يمكن التراجع عنه بعد التنفيذ. يتطلب سياسة معتمدة وفترة استعادة لا تقل عن ٣٠ يوماً، ورصيداً صفراً، وعدم وجود عمليات أو نزاعات معلقة. تحفظ السجلات المالية وسجل التدقيق وفق السياسة."
                        : "Erasure is irreversible after execution. It requires an approved policy, at least 30 days of recovery grace, a zero wallet and no outstanding operations or disputes. Financial and audit records remain retained under policy.",
                    )
                  }
                >
                  {ar ? "مراجعة المحو الدائم" : "Review permanent erasure"}
                </Button>
              )}

              {(
                [
                  [
                    "refresh-manifest",
                    "Refresh deletion inventory",
                    "تحديث قائمة الحذف",
                  ],
                  [
                    "cancel-request",
                    "Cancel deletion request",
                    "إلغاء طلب الحذف",
                  ],
                ] as const
              ).map(([action, en, arabic]) => (
                <Button
                  key={action}
                  variant="outline"
                  onClick={() =>
                    run(
                      ar ? arabic : en,
                      `privacy/${id}/review`,
                      [],
                      {
                        action,
                        expectedRevision: Number(row.privacyRevision ?? 0),
                      },
                      ar
                        ? "لا يتم حذف أي ملفات بشكل دائم. تبقى سياسات الاحتفاظ والعمليات النشطة قيد المراجعة."
                        : "No files are permanently erased. Retention policy and active operations remain subject to review.",
                    )
                  }
                >
                  {ar ? arabic : en}
                </Button>
              ))}
            </>
          )}
        {resource === "support" && (
          <Button
            onClick={() =>
              run(
                ar ? "تحديث حالة الدعم" : "Update support case",
                `support/${id}`,
                [
                  {
                    name: "status",
                    label: ar ? "الحالة" : "Status",
                    type: "select",
                    value: String(row.status),
                    options: [
                      "open",
                      "in-progress",
                      "waiting-customer",
                      "resolved",
                      "closed",
                    ].map((value) => ({ value, label: value })),
                  },
                  {
                    name: "priority",
                    label: ar ? "الأولوية" : "Priority",
                    type: "select",
                    value: String(row.priority),
                    options: ["low", "normal", "high", "urgent"].map(
                      (value) => ({ value, label: value }),
                    ),
                  },
                  {
                    name: "message",
                    label: ar ? "الرسالة أو الملاحظة" : "Reply or note",
                    type: "textarea",
                  },
                  {
                    name: "visibility",
                    label: ar ? "ظهور الرسالة" : "Message visibility",
                    type: "select",
                    value: "private",
                    options: [
                      {
                        value: "private",
                        label: ar
                          ? "ملاحظة خاصة بالمالك"
                          : "Private owner note",
                      },
                      {
                        value: "customer",
                        label: ar ? "رد ظاهر للعميل" : "Customer-visible reply",
                      },
                    ],
                  },
                ],
                { expectedRevision: row.revision },
              )
            }
          >
            {ar ? "رد أو تحديث" : "Reply or update"}
          </Button>
        )}
      </div>
      {resource === "customers" && (
        <nav
          aria-label={ar ? "سجلات العميل" : "Customer records"}
          className="mb-8 flex flex-wrap gap-2"
        >
          {(
            [
              "campaigns",
              "generations",
              "assets",
              "payments",
              "credits",
              "support",
            ] as const
          ).map((target) => (
            <Link
              className="admin-tab"
              key={target}
              to={`/admin/${target}?userId=${id}`}
            >
              {
                adminSections.find((section) => section.id === target)?.[
                  ar ? "ar" : "en"
                ]
              }
            </Link>
          ))}
        </nav>
      )}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="admin-panel min-w-0">
          <h2 className="mb-6 font-medium">
            {ar ? "تفاصيل السجل" : "Record details"}
          </h2>
          <DataValue value={row} ar={ar} />
        </section>
        <section className="admin-panel min-w-0">
          <h2 className="mb-6 font-medium">
            {ar ? "السجلات المرتبطة" : "Connected records"}
          </h2>
          <DataValue value={related} ar={ar} />
        </section>
      </div>
      {resource === "assets" &&
        Array.isArray(object(related.references).items) && (
          <section className="admin-panel mt-6">
            <h2 className="font-semibold">
              {ar ? "الحملات المرتبطة ونسخها" : "Linked campaigns and versions"}
            </h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {ar
                ? "تُحدّث المراجع القابلة للتعديل بعد المراجعة. تبقى النسخ المعتمدة والعمليات النشطة محفوظة."
                : "Editable references update through review. Accepted versions and active generation snapshots remain intact."}
            </p>
            <div className="mt-4 space-y-3">
              {(object(related.references).items as RecordData[]).map(
                (item) => (
                  <article
                    key={String(item.versionId)}
                    className="rounded-lg border p-4 text-sm"
                  >
                    <Link
                      className="font-medium text-primary underline"
                      to={`/admin/campaigns/${item.projectId}`}
                    >
                      {String(item.title ?? item.projectId)}
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span>v{String(item.versionNumber ?? "—")}</span>
                      {Boolean(item.working) && (
                        <span className="admin-status">
                          {ar ? "نسخة العمل" : "Working version"}
                        </span>
                      )}
                      {Boolean(item.accepted) && (
                        <span className="admin-status">
                          {ar ? "نسخة معتمدة" : "Accepted version"}
                        </span>
                      )}
                      {Boolean(item.projectInTrash) && (
                        <span className="admin-status">
                          {ar ? "الحملة في المهملات" : "Campaign in trash"}
                        </span>
                      )}
                    </div>
                    {Array.isArray(item.activeRuns) &&
                      item.activeRuns.map((value) => {
                        const active = object(value);
                        return (
                          <Link
                            key={String(active.runId)}
                            className="mt-2 block text-xs text-primary underline"
                            to={`/admin/generations/${active.runId}`}
                          >
                            {ar
                              ? "فتح التوليد النشط"
                              : "Open active generation"}
                          </Link>
                        );
                      })}
                  </article>
                ),
              )}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {ar ? "إجمالي النسخ المرتبطة" : "Total linked versions"}:{" "}
              {String(object(related.references).total ?? 0)}
              {Boolean(object(related.references).truncated) &&
                (ar ? " · عرض أحدث ١٠٠ فقط" : " · Showing latest 100 only")}
            </p>
          </section>
        )}
      {resource === "assets" && Array.isArray(object(row.value).photos) && (
        <section className="admin-panel mt-6">
          <h2 className="mb-4 font-medium">
            {ar ? "صور خاصة" : "Private photos"}
          </h2>
          <div className="flex flex-wrap gap-3">
            {(object(row.value).photos as RecordData[]).map((photo) => (
              <Button
                key={String(photo.id)}
                variant="outline"
                onClick={() =>
                  setMedia({
                    url: adminApi.media(
                      "asset",
                      id,
                      String(photo.id),
                      false,
                      Boolean(row.deleted || row.quarantinedAt),
                    ),
                    video: false,
                  })
                }
              >
                {ar ? "عرض الصورة" : "Inspect photo"} ·{" "}
                {String(photo.name ?? photo.id)}
              </Button>
            ))}
          </div>
        </section>
      )}
      {resource === "templates" && <TemplateEditor id={id} />}
      {resource === "campaigns" && Array.isArray(related.media) && (
        <section className="admin-panel mt-6">
          <h2 className="mb-4 font-medium">
            {ar ? "مراجع الحملة الخاصة" : "Private campaign references"}
          </h2>
          <div className="flex flex-wrap gap-3">
            {(related.media as RecordData[]).map((photo) => (
              <Button
                key={String(photo.id)}
                variant="outline"
                onClick={() =>
                  setMedia({
                    url: adminApi.media("campaign", String(photo.id)),
                    video: String(photo.mimeType).startsWith("video/"),
                  })
                }
              >
                {ar ? "عرض" : "Inspect"} · {String(photo.kind ?? "photo")}
              </Button>
            ))}
          </div>
        </section>
      )}
      {form && (
        <AdminForm
          title={form.title}
          description={form.description}
          fields={form.fields}
          onSubmit={form.submit}
          onClose={() => setForm(null)}
        />
      )}
      {media && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setMedia(null);
          }}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {ar ? "فحص وسائط خاصة" : "Private media inspection"}
              </DialogTitle>
              <DialogDescription>
                {ar
                  ? "يُسجل هذا الوصول في سجل التدقيق"
                  : "This access is recorded in the audit history"}
              </DialogDescription>
            </DialogHeader>
            {mediaError ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive"
              >
                {ar
                  ? "تعذر تحميل الوسائط الخاصة. قد تكون غير متاحة أو تغير إذن الوصول إليها."
                  : "This private media could not be loaded. It may be unavailable or its access permission may have changed."}
              </p>
            ) : media.video ? (
              <video
                src={media.url}
                controls
                playsInline
                preload="metadata"
                onError={() => setMediaError(true)}
                className="max-h-[65vh] w-full rounded-lg"
              />
            ) : (
              <img
                src={media.url}
                onError={() => setMediaError(true)}
                alt={ar ? "مرجع العميل الخاص" : "Private customer reference"}
                className="max-h-[65vh] w-full rounded-lg object-contain"
              />
            )}
            <Button asChild variant="outline">
              <a
                href={media.url.replace("download=false", "download=true")}
                download
              >
                <Download className="me-2 h-4 w-4" />
                {ar ? "تنزيل" : "Download"}
              </a>
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
