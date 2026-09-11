UPDATE users
   SET preferences = preferences || '{"customCursor": true}'::jsonb
 WHERE NOT (preferences ? 'customCursor');

ALTER TABLE users
  ALTER COLUMN preferences
  SET DEFAULT '{"reducedMotion":false,"ambientEffects":true,"audioReactive":true,"scanlines":true,"compactMode":false,"helpHints":true,"customCursor":true}'::jsonb;
