import { VOID_COLOR } from "@/lib/theme";
import { hueToCss, type StarParams } from "@/lib/types/star";

/**
 * A cheap, static stand-in for the star. Admin lists dozens of rows and every
 * live StarCanvas costs a WebGL context (browsers cap out around 16), so the
 * table uses this and saves the real sketch for single-star views.
 */
export default function StarSwatch({
  params,
  size = 72,
  className = "",
}: {
  params: StarParams;
  size?: number;
  className?: string;
}) {
  // core tightens the bright center; noise widens the corona's falloff
  const coreStop = 6 + (params.core / 100) * 14;
  const haloStop = coreStop + 18 + (params.noise / 100) * 30;

  return (
    <div
      className={`rounded ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 50% 50%, white 0%, ${hueToCss(
          params.hue,
          90,
          62,
        )} ${coreStop}%, ${hueToCss(params.hue2, 85, 42)} ${haloStop}%, ${VOID_COLOR} 78%)`,
      }}
    />
  );
}
