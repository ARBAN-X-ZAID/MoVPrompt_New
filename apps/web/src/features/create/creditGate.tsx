export type CreditShortfall = { required: number; available: number };

function creditShortfallMessage(shortfall: CreditShortfall, arabic: boolean): string {
  return arabic
    ? `الرصيد غير كافٍ. هذا الفيديو يحتاج ${shortfall.required} رصيد ورصيدك ${shortfall.available}.`
    : `Not enough credits. This video needs ${shortfall.required} credits and you have ${shortfall.available}.`;
}

export function CreditShortfallNotice({ id, shortfall, arabic }: { id: string; shortfall: CreditShortfall; arabic: boolean }) {
  return <p id={id} className="creator-credit-shortfall" role="status">{creditShortfallMessage(shortfall, arabic)}</p>;
}

export function GenerateLabel({ signIn, arabic, english, arabicLabel }: { signIn: boolean | undefined; arabic: boolean; english: string; arabicLabel: string }) {
  if (!signIn) return <>{arabic ? arabicLabel : english}</>;
  return <>{arabic ? "سجّل الدخول للتوليد" : "Sign in to generate"}</>;
}
