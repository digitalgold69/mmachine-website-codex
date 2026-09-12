CREATE TABLE auth_notification_preferences_new (
  user_id TEXT NOT NULL,
  route TEXT NOT NULL CHECK (route IN ('mini','metals','custom','featured','contact')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, route)
);
INSERT INTO auth_notification_preferences_new SELECT user_id, route, created_at FROM auth_notification_preferences;
DROP TABLE auth_notification_preferences;
ALTER TABLE auth_notification_preferences_new RENAME TO auth_notification_preferences;
CREATE INDEX idx_auth_notification_preferences_route ON auth_notification_preferences(route);
