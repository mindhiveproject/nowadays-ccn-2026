"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";

const PlanetCanvas = dynamic(() => import("@/components/PlanetCanvas"), {
  ssr: false,
  loading: () => (
    <div className="aspect-square w-full animate-pulse bg-black" />
  ),
});

export default function PlanetCanvasClient(
  props: ComponentProps<typeof PlanetCanvas>,
) {
  return <PlanetCanvas {...props} />;
}
