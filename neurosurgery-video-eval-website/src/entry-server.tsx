import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import App from "./App";
import type { DomainRoute } from "./data/domains";

export function render(route: DomainRoute | null): string {
  return renderToString(<StrictMode><App route={route} /></StrictMode>);
}
