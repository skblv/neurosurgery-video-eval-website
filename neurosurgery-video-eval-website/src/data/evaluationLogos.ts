const EXTENSIONS: Readonly<Record<string, string>> = {};
export function evaluationLogoExtension(provider: string): string { return Object.hasOwn(EXTENSIONS, provider) ? EXTENSIONS[provider] : "png"; }
