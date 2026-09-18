import { describe, expect, it } from "vitest";

import { ar } from "@/i18n/translations/ar";
import { en } from "@/i18n/translations/en";

const requiredCopy = {
  "auth.gateTitle": {
    en: "Your campaign is ready to create",
    ar: "حملتك جاهزة للإنشاء",
  },
  "auth.gateDescription": {
    en: "Create an account to start the render. Your product, template, and campaign settings will return exactly as you left them in this browser.",
    ar: "أنشئ حساباً لبدء التوليد. سيعود منتجك والقالب وإعدادات حملتك كما تركتها تماماً في هذا المتصفح.",
  },
  "auth.gatePriceNote": {
    en: "Your campaign stays saved while you sign in. Cancel to keep editing.",
    ar: "تبقى حملتك محفوظة أثناء تسجيل الدخول. أغلق النافذة لمتابعة التعديل.",
  },
  "auth.continueEmail": { en: "Continue with email", ar: "المتابعة بالبريد الإلكتروني" },
  "auth.signIn": { en: "Sign in", ar: "تسجيل الدخول" },
  "auth.createAccount": { en: "Create account", ar: "إنشاء حساب" },
  "auth.resetEmailDesc": {
    en: "If an account exists, we sent a secure reset link.",
    ar: "إذا كان الحساب موجوداً، أرسلنا رابطاً آمناً لإعادة التعيين.",
  },
  "auth.draftStillSaved": { en: "Your campaign is saved in this browser.", ar: "حملتك محفوظة في هذا المتصفح." },
  "auth.cancelled": {
    en: "Nothing changed. Continue editing when you’re ready.",
    ar: "لم يتغيّر شيء. تابع التعديل عندما تكون جاهزاً.",
  },
  "auth.callbackLoadingTitle": { en: "Restoring your campaign", ar: "جارٍ استعادة حملتك" },
  "auth.callbackLoadingDescription": { en: "Keep this page open for a moment.", ar: "أبقِ هذه الصفحة مفتوحة للحظة." },
  "creator.claim.heading": { en: "Securing your campaign…", ar: "جارٍ تأمين حملتك…" },
  "creator.claim.detail": {
    en: "Saving your campaign and images privately. Keep this page open.",
    ar: "جارٍ حفظ حملتك وصورك بشكل خاص. أبقِ هذه الصفحة مفتوحة.",
  },
  "creator.claim.success": {
    en: "Your campaign is secured. Checking the saved details now.",
    ar: "تم تأمين حملتك. جارٍ التحقق من التفاصيل المحفوظة الآن.",
  },
  "creator.claim.stage.create": { en: "Creating your private campaign", ar: "جارٍ إنشاء حملتك الخاصة" },
  "creator.claim.stage.asset": { en: "Securing image {current} of {total}", ar: "جارٍ تأمين الصورة {current} من {total}" },
  "creator.claim.stage.verify": { en: "Checking saved campaign details", ar: "جارٍ التحقق من تفاصيل الحملة المحفوظة" },
  "creator.recovery.claimFailed": {
    en: "We couldn’t secure this image. Your campaign is still saved here.",
    ar: "لم نتمكن من تأمين هذه الصورة. حملتك ما زالت محفوظة هنا.",
  },
  "creator.recovery.projectClaimFailed": {
    en: "We couldn’t save this campaign to your account. It is still saved in this browser. Try again.",
    ar: "لم نتمكن من حفظ هذه الحملة في حسابك. ما زالت محفوظة في هذا المتصفح. حاول مرة أخرى.",
  },
  "creator.recovery.retryAsset": { en: "Retry securing image", ar: "أعد تأمين الصورة" },
  "creator.recovery.replaceImage": { en: "Replace image", ar: "استبدل الصورة" },
  "creator.recovery.offline": {
    en: "You’re offline. Your campaign is still saved in this browser. Reconnect, then try again.",
    ar: "أنت غير متصل بالإنترنت. حملتك ما زالت محفوظة في هذا المتصفح. اتصل بالإنترنت ثم حاول مرة أخرى.",
  },
  "creator.recovery.sessionMismatch": {
    en: "This campaign belongs to a different signed-in account. We kept it private and did not change it.",
    ar: "هذه الحملة تخص حساباً مسجلاً آخر. أبقيناها خاصة ولم نغيّرها.",
  },
  "creator.recovery.continueEditing": { en: "Continue editing", ar: "تابع التعديل" },
  "creator.recovery.signOut": { en: "Sign out and use another account", ar: "سجّل الخروج واستخدم حساباً آخر" },
  "creator.recovery.expired": {
    en: "This browser draft expired after 7 days. Start a new campaign.",
    ar: "انتهت صلاحية مسودة هذا المتصفح بعد ٧ أيام. ابدأ حملة جديدة.",
  },
  "creator.recovery.startNew": { en: "Start a new campaign", ar: "ابدأ حملة جديدة" },
  "creator.recovery.replay": {
    en: "Your campaign is already secured. Opening it now.",
    ar: "حملتك مؤمّنة بالفعل. جارٍ فتحها الآن.",
  },
  "auth.verificationLaterNotice": {
    en: "Verify your email to protect your account. You can do this later in Account settings.",
    ar: "أكّد بريدك الإلكتروني لحماية حسابك. يمكنك القيام بذلك لاحقاً من إعدادات الحساب.",
  },
  "creator.recovery.importFailed": {
    en: "We couldn’t import that source. Your campaign is unchanged. Try again or upload images instead.",
    ar: "لم نتمكن من استيراد هذا المصدر. حملتك لم تتغيّر. حاول مرة أخرى أو ارفع صوراً بدلاً من ذلك.",
  },
  "creator.rightsConfirmation": {
    en: "Confirm that you have permission to use these images and that the campaign facts are accurate.",
    ar: "أكّد أن لديك إذناً لاستخدام هذه الصور وأن معلومات الحملة دقيقة.",
  },
} as const;

