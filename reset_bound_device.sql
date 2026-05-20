UPDATE registered_devices
SET
  is_bound = FALSE,
  device_uuid = 'ADMIN_HT_SCANQA30_RESET',
  fingerprint_hash = 'PRE_REGISTERED_HT_SCANQA30',
  platform = NULL,
  user_agent = NULL,
  screen_resolution = NULL,
  last_seen_at = NULL,
  updated_at = NOW()
WHERE device_code = 'HT_SCANQA30';

UPDATE registered_devices
SET
  is_bound = FALSE,
  device_uuid = 'ADMIN_HT_SCANQA31_RESET',
  fingerprint_hash = 'PRE_REGISTERED_HT_SCANQA31',
  platform = NULL,
  user_agent = NULL,
  screen_resolution = NULL,
  last_seen_at = NULL,
  updated_at = NOW()
WHERE device_code = 'HT_SCANQA31';