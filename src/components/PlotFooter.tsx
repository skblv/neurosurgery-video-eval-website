import { PLOT_BRANDING } from "../data/plotBranding";

export function PlotFooter({ methodology }: { methodology: string }) {
  return <footer className="plot-footer">
    <p className="plot-methodology">{methodology}</p>
    <div className="plot-branding">
      <span className="plot-address">{PLOT_BRANDING.label}</span>
      <div className="plot-branding-logos">
        {PLOT_BRANDING.logos.map((logo) => <img key={logo.label} src={logo.src} width={logo.width} height={logo.height} alt={logo.label} />)}
      </div>
    </div>
  </footer>;
}
