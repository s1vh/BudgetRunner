ALTER TABLE users
  ADD COLUMN guided_tour_completed_at TIMESTAMPTZ;

UPDATE users
   SET preferences = preferences || '{"helpHints": true}'::jsonb
 WHERE NOT (preferences ? 'helpHints');

ALTER TABLE users
  ALTER COLUMN preferences
  SET DEFAULT '{"reducedMotion":false,"ambientEffects":true,"audioReactive":true,"scanlines":true,"compactMode":false,"helpHints":true}'::jsonb;

COMMENT ON COLUMN users.guided_tour_completed_at IS
  'First completion or dismissal of the guided tour. NULL means the tour must auto-start on the next login.';
