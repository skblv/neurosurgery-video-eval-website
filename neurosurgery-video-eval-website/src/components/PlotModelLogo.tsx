import { evaluationLogoExtension } from "../data/evaluationLogos";
import { PROVIDER_ICONS } from "../data/providerIcons";
import qwenLogo from "../assets/logos/qwen.svg?no-inline";
import sdscMark from "../assets/logos/sdsc-mark.svg?no-inline";
import boothShield from "../assets/logos/booth-shield.svg?no-inline";

/** The same provider and joint specialist marks used throughout the leaderboard. */
export function PlotModelLogo({ provider, x, y }: { provider: string; x: number; y: number }) {
  const icon = Object.hasOwn(PROVIDER_ICONS, provider) ? PROVIDER_ICONS[provider] : undefined;
  const size = 18;
  const [minX, minY, width, height] = icon?.viewBox.split(" ").map(Number) ?? [0, 0, size, size];
  const scale = size / Math.max(width, height);
  return <g className="release-model-logo" data-provider={provider} aria-hidden="true">
    {provider === "internal" ? <>
      <image href={sdscMark} x={x - 10.02} y={y - 5.4} width="10.8" height="10.8" />
      <image href={boothShield} x={x + 1.98} y={y - 5.1} width="8.04" height="10.2" />
    </> : icon ? <path d={icon.path} fill={icon.hex}
      transform={`translate(${x - (minX + width / 2) * scale} ${y - (minY + height / 2) * scale}) scale(${scale})`} />
      : <image href={provider === "qwen" ? qwenLogo : `${import.meta.env.BASE_URL}provider-logos/${provider}.${evaluationLogoExtension(provider)}`} x={x - size / 2} y={y - size / 2} width={size} height={size} />}
  </g>;
}
