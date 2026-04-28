-- Undo migration for user_profiles table
DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
DROP FUNCTION IF EXISTS update_user_profiles_updated_at();
DROP TABLE IF EXISTS user_profiles;
