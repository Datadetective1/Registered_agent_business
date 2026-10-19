import { ImageResponse } from "next/og";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const alt = "Registered agent and business formation services";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const s = await getSettings();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#faf9f6",
          color: "#1b2430",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              background: s.colors.primary,
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {s.brand.monogram.slice(0, 3)}
          </div>
          <div style={{ fontSize: 36, fontWeight: 700 }}>{s.brand.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 950 }}>Registered agent service & Texas LLC formation</div>
          <div style={{ fontSize: 30, color: "#5b6573" }}>{s.brand.tagline}</div>
        </div>
        <div style={{ height: 8, width: 160, background: s.colors.primary, borderRadius: 4 }} />
      </div>
    ),
    size,
  );
}
