import { describe, expect, it } from "vitest";
import { projectPortableUser } from "./useAuth";

describe("portable auth session compatibility", () => {
  it("keeps Better Auth identity fields and projects legacy metadata", () => {
    const createdAt = new Date("2026-08-12T08:00:00.000Z");
    const user = projectPortableUser({
      id: "7c12604e-3302-4d1b-9c41-f0af7c58e78c",
      email: "creator@example.com",
      emailVerified: true,
      name: "GCC Creator",
      image: "https://cdn.example/avatar.png",
      createdAt,
      updatedAt: createdAt,
    });

    expect(user).toMatchObject({
      id: "7c12604e-3302-4d1b-9c41-f0af7c58e78c",
      email: "creator@example.com",
      name: "GCC Creator",
      image: "https://cdn.example/avatar.png",
      role: "user",
      user_metadata: {
        full_name: "GCC Creator",
        avatar_url: "https://cdn.example/avatar.png",
      },
    });
    expect(user.created_at).toBe("2026-08-12T08:00:00.000Z");
  });
});
