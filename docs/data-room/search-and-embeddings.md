# Data room search and embeddings

## What embeddings do

Data room search has two parts that run together:

- **Keyword search** matches the words in a query against the text of each item (a Postgres `tsvector` index). It works with no model at all.
- **Meaning search** compares the query with every text chunk by vector distance (pgvector, cosine). It finds a chunk about "cancelling the lease" for the query "ending our rental agreement". This needs an embedding model, which turns each chunk and the query into a list of numbers.

When an embedding model is set, the two result lists are merged by reciprocal rank fusion, so an item that ranks well in both rises to the top. Without an embedding model, search is keyword-only. Everything else (upload, reading, classification, folders, citations) behaves the same.

## Set the embedding model

1. Connect a model and make it the default. The built-in OpenRouter and OpenAI connections work as they are: Praci uses their fixed API address. For Ollama or any other server, use an **OpenAI-compatible** connection (Settings, Models, Connect a model) with its base URL, for example `http://127.0.0.1:11434/v1`. The embedder reuses the connection's key and calls `{base URL}/embeddings`.
2. Open Settings, Models, expand **Data room search model**, and type the embedding model id in the **Embedding model** field (for example `mxbai-embed-large`). It saves when the field loses focus or on Enter. Clearing it returns to keyword-only search.
3. Open the Data room and accept the AI data sharing prompt again (see "Consent and re-indexing"). Nothing is embedded until you do.

The setting belongs to the default model preference of your space, so each person sets their own.

## Requirements and limits

- **Vectors must have exactly 1024 dimensions.** The database column is `vector(1024)`, and every request sends `dimensions: 1024`. A model that returns another length is rejected.
- **The connection must be the built-in OpenRouter or OpenAI, or an OpenAI-compatible one with a base URL.** OAuth sign-ins such as ChatGPT or Copilot, other built-in providers, and connections without a base URL get no embedder, and search stays keyword-only.
- **Your own public endpoints need an operator setting.** For a user-entered OpenAI-compatible connection, loopback and private-network URLs (Ollama on the same machine or LAN) work as is; a public host needs `RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC=1` on the API and worker, plus HTTPS. The built-in OpenRouter and OpenAI connections do not need it. When an embedder is refused, the server logs one warning, "Data room embeddings disabled; keyword search only".
- The embedding model and the chat model share one connection and one API key.

## Compatible models

Dimension support comes from each provider's documentation. "Native" means the model produces 1024 dimensions without the `dimensions` parameter.

| Route | Model | 1024 dimensions | Notes |
|---|---|---|---|
| Ollama (local, no vendor) | `mxbai-embed-large` | Native | Base URL `http://127.0.0.1:11434/v1`. Pull the model first with `ollama pull mxbai-embed-large`. Recommended offline choice. |
| Ollama | other embedding models | Only if native 1024 | Ollama documents `dimensions` as supported on `/v1/embeddings`, but whether a given model can shrink its output depends on the model. Check the length it returns. |
| OpenRouter | `openai/text-embedding-3-large`, `openai/text-embedding-3-small` | Yes, through `dimensions` (verified live: 1024 returned) | `POST /embeddings` accepts `dimensions`. `GET /embeddings/models` lists the available models. |
| OpenAI direct | `text-embedding-3-large`, `text-embedding-3-small` | Yes, through `dimensions` | Documented as supported by `text-embedding-3` and later. `text-embedding-ada-002` does not support it (fixed 1536) and will not work. |
| Google Gemini | `gemini-embedding-*` | Not through this route | Gemini documents `output_dimensionality` on its own `embedContent` API. Its OpenAI-style `dimensions` field is not documented in the sources checked, so it is untested here. |
| Any other OpenAI-compatible server | any | Only if it honours `dimensions` or is natively 1024 | Test with one upload and confirm search results change after consent. |

Sources: [OpenAI embeddings reference](https://developers.openai.com/api/docs/api-reference/embeddings/create), [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility), [OpenRouter embeddings](https://openrouter.ai/docs/api-reference/embeddings), [Gemini embeddings](https://ai.google.dev/gemini-api/docs/embeddings).

Changing to a different embedding model later is safe: each chunk records the model that made it, and search only compares vectors from the current model.

## Consent and re-indexing

The embedding model is a recipient of your document text, so it is part of the Data room AI data sharing consent. Changing it changes the recipient list, which invalidates the earlier consent.

- Saving a new embedding model does not re-queue anything by itself.
- When you accept the Data room AI data sharing prompt, Praci re-queues classification and indexing for every ready item. Indexing embeds the chunks that have no vector from the current model.
- Until you accept, existing items stay keyword-searchable, and new items are not read by AI at all.

## Privacy and cost

- Every text chunk of every item, plus every search query, is sent to the embedding provider. With a hosted provider that is a disclosure to a third party; with Ollama on your own machine it stays local. The consent prompt names the recipients.
- Cost depends on the provider and the amount of text. The first index of a large Data room embeds every chunk once; after that only new or changed chunks are embedded. See the provider's pricing page for current rates.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Search finds exact words but not meaning | No embedder is active. Check the connection type, base URL, public-endpoint setting, embedding model field, and that consent was re-accepted. |
| Embedding model set, nothing re-indexed | Consent was not re-accepted after the change. Open the Data room and accept the prompt. |
| Model returns the wrong number of dimensions | The embedder raises "returned N dimensions; 1024 required", and the index step catches it on purpose: the item stays `ready` and keyword-searchable. **Nothing is shown in the UI.** The only symptom is that meaning search never improves. Pick a model that supports 1024 dimensions. |
| Endpoint rejects the request (HTTP 400, 404, 422) | Same handling: silent fallback to keyword search. Usually a wrong model id for that endpoint, or a model that rejects `dimensions`. |
| OAuth-connected model (ChatGPT, Copilot, Grok sign-in) | These connections have no `/embeddings` address or API key, so no embedder. Use the built-in OpenRouter or OpenAI connection, or an OpenAI-compatible one. |
| Own public endpoint ignored | For a user-entered OpenAI-compatible connection, set `RAKAZO_OPENAI_COMPAT_ALLOW_PUBLIC=1` and use an `https://` URL. Check the server log for the warning "Data room embeddings disabled; keyword search only". |
| Base URL for Ollama fails | Include the `/v1` path. Praci adds it when no version segment is present. From Docker, `127.0.0.1` is the container itself; use `host.docker.internal` or a LAN address. |

The silent handling of wrong-size vectors is a gap; see [the setup path plan](../plans/setup-path.md).
