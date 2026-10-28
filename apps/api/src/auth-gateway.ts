import { authenticationEventKind, recordAuthenticationEvent } from "./auth-event-history.js";
import { recordOwnerFactorAssurance } from "./admin/auth-factor-assurance.js";
import { ObjectId } from "mongodb";
import type { AuthPublicCapability, MovPromptAuth } from "@movprompt/auth";
import { z } from "zod";
import type { MongoDatabase } from "@movprompt/db";

const AuthenticatedSessionSchema = z
  .object({
    user: z
      .object({
        id: z.string().min(1),
        email: z.email(),
        emailVerified: z.boolean(),
        name: z.string(),
        role: z.enum(["user", "admin"]).optional(),
      })
      .passthrough(),
    session: z.object({ id: z.string().min(1) }).passthrough(),
  })
  .passthrough();

export type AuthenticatedSession = z.infer<typeof AuthenticatedSessionSchema>;

export interface AuthGateway {
  handle(request: Request): Promise<Response>;
  getSession(headers: Headers): Promise<AuthenticatedSession | null>;
  verifyFactor?(headers: Headers, code: string, mode?: "totp" | "backup"): Promise<boolean>;
  sendAccountEmail?(type: "password-reset" | "verify-email", email: string): Promise<void>;
  publicCapability?: AuthPublicCapability;
}

export function createBetterAuthGateway(auth: MovPromptAuth, publicCapability: AuthPublicCapability, database?: MongoDatabase, webOrigin?: string): AuthGateway {
  return {
    async handle(request) {
      const path=new URL(request.url).pathname;
      const sensitive=["/two-factor/disable","/two-factor/enable","/two-factor/get-totp-uri","/two-factor/generate-backup-codes","/two-factor/view-backup-codes","/change-password"];
      if(database&&sensitive.some(endpoint=>path.endsWith(endpoint))){
        const current=await auth.api.getSession({headers:request.headers});
        const owner=current?await database.collection("admin_owners").findOne({userId:current.user.id,role:"owner",$or:[{active:true},{pendingVerification:true}]}):null;
        if(current&&owner){
          const user=await database.collection("users").findOne({id:current.user.id});
          if(!user?.emailVerified&&owner.loginMode!=="designated-email-password")return Response.json({code:"OWNER_VERIFICATION_REQUIRED",message:"Verify the designated owner email first."},{status:403});
          await database.db.collection("audit_logs").insertOne({actorId:new ObjectId(current.user.id),action:"owner.security-request",target:path,outcome:"requested",requestId:request.headers.get("x-request-id")?.slice(0,120)??"auth-owner-security",changes:{},createdAt:new Date()});
          if(path.endsWith("/two-factor/disable") || path.endsWith("/two-factor/enable") && user?.twoFactorEnabled) return Response.json({code:"OWNER_MFA_REQUIRED",message:"Owner MFA must remain enabled. Recover the existing authenticator using owner security settings."},{status:403});
          if(user?.twoFactorEnabled){
            const assurance=await database.db.collection("admin_session_assurance").findOne({userId:new ObjectId(current.user.id),sessionId:current.session.id,recentUntil:{$gt:new Date()},expiresAt:{$gt:new Date()}});
            if(!assurance)return Response.json({code:"OWNER_STEP_UP_REQUIRED",message:"Confirm an owner authenticator or unused recovery code first."},{status:403});
          }
        }
      }
      const historyRequest = database && authenticationEventKind(path) ? request.clone() : null;
      const priorSession = historyRequest ? await auth.api.getSession({headers:request.headers}) : null;
      const factorRequest = /\/two-factor\/verify-(totp|backup-code)$/.test(path) ? request.clone() : null;
      const response = await auth.handler(request);
      if(database && factorRequest)await recordOwnerFactorAssurance(database,factorRequest,response,headers=>auth.api.getSession({headers}));
      if(database && historyRequest) await recordAuthenticationEvent(database,historyRequest,response,headers=>auth.api.getSession({headers}),priorSession);
      return response;
    },
    publicCapability,
    async verifyFactor(headers, code, mode = "totp") {
      const result = mode === "backup" ? await auth.api.verifyBackupCode({headers,body:{code,trustDevice:false}}) : await auth.api.verifyTOTP({ headers, body: { code, trustDevice: false } });
      return Boolean(result.user?.id);
    },
    async sendAccountEmail(type, email) {
      if (type === "password-reset") await auth.api.requestPasswordReset({ body: { email, redirectTo: webOrigin ? new URL("/reset-password", webOrigin).href : "/reset-password" } });
      else await auth.api.sendVerificationEmail({ body: { email, callbackURL: webOrigin ? new URL("/account/settings", webOrigin).href : "/account/settings" } });
    },
    async getSession(headers) {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      if (database) {
        const user = await database.collection("users").findOne({ id: session.user.id }, { projection: { suspendedAt: 1, deletionRequestedAt: 1 } });
        if (!user || user.suspendedAt || user.deletionRequestedAt) return null;
      }
      return AuthenticatedSessionSchema.parse(session);
    },
  };
}
