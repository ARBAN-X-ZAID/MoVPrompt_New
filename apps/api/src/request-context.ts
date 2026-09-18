import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { RequestIdSchema } from "@movprompt/contracts";
import type { MiddlewareHandler } from "hono";

export type ApiVariables = {
  requestId: string;
};

export type ApiEnvironment = {
  Bindings: {
    incoming?: IncomingMessage;
  };
  Variables: ApiVariables;
};

export const requestContext: MiddlewareHandler<ApiEnvironment> = async (context, next) => {
  const supplied = context.req.header("x-request-id");
  const requestId = RequestIdSchema.safeParse(supplied).success ? supplied! : randomUUID();

  context.set("requestId", requestId);
  context.header("x-request-id", requestId);
  await next();
};
