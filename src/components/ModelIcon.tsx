import { boothShield, sdscMark } from "../assets/logos";
import { providerLabel, type Provider } from "../data/benchmark";
import { PROVIDER_ICONS, PROVIDER_MONOGRAMS } from "../data/providerIcons";

/** Joint mark for models we trained: the SDSC swirl beside the Chicago Booth crest. */
function JointMark({ size }: { size: number }) {
  return (
    <span className="joint-mark" style={{ height: size }}>
      <img src={sdscMark} alt="" height={size} />
      <img src={boothShield} alt="" height={size - 1} className="joint-mark__shield" />
    </span>
  );
}

/**
 * Logo for a newly submitted family, served from the static site.
 *
 * The eval publisher drops the uploaded file at
 * `provider-logos/<slug>.(png|svg|jpg|jpeg|webp)` when results land.
 */
function UploadedMark({ provider, size }: { provider: Provider; size: number }) {
  const label = providerLabel(provider);
  const candidates = ["png", "svg", "jpg", "jpeg", "webp"].map(
    (ext) => `./provider-logos/${provider}.${ext}`,
  );

  return (
    <span className="model-icon" title={label}>
      <img
        src={candidates[0]}
        alt=""
        width={size}
        height={size}
        onError={(event) => {
          const img = event.currentTarget;
          const next = Number(img.dataset.next ?? "1");
          if (next < candidates.length) {
            img.dataset.next = String(next + 1);
            img.src = candidates[next];
            return;
          }
          img.style.visibility = "hidden";
        }}
      />
    </span>
  );
}

export function ModelIcon({ provider, size = 15 }: { provider: Provider; size?: number }) {
  if (provider === "internal") {
    return (
      <span className="model-icon" title={providerLabel("internal")}>
        <JointMark size={size} />
      </span>
    );
  }

  const icon = PROVIDER_ICONS[provider];
  if (!icon) {
    const monogram = PROVIDER_MONOGRAMS[provider];
    if (monogram) {
      return (
        <span className="model-icon" title={providerLabel(provider)}>
          <span className="model-monogram" aria-hidden="true">{monogram}</span>
        </span>
      );
    }
    return <UploadedMark provider={provider} size={size} />;
  }

  return (
    <span className="model-icon" title={providerLabel(provider)}>
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
