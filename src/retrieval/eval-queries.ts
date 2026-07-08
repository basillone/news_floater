export interface EvalQuery {
  query: string;
  /** A result counts as relevant if this matches its `title + abstract`. */
  relevant: RegExp;
}

/**
 * Retrieval eval set. Ground truth is a keyword/regex proxy (a result is
 * "relevant" if its title+abstract matches) rather than human judgments — it's
 * repeatable against a changing corpus, but it does lean lexical, which slightly
 * flatters keyword search. The point is the *methodology* (hit@k / MRR, and
 * comparing modes), and showing hybrid matches-or-beats either mode alone.
 */
export const EVAL_QUERIES: EvalQuery[] = [
  { query: "large language models", relevant: /large language model|\bLLM/i },
  {
    query: "reinforcement learning from human feedback",
    relevant: /RLHF|human feedback|reinforcement learning/i,
  },
  { query: "retrieval augmented generation", relevant: /retrieval.{0,4}augmented|\bRAG\b/i },
  { query: "diffusion models for image generation", relevant: /diffusion/i },
  { query: "graph neural networks", relevant: /graph neural network|\bGNN/i },
  { query: "transformer architecture", relevant: /transformer|attention/i },
  { query: "fine-tuning language models", relevant: /fine.?tun/i },
  { query: "chain of thought reasoning", relevant: /chain.of.thought|reasoning/i },
  { query: "vision language multimodal models", relevant: /multimodal|vision.language|\bVLM/i },
  { query: "model evaluation benchmark", relevant: /benchmark|evaluation/i },
  { query: "knowledge distillation", relevant: /distillation/i },
  { query: "autonomous agents", relevant: /\bagent/i },
  { query: "machine translation multilingual", relevant: /translation|multilingual/i },
  {
    query: "efficient inference quantization",
    relevant: /quantization|efficient inference|\bKV cache/i,
  },
  { query: "speech recognition", relevant: /speech|audio|\bASR/i },
  { query: "instruction tuning and alignment", relevant: /instruction|alignment/i },
];
