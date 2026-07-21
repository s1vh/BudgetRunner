ALTER TABLE users
  ALTER COLUMN locale SET DEFAULT 'en-US';

UPDATE users
   SET locale = 'en-US'
 WHERE locale NOT IN ('es-ES', 'en-US', 'fr-FR', 'de-DE', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR');

ALTER TABLE users
  ADD CONSTRAINT users_supported_locale
  CHECK (locale IN ('es-ES', 'en-US', 'fr-FR', 'de-DE', 'ru-RU', 'zh-CN', 'ja-JP', 'ko-KR'));
