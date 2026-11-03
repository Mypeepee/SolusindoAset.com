import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { jakartaDate, settingsSchema } from "@/lib/marketing/domain";
import { configurePlanSchema } from "@/lib/marketing/plan";
import { configurePlan, planCandidates } from "@/lib/marketing/plans.server";
import { marketingAnalytics } from "@/lib/marketing/analytics.server";
import {
  apiFailure,
  privateHeaders,
  readJson,
  requireMarketingOwner,
  MarketingError,
} from "@/lib/marketing/security.server";
import {
  commentsFor,
  dashboard,
  plannerMonth,
  previewNext,
  syncMetrics,
  testWhatsapp,
  updateConfiguration,
  reconcilePublication,
  preparePlannedSlot,
} from "@/lib/marketing/service.server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const idSchema = z.string().uuid();
export async function GET(request: NextRequest) {
  try {
    await requireMarketingOwner();
    if (request.nextUrl.searchParams.get("mode") === "candidates") {
      const query = z
        .string()
        .max(100)
        .parse(request.nextUrl.searchParams.get("query") || "");
      const when = z
        .string()
        .datetime({ offset: true })
        .parse(request.nextUrl.searchParams.get("when"));
      const offset = z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .parse(request.nextUrl.searchParams.get("offset") || 0);
      const jobId = request.nextUrl.searchParams.get("job") || undefined;
      if (jobId) idSchema.parse(jobId);
      return NextResponse.json(
        await planCandidates(when, query, offset, jobId),
        { headers: privateHeaders },
      );
    }
    if (request.nextUrl.searchParams.get("mode") === "comments") {
      const id = idSchema.parse(
        request.nextUrl.searchParams.get("publication"),
      );
      const after = request.nextUrl.searchParams.get("after") || undefined;
      if (after && (after.length > 2000 || !/^[A-Za-z0-9_/=+-]+$/.test(after)))
        throw new MarketingError("INVALID_REQUEST");
      return NextResponse.json(await commentsFor(id, after), {
        headers: privateHeaders,
      });
    }
    const page = Number(request.nextUrl.searchParams.get("page") || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000)
      throw new MarketingError("INVALID_REQUEST");
    const month = z
      .string()
      .regex(/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/)
      .parse(
        request.nextUrl.searchParams.get("month") || jakartaDate().slice(0, 7),
      );
    if (request.nextUrl.searchParams.get("mode") === "analytics")
      return NextResponse.json(await marketingAnalytics(month), {
        headers: privateHeaders,
      });
    if (request.nextUrl.searchParams.get("mode") === "planner")
      return NextResponse.json(await plannerMonth(month), {
        headers: privateHeaders,
      });
    return NextResponse.json(await dashboard(page, month), {
      headers: privateHeaders,
    });
  } catch (error) {
    return error instanceof z.ZodError
      ? NextResponse.json(
          { error: "INVALID_REQUEST" },
          { status: 400, headers: privateHeaders },
        )
      : apiFailure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    await requireMarketingOwner(request, true);
    const input = await readJson(request);
    let result: unknown;
    switch (input.action) {
      case "configure-plan":
        result = {
          job: await configurePlan(configurePlanSchema.parse(input.plan)),
        };
        break;
      case "settings":
        result = {
          config: await updateConfiguration(settingsSchema.parse(input.config)),
        };
        break;
      case "preview":
        result = { job: await previewNext() };
        break;
      case "plan":
        result = {
          job: await preparePlannedSlot(
            z.string().datetime({ offset: true }).parse(input.scheduledFor),
          ),
        };
        break;
      case "test-whatsapp":
        result = await testWhatsapp(
          z.string().min(7).max(30).parse(input.phone),
        );
        break;
      case "sync":
        result = await syncMetrics(idSchema.parse(input.publicationId));
        break;
      case "reconcile":
        result = await reconcilePublication(
          idSchema.parse(input.publicationId),
        );
        break;
      default:
        throw new MarketingError("INVALID_REQUEST");
    }
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        { error: "INVALID_SETTINGS", fields: error.flatten().fieldErrors },
        { status: 400, headers: privateHeaders },
      );
    return apiFailure(error);
  }
}
