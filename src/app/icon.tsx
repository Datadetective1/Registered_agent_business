import { ImageResponse } from "next/og";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** Favicon generated from the brand monogram and primary color (see src/config/site.ts). */
export default async function Icon() {
  const s = await getSettings();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: s.colors.primary,
          color: "#fff",
          borderRadius: 12,
          fontSize: 28,
          fontWeight: 700,
        }}
      >
        {s.brand.monogram.slice(0, 2)}
      </div>
    ),
    size,
  );
}
