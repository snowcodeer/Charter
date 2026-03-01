CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(device_id)
);

CREATE TABLE IF NOT EXISTS passports (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  nationality TEXT NOT NULL,
  passport_number TEXT,
  expiry_date TEXT,
  issuing_country TEXT NOT NULL,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS google_tokens (
  device_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date INTEGER NOT NULL,
  email TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
