import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { httpAction } from "./_generated/server";
import { makeFunctionReference } from "convex/server";
import { identity } from "./access";
import { fail } from "./domain/validation";
import { errorResponse } from "./domain/http";
const http = httpRouter();
authComponent.registerRoutesLazy(http, createAuth);
const inventoryApi = httpAction(async (ctx, request) => {
  const requestId = crypto.randomUUID();
  try {
    await identity(ctx);
    const url = new URL(request.url),
      path = url.pathname
        .replace(/^\/api\/v1\/?/, "")
        .split("/")
        .filter(Boolean),
      method = request.method;
    const queryArgs = Object.fromEntries(url.searchParams);
    for (const key of ["limit", "expectedVersion"])
      if (key in queryArgs)
        (queryArgs as Record<string, unknown>)[key] = Number(queryArgs[key]);
    let body: Record<string, unknown> = {};
    if (method !== "GET") {
      try {
        body = await request.json();
      } catch {
        fail("INVALID_INPUT", "Invalid JSON request body");
      }
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      fail("INVALID_INPUT", "Request body must be an object");
    let target = "",
      kind: "query" | "mutation" = "query",
      args: Record<string, unknown> = { ...queryArgs, ...body };
    const root = path[0],
      id = path[1];
    if (
      (root === "me" || root === "organizations") &&
      method === "GET" &&
      path.length === 1
    ) {
      target = "memberships:" + root;
      args = {};
    } else if (root === "locations" && method === "GET")
      target = "memberships:locations";
    else if (root === "products") {
      if (method === "GET") {
        target = id ? "catalogue:detail" : "catalogue:list";
        if (id) args.productId = id;
      } else {
        kind = "mutation";
        target =
          path[2] === "archive"
            ? "catalogue:archive"
            : method === "PATCH"
              ? "catalogue:update"
              : "catalogue:create";
        if (id) args.productId = id;
      }
    } else if (root === "inventory" && method === "GET")
      target = "inventory:list";
    else if (root === "movements" && method === "GET")
      target = "inventory:movements";
    else if (root === "settings") {
      target = method === "GET" ? "settings:get" : "settings:update";
      kind = method === "GET" ? "query" : "mutation";
    } else if (root === "reports") {
      if (method === "POST") {
        target = "reports:request";
        kind = "mutation";
        args.name = id;
        args.filters = JSON.stringify(body.filters ?? {});
      } else {
        target = "reports:page";
        if (id) args.runId = id;
      }
    } else if (root === "exports" && method === "GET") target = "exports:page";
    else if (root === "memberships" && method === "POST") {
      target = "memberships:set";
      kind = "mutation";
    } else if (root === "stock" && method === "POST") {
      const ops: Record<string, string> = {
        receipts: "receiveStock",
        sales: "recordSale",
        dispatch: "dispatchTransfer",
        "transfer-receipts": "receiveTransfer",
        returns: "quarantineReturn",
        "qc-release": "releaseQc",
        "bin-moves": "moveBin",
      };
      if (ops[id]) {
        target = "operations:" + ops[id];
        kind = "mutation";
      }
    } else if (root === "imports") {
      if (method === "GET") {
        target = path[2] === "rejects" ? "imports:rejects" : "imports:status";
        args.batchId = id;
      } else {
        kind = "mutation";
        target = !id
          ? "imports:create"
          : path[2] === "chunks"
            ? "imports:stageChunk"
            : path[2] === "validate"
              ? "imports:validate"
              : path[2] === "commit"
                ? "imports:commit"
                : "";
        if (id) args.batchId = id;
      }
    }
    if (!target) fail("NOT_FOUND", "Endpoint not found");
    if (root === "reports" && method === "POST") {
      args = {
        organizationId: args.organizationId,
        name: id,
        filters: args.filters,
        ...(body.sort ? { sort: body.sort } : {}),
        ...(body.direction ? { direction: body.direction } : {}),
        ...(body.layout ? { layout: body.layout } : {}),
      };
    }
    const result =
      kind === "query"
        ? await ctx.runQuery(makeFunctionReference<"query">(target), args)
        : await ctx.runMutation(
            makeFunctionReference<"mutation">(target),
            args,
          );
    return Response.json(
      {
        data: result,
        meta: { requestId, currency: "INR", timezone: "Asia/Kolkata" },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error, requestId);
  }
});
for (const method of ["GET", "POST", "PATCH"] as const)
  http.route({ pathPrefix: "/api/v1/", method, handler: inventoryApi });
export default http;