describe("authentication handoff copy", () => {
  it("keeps every approved recovery string complete and exact in both catalogs", () => {
    for (const [key, expected] of Object.entries(requiredCopy)) {
      expect(en[key as keyof typeof en]).toBe(expected.en);
      expect(ar[key as keyof typeof ar]).toBe(expected.ar);
    }
  });

  it("describes exact campaign recovery without advertising retired model tooling", () => {
    const copy = [en["auth.heroTitle"], en["auth.heroCinema"], en["auth.heroDesc"]].join(" ");
    expect(copy).toContain("campaign");
    expect(copy).toContain("restores");
    expect(copy).not.toMatch(/Kling|Veo|model toolbox/i);
  });

  it("ships an Arabic campaign-recovery message", () => {
    expect(ar["auth.heroDesc"]).toMatch(/[\u0600-\u06ff]/u);
    expect(ar["auth.continueTitle"]).toMatch(/[\u0600-\u06ff]/u);
    expect(ar["auth.gateTitle"]).toMatch(/[\u0600-\u06ff]/u);
    expect(ar["auth.gateDescription"]).toMatch(/[\u0600-\u06ff]/u);
    expect(ar["auth.continueEmail"]).toMatch(/[\u0600-\u06ff]/u);
  });

  it("keeps the guest gate truthful about draft recovery", () => {
    expect(en["auth.gateDescription"]).toContain("this browser");
    expect(en["auth.gatePriceNote"]).toContain("stays saved");
    expect(en["auth.gatePriceNote"]).not.toMatch(/charge|price/i);
  });

  it("explains that private-beta verification can be completed later", () => {
    expect(en["auth.verificationLaterNotice"]).toContain("Account settings");
    expect(en["auth.accountReadyDesc"]).toContain("campaign");
    expect(ar["auth.verificationLaterNotice"]).toMatch(/[\u0600-\u06ff]/u);
    expect(ar["auth.accountReadyDesc"]).toMatch(/[\u0600-\u06ff]/u);
  });
});
