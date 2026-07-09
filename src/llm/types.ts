import type { UIMessage } from "ai";

import type { SourceContext } from "@/retrieval/context";

/**
 * Our chat message shape: standard UIMessage plus a `sources` data part
 * (rendered as `data-sources`, carrying the retrieved citations).
 */
export type ChatMessage = UIMessage<never, { sources: SourceContext[] }>;
