---
title: Data room
description: One searchable place for contracts, board decks and investor documents.
group: Your company
order: 14
---

The Data room is where your company documents live: contracts, board decks, offer letters, invoices, bank statements. Drop a file in and Praci reads it, works out what it is, and files it in a folder. Everything is searchable, and every bot in your space can search it.

![The Praci Data room with a folder tree and a list of documents](/docs/data-room.webp)

*Demo data.*

## Add documents

- **Drag and drop** files onto the page, or use **Add files**.
- **Import** from Google Drive, from Box, or from the attachments in your Gmail. Pick the files you want and import them.
- Bots can add files too, for example when you ask a bot to save an attachment.

Each document shows a status while Praci works on it, such as **Reading**. If a file cannot be read, for example a damaged PDF, it shows **Failed** with a **Try again** button.

## Find things

Search looks in names and in document text, and you can filter by type, party and document date. If you set an embedding model, search also matches by meaning: a search for "ending our rental agreement" can find a lease clause about cancellation. Without one, search matches the words you type. See [Settings](/docs/settings).

**Ask** opens an agent that can search and read the room for you.

## Folders and auto-sort

Folders can be made by hand. **Auto-sort** proposes moves, renames and merges to tidy your folders, and shows the list first. Nothing changes until you press **Apply**.

## AI access

Reading, tagging and indexing documents sends document text to the AI service you chose. The first time you open the Data room, Praci asks you to allow this and names the services that will receive the text. Until you allow it, files are stored but not read. If you later change the chat or embedding model, you are asked again.

If you want nothing to leave your machine, use a model server you run yourself. See [Privacy and safety](/docs/privacy-and-safety).

## Set up on a self-hosted server

On your own server, the Data room needs the worker process to be running, Postgres with the pgvector extension (the Docker images include it), and a default model. To read images and scanned PDFs, the default model must accept images. Files go to local disk, or to S3-compatible storage if you configure it. The full list of steps is in the [Data room guide](https://github.com/dennisonbertram/praci/blob/main/docs/data-room/README.md).
