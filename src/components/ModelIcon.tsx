import { boothShield, sdscMark } from "../assets/logos";
import { PROVIDER_LABELS, type Provider } from "../data/benchmark";
import { PROVIDER_ICONS } from "../data/providerIcons";

/** Joint mark for models we trained: the SDSC swirl beside the Chicago Booth crest. */
function JointMark({ size }: { size: number }) {
  return (
    <span className="joint-mark" style={{ height: size }}>
      <img src={sdscMark} alt="" height={size} />
      <img src={boothShield} alt="" height={size - 1} className="joint-mark__shield" />
    </span>
  );
}

export function ModelIcon({ provider, size = 15 }: { provider: Provider; size?: number }) {
  if (provider === "internal") {
    return (
      <span className="model-icon" title={PROVIDER_LABELS.internal}>
        <JointMark size={size} />
      </span>
    );
  }

  const icon = PROVIDER_ICONS[provider];

  return (
    <span className="model-icon" title={PROVIDER_LABELS[provider]}>
      <svg
        width={size}
        height={size}
        viewBox={icon.viewBox}
        fill={icon.hex}
        role="img"
        aria-label={icon.title}
      >
        <path d={icon.path} />
      </svg>
    </span>
  );
}
