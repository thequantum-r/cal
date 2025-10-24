-- Disable the automatic auth trigger that creates users in the users table
-- This allows us to control user creation manually in the auth callback

-- Drop the trigger that automatically creates users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Optionally, you can also drop the function if you want to clean up completely
-- DROP FUNCTION IF EXISTS public.handle_new_user();

-- This ensures that users are only created when they are properly invited
-- and the auth callback logic handles the creation













