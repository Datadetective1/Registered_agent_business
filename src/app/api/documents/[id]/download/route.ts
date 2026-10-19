import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { audit } from "@/server/audit";
import { getCurrentSession } from "@/server/auth/session";
import { canAccessDocument, readDocument } from "@/server/documents";

export const dynamic = "force-dynamic";

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await getCurrentSession();
  if (!session) return new NextResponse("Unauthorized", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return notFound();

  const [doc] = await db.select().from(documents).where(eq(documents.id, id)).limit(1);
  if (!doc || !canAccessDocument(doc, { role: session.user.role, customerId: session.customer?.id ?? null })) return notFound();

  let data: Buffer;
  try {
    data = await readDocument(doc);
  } catch {
    return notFound();
  }
  if (session.user.role === "customer" && !doc.customerViewedAt) {
    await db.update(documents).set({ customerViewedAt: new Date() }).where(eq(documents.id, doc.id));
  }
  await audit({
    actor: { type: session.user.role, userId: session.user.id },
    action: "document.downloaded",
    targetType: "document",
    targetId: doc.id,
    customerId: doc.customerId,
    orderId: doc.orderId,
  });

  const inline = req.nextUrl.searchParams.get("inline") === "1" && doc.mimeType === "application/pdf";
  const filename = doc.originalFilename.replace(/"/g, "");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(doc.originalFilename)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
