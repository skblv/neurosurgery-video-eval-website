export interface ModelRelease {
  date: string;
  source: string;
  note?: string;
  additionalSource?: string;
}

/**
 * First announced availability of the exact model, including released previews.
 * Not training cutoffs, evaluation dates, catalog creation times, or later relaunches.
 * Primary sources checked 2026-09-09. Keep unknown dates absent, never impute them.
 */
export const MODEL_RELEASES: Readonly<Record<string, ModelRelease>> = {
  "gemma3-27b-it": {
    date: "2025-03-12",
    source: "https://developers.googleblog.com/en/introducing-gemma3/",
  },
  "gemini-3-flash": {
    date: "2025-12-17",
    source: "https://blog.google/innovation-and-ai/technology/developers-tools/build-with-gemini-3-flash/",
  },
  "claude-opus-4_6": {
    date: "2026-02-05",
    source: "https://www.anthropic.com/news/claude-opus-4-6",
  },
  "claude-sonnet-4_6": {
    date: "2026-02-17",
    source: "https://www.anthropic.com/news/claude-sonnet-4-6",
  },
  "gemini-3_1-pro": {
    date: "2026-02-19",
    source: "https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-pro/",
  },
  "gpt-5_4": {
    date: "2026-03-05",
    source: "https://openai.com/index/introducing-gpt-5-4/",
  },
  "claude-fable-5": {
    date: "2026-06-09",
    source: "https://www.anthropic.com/news/claude-fable-5-mythos-5",
    note: "Initial release, not its July 1 redeployment.",
  },
  "gpt-5_6-sol": {
    date: "2026-06-26",
    source: "https://openai.com/index/previewing-gpt-5-6-sol/",
    note: "Limited API/Codex preview on June 26; general availability July 9.",
    additionalSource: "https://openai.com/index/gpt-5-6/",
  },
  "gpt-5_6-terra": {
    date: "2026-06-26",
    source: "https://openai.com/index/previewing-gpt-5-6-sol/",
    note: "Limited API/Codex preview on June 26; general availability July 9.",
    additionalSource: "https://openai.com/index/gpt-5-6/",
  },
  "gpt-5_6-luna": {
    date: "2026-06-26",
    source: "https://openai.com/index/previewing-gpt-5-6-sol/",
    note: "Limited API/Codex preview on June 26; general availability July 9.",
    additionalSource: "https://openai.com/index/gpt-5-6/",
  },
  "claude-sonnet-5": {
    date: "2026-06-30",
    source: "https://www.anthropic.com/news/claude-sonnet-5",
  },
  "kimi-k3": {
    date: "2026-07-16",
    source: "https://www.kimi.com/code/docs/en/kimi-code/whats-new.html",
    additionalSource: "https://www.kimi.com/en/blog/kimi-k3",
    note: "Initial hosted release, not the later July 27 weight release.",
  },
  "claude-opus-5": {
    date: "2026-07-24",
    source: "https://www.anthropic.com/news/claude-opus-5",
  },
  "grok-4_6": {
    date: "2026-08-12",
    source: "https://docs.x.ai/developers/release-notes",
  },
  "gemini-3_7-flash": {
    date: "2026-08-13",
    source: "https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-3-7-flash/",
  },
  "qwen3-8-27b": {
    date: "2026-08-14",
    source: "https://github.com/QwenLM/Qwen3.8",
  },
  "glm-5_3-flash": {
    date: "2026-08-26",
    source: "https://z.ai/blog/glm-5.3-flash",
    note: "Date rendered by the original announcement's published JavaScript entry; not the anonymous ox-alpha preview.",
  },
  "claude-fable-5_1": {
    date: "2026-09-01",
    source: "https://platform.claude.com/docs/en/models/fable-5-1/overview",
  },
  "gemini-3_8-flash": {
    date: "2026-09-02",
    source: "https://blog.google/innovation-and-ai/models-and-research/gemini-models/3-8-flash-and-3-8-flash-cyber/",
  },
  "qwen3-8-max-0902": {
    date: "2026-09-02",
    source: "https://www.alibabacloud.com/help/en/model-studio/newly-released-models",
    note: "Exact 0902 snapshot; older Qwen3.8 Max is a different evaluated model.",
  },
  "gpt-6-astra": {
    date: "2026-09-03",
    source: "https://openai.com/index/safety-overview-gpt-6-astra/",
    additionalSource: "https://openai.com/index/gpt-6-astra/",
  },
};
