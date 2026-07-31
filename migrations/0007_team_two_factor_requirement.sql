ALTER TABLE auth_users
  ADD COLUMN require_two_factor_setup INTEGER NOT NULL DEFAULT 0;
