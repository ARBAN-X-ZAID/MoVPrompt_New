import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";

import {
  mongoDocumentForStorage,
  mongoDocumentFromStorage,
  newMongoObjectId,
  toMongoObjectId,
} from "../src/mongo-client.js";

describe("canonical MongoDB identifiers", () => {
  it("stores one native ObjectId and removes the duplicate id field", () => {
    const id = newMongoObjectId();
    const stored = mongoDocumentForStorage({ id, userId: id, title: "Campaign" });

    expect(stored._id).toBeInstanceOf(ObjectId);
    expect(stored.userId).toBeInstanceOf(ObjectId);
    expect(stored).not.toHaveProperty("id");
    expect(mongoDocumentFromStorage(stored)).toMatchObject({ id, userId: id });
  });

  it("maps a legacy UUID deterministically without persisting it", () => {
    const legacy = "99999999-9999-4999-8999-999999999999";
    expect(toMongoObjectId(legacy).toHexString()).toBe(toMongoObjectId(legacy).toHexString());
    expect(toMongoObjectId(legacy).toHexString()).toMatch(/^[0-9a-f]{24}$/);
  });

  it("leaves semantic ids inside campaign configuration untouched", () => {
    const stored = mongoDocumentForStorage({
      id: newMongoObjectId(),
      configuration: { creatorProject: { templateId: "luxury-product-reveal" } },
    });

    expect(stored.configuration).toEqual({ creatorProject: { templateId: "luxury-product-reveal" } });
  });
});
