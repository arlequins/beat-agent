# Local agent demo

This is the complete no-cloud demonstration path. It uses Docker only for
PostgreSQL and native Ollama for models, which is typically the fastest choice
on Apple Silicon.

```bash
pnpm install
pnpm agent:setup
ollama pull qwen2.5:3b
ollama pull nomic-embed-text
pnpm agent:demo:check
pnpm dev:local
```

If `agent:demo:check` reports that Ollama is unavailable, start its local
service with `ollama serve` (or open the installed Ollama application) and run
the check again. The command performs no downloads and changes no data; it only
verifies the two models required for chat and semantic retrieval.

Then open `http://localhost:3000`, sign in with any non-empty development
credentials, create a workspace and conversation, upload a small text/Markdown
document, and ask a question whose answer appears in that document. Confirm the
assistant response shows a citation. The `nomic-embed-text` model enables local
semantic retrieval; keyword-only retrieval remains a safe fallback when it is
temporarily offline.

Before stopping the demo, run `pnpm agent:readiness --api-url
http://localhost:5000` in another terminal. Stop the local database with `pnpm
db:stop`. This does not remove its Docker volume.
