// remotion/Root.tsx
import React from "react";
import { Composition } from "remotion";
import { PropertyVideo } from "./PropertyVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="property-video"
        component={PropertyVideo}
        durationInFrames={600}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          imageUrls: [
            "https://via.placeholder.com/1080x1920.png?text=Foto+1",
          ],
          address: "Alamat properti",
          limitPrice: 500_000_000,
          marketPrice: 800_000_000,
          agentName: "Nama Agent",
          theme: "default",
        }}
      />
    </>
  );
};
