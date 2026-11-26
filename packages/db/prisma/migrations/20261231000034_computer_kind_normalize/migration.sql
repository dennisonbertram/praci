-- Computers created with an unsupported SANDBOX_PROVIDER (for example "none") stored that value as their kind, which the API cannot serve.
UPDATE "computers" SET "kind" = 'docker' WHERE "kind" NOT IN ('docker', 'e2b', 'daytona', 'createos', 'box', 'desktop', 'fake');
