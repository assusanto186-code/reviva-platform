import { ImageResponse } from "next/og";

export const alt = "Reviva — The AI Front Desk Employee for Med Spas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const colors = {
  background: "#020617",
  surface: "#0f172a",
  foreground: "#f8fafc",
  muted: "#94a3b8",
  primary: "#34d399",
  primaryForeground: "#022c22",
};

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: colors.background,
          color: colors.foreground,
          padding: "72px 80px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 18,
              background: colors.primary,
              color: colors.primaryForeground,
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            R
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>Reviva</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
          <div
            style={{
              color: colors.primary,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
            }}
          >
            AI Employee for med spas
          </div>
          <div
            style={{
              marginTop: 26,
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -3,
            }}
          >
            Every inquiry deserves a thoughtful response.
          </div>
          <div
            style={{
              marginTop: 28,
              color: colors.muted,
              fontSize: 28,
              lineHeight: 1.4,
            }}
          >
            A consistent front desk presence designed for conversations across
            text and voice.
          </div>
        </div>

        <div
          style={{
            height: 6,
            width: "100%",
            borderRadius: 999,
            background: colors.surface,
            overflow: "hidden",
            display: "flex",
          }}
        >
          <div style={{ width: "34%", background: colors.primary }} />
        </div>
      </div>
    ),
    size,
  );
}
