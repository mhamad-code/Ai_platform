-- Gateway schema (D1 / SQLite). Applied by `wrangler d1 execute`.

CREATE TABLE IF NOT EXISTS credentials (
  client      TEXT    NOT NULL,   -- Firebase uid (verified) or anonymous client id
  provider    TEXT    NOT NULL,   -- openrouter | openai | anthropic | ...
  ciphertext  TEXT    NOT NULL,   -- AES-GCM, key derived from GATEWAY_SECRET
  hint        TEXT    NOT NULL,   -- non-reversible display hint, e.g. "sk-…A1b2"
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (client, provider)
);

CREATE TABLE IF NOT EXISTS tests (
  client      TEXT    NOT NULL,
  provider    TEXT    NOT NULL,
  ok          INTEGER NOT NULL,
  message     TEXT    NOT NULL,
  models      INTEGER NOT NULL DEFAULT 0,
  tested_at   INTEGER NOT NULL,
  PRIMARY KEY (client, provider)
);

CREATE TABLE IF NOT EXISTS integrations (
  client      TEXT    NOT NULL,
  service     TEXT    NOT NULL,   -- github | gitlab | notion | ...
  ciphertext  TEXT    NOT NULL,   -- access token (encrypted)
  account     TEXT,
  scopes      TEXT,               -- comma separated
  verified    INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (client, service)
);

CREATE TABLE IF NOT EXISTS oauth_state (
  state       TEXT    PRIMARY KEY,
  client      TEXT    NOT NULL,
  service     TEXT    NOT NULL,
  redirect    TEXT    NOT NULL,
  created_at  INTEGER NOT NULL
);
