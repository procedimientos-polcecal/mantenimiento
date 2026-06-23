-- Confirm unconfirmed users
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Enable RLS
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "users_read_own"  ON app_users;
DROP POLICY IF EXISTS "users_read_all"  ON app_users;
DROP POLICY IF EXISTS "admins_write"    ON app_users;

-- Anyone authenticated can read all users (needed for assignment lists)
CREATE POLICY "users_read_all"
  ON app_users FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "admins_write"
  ON app_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin_sistema', 'administrador')
    )
  );
