import {
  COLLECTIONS,
  newMongoObjectId,
  type MongoDatabase,
} from "@movprompt/db";

export const STARTER_TEMPLATE_RENDER_ENTITLEMENT = "starter_template_render";

export interface ProvisionableAuthUser {
  id: string;
  emailVerified: boolean;
}

export interface AuthUserProvisioner {
  ensure(user: ProvisionableAuthUser): Promise<void>;
  ensureById(userId: string): Promise<void>;
}

export interface AuthBenefitPolicy {
  requireEmailVerificationForStarter: boolean;
}

/**
 * Creates the non-resetting account benefits required by the generation API.
 *
 * The inserts deliberately use conflict-ignore semantics. Replayed auth hooks,
 * OAuth callbacks and later sign-ins must never restore a consumed starter
 * render or replace an existing paid credit balance.
 */
export function createAuthUserProvisioner(
  db: MongoDatabase,
  policy: AuthBenefitPolicy = { requireEmailVerificationForStarter: true },
): AuthUserProvisioner {
  async function ensure(user: ProvisionableAuthUser): Promise<void> {
    await db.transaction(async (session) => {
      const now = new Date();
      await db.collection(COLLECTIONS.creditAccounts).updateOne(
        { userId: user.id },
        { $setOnInsert: { userId: user.id, balance: 0, createdAt: now, updatedAt: now } },
        { upsert: true, session },
      );
      if (user.emailVerified || !policy.requireEmailVerificationForStarter) {
        await db.collection(COLLECTIONS.entitlements).updateOne(
          { userId: user.id, type: STARTER_TEMPLATE_RENDER_ENTITLEMENT },
          { $setOnInsert: {
            id: newMongoObjectId(), userId: user.id, type: STARTER_TEMPLATE_RENDER_ENTITLEMENT,
            status: "available", createdAt: now, updatedAt: now,
          } },
          { upsert: true, session },
        );
      }
    });
  }

  return {
    ensure,
    async ensureById(userId) {
      const user = await db.collection(COLLECTIONS.users).findOne(
        { id: userId },
        { projection: { id: 1, emailVerified: 1 } },
      ) as ProvisionableAuthUser | null;
      if (user) await ensure(user);
    },
  };
}

/**
 * Better Auth lifecycle hooks plus a session-created repair path. The session
 * hook self-heals accounts created before this provisioning contract existed.
 */
export function createAuthProvisioningHooks(provisioner: AuthUserProvisioner) {
  return {
    user: {
      create: {
        after: async (user: ProvisionableAuthUser) => {
          await provisioner.ensure(user);
        },
      },
      update: {
        after: async (user: ProvisionableAuthUser) => {
          await provisioner.ensure(user);
        },
      },
    },
    session: {
      create: {
        after: async (session: { userId: string }) => {
          await provisioner.ensureById(session.userId);
        },
      },
    },
  };
}
