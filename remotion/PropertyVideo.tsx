// remotion/PropertyVideo.tsx
import React from "react";
import {
  AbsoluteFill,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";

interface PropertyVideoProps {
  imageUrls: string[];
  address: string;
  limitPrice: number;
  marketPrice: number;
  agentName: string;
  theme?: string;
}

export const PropertyVideo: React.FC<PropertyVideoProps> = (props) => {
  const { address, limitPrice, marketPrice, agentName, imageUrls } = props;
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateRight: "clamp",
  });

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const mainImage = imageUrls?.[0];

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #020617, #0f172a)",
        color: "white",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
      }}
    >
      {mainImage && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 600,
            borderRadius: 32,
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            backgroundImage: `url(${mainImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      )}

      {!mainImage && (
        <div
          style={{
            position: "absolute",
            top: 80,
            left: "50%",
            transform: "translateX(-50%)",
            width: 900,
            height: 600,
            borderRadius: 32,
            background:
              "linear-gradient(135deg, #020617, #1e293b, #020617)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            opacity: 0.6,
          }}
        >
          Foto tidak tersedia
        </div>
      )}

      <Sequence from={0} durationInFrames={600}>
        <div
          style={{
            opacity,
            textAlign: "center",
            padding: 40,
            marginTop: 420,
          }}
        >
          <div style={{ fontSize: 24, opacity: 0.8, marginBottom: 16 }}>
            Listing Lelang
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, marginBottom: 12 }}>
            {address}
          </div>
          <div style={{ fontSize: 24, marginBottom: 8 }}>
            Harga Limit: <b>{formatMoney(limitPrice)}</b>
          </div>
          <div style={{ fontSize: 20, opacity: 0.9, marginBottom: 8 }}>
            Harga Pasar: {formatMoney(marketPrice)}
          </div>
          <div style={{ fontSize: 18, opacity: 0.8, marginTop: 16 }}>
            Dipasarkan oleh {agentName}
          </div>
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
