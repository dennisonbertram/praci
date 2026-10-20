---
title: Backups and export
description: Take your data with you, and back up a self-hosted server.
group: Run it
order: 31
---

There are two different things here. **Export my data** gives a person a readable copy of what they own. A **backup** protects a whole server so you can restore it.

## Export my data

In **Settings, General**, press **Request export**. Praci builds a zip file in the background, and a **Download** button appears when it is ready. The file stays available for 7 days.

It contains your bots, conversations, memories and other records as JSON, plus the original files from your Data room. It leaves out secrets, credentials, access tokens, mail bodies and run logs. In a shared space, it includes only what you own. It is meant to be portable, so it is not something you can restore into Praci.

## Back up a self-hosted server

On your own server, the backup script saves everything that is needed to restore the instance:

```bash
./scripts/backup.sh
```

It writes a dump of the Postgres database, an archive of the `data/` folder and every object in your S3-compatible bucket, into `backups/<stamp>/`. If any part fails, the script fails, and you should discard that folder. To restore:

```bash
./scripts/restore.sh backups/<stamp>
```

Restore into an empty database with the application stopped. Keep your `ENCRYPTION_KEY`, because it is needed to read stored credentials after a restore. The [self-hosting guide](https://github.com/dennisonbertram/praci/blob/main/docs/self-host.md#backup) has the details for the production layout.

Backup models in Settings are a different thing: they are fallback AI models, not copies of your data.
