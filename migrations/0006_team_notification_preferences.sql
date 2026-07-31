CREATE TABLE IF NOT EXISTS auth_notification_preferences (
  user_id TEXT NOT NULL,
  route TEXT NOT NULL CHECK (route IN ('mini', 'metals', 'custom', 'featured')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, route)
);

CREATE INDEX IF NOT EXISTS idx_auth_notification_preferences_route
  ON auth_notification_preferences(route);
