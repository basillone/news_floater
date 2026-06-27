// Side-effect import: load env for local scripts BEFORE anything reads
// process.env. Import this first. `.env.local` wins over `.env` (dotenv keeps
// the first value loaded), matching Next.js precedence.
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });
