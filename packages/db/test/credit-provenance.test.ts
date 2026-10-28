import { describe, expect, it } from "vitest";
import { reconstructCreditLots } from "../src/credit-provenance.js";

const purchases = [
  {
    kind: "purchase",
    referenceType: "payment_order",
    referenceId: "a",
    delta: 100,
  },
  {
    kind: "purchase",
    referenceType: "payment_order",
    referenceId: "b",
    delta: 100,
  },
];
describe("purchase provenance around held cash refunds", () => {
  it("charges the reserved purchase and restores that same purchase after another one is refunded", () => {
    const rows = [
      ...purchases,
      {
        kind: "charge",
        referenceId: "run",
        delta: -75,
        purchaseAllocations: [{ orderId: "b", credits: 75 }],
      },
      { kind: "cash_refund", referenceId: "a", delta: -100 },
    ];
    expect(reconstructCreditLots(rows, 25)).toMatchObject({ verified: true });
    const refunded = reconstructCreditLots(
      [...rows, { kind: "refund", referenceId: "run", delta: 75 }],
      100,
    );
    expect(refunded.verified).toBe(true);
    expect(
      refunded.lots
        .filter((lot) => lot.orderId === "a")
        .reduce((sum, lot) => sum + lot.remaining, 0),
    ).toBe(0);
    expect(
      refunded.lots
        .filter((lot) => lot.orderId === "b")
        .reduce((sum, lot) => sum + lot.remaining, 0),
    ).toBe(100);
  });
  it("does not accept duplicate purchases, duplicate restorations or malformed allocations as verified provenance", () => {
    expect(
      reconstructCreditLots([purchases[0]!, purchases[0]!], 200).verified,
    ).toBe(false);
    const charge = {
      kind: "charge",
      referenceId: "run",
      delta: -50,
      purchaseAllocations: [{ orderId: "a", credits: 50 }],
    };
    const restore = { kind: "refund", referenceId: "run", delta: 50 };
    expect(
      reconstructCreditLots([purchases[0]!, charge, restore, restore], 150)
        .verified,
    ).toBe(false);
    expect(
      reconstructCreditLots(
        [
          purchases[0]!,
          { ...charge, purchaseAllocations: [{ orderId: "a", credits: 49 }] },
        ],
        50,
      ).verified,
    ).toBe(false);
  });
  it("keeps a remaining purchased portion after an unused-value cash refund and failed-video restoration", () => {
    const result = reconstructCreditLots(
      [
        purchases[0]!,
        {
          kind: "charge",
          referenceId: "run",
          delta: -40,
          purchaseAllocations: [{ orderId: "a", credits: 40 }],
        },
        { kind: "cash_refund", referenceId: "a", delta: -60 },
        { kind: "refund", referenceId: "run", delta: 40 },
      ],
      40,
    );
    expect(result.verified).toBe(true);
    expect(
      result.lots
        .filter((lot) => lot.orderId === "a")
        .reduce((sum, lot) => sum + lot.remaining, 0),
    ).toBe(40);
  });
});
