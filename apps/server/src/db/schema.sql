PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  coins INTEGER NOT NULL DEFAULT 0,
  experience INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS farm_slots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  slot_index INTEGER NOT NULL,
  crop_instance_id TEXT,
  locked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(farm_id, slot_index)
);

CREATE TABLE IF NOT EXISTS crop_instances (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  farm_slot_id TEXT REFERENCES farm_slots(id) ON DELETE SET NULL,
  crop_id TEXT NOT NULL,
  planted_at TEXT NOT NULL,
  ready_at TEXT NOT NULL,
  withers_at TEXT NOT NULL,
  harvested_at TEXT,
  status TEXT NOT NULL DEFAULT 'planted' CHECK(status IN ('planted', 'ready', 'withered', 'harvested')),
  meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS inventory_entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, item_id)
);

CREATE TABLE IF NOT EXISTS friendships (
  id TEXT PRIMARY KEY,
  user_id_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK(status IN ('pending', 'accepted', 'blocked', 'removed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TEXT
);

CREATE TABLE IF NOT EXISTS friendship_requests (
  id TEXT PRIMARY KEY,
  requester_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'accepted', 'declined', 'cancelled')),
  requested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS visit_logs (
  id TEXT PRIMARY KEY,
  visitor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visited_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visit_type TEXT NOT NULL DEFAULT 'visit',
  source TEXT NOT NULL DEFAULT 'manual',
  meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS interaction_logs (
  id TEXT PRIMARY KEY,
  visit_log_id TEXT REFERENCES visit_logs(id) ON DELETE SET NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK(interaction_type IN ('steal', 'help')),
  amount INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS message_logs (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  visit_log_id TEXT REFERENCES visit_logs(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL DEFAULT 'text',
  meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  target INTEGER NOT NULL,
  reward_coins INTEGER NOT NULL,
  reward_experience INTEGER NOT NULL,
  repeatable INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'config',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_progress (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('locked', 'active', 'completed', 'claimed')),
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, task_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_table TEXT,
  source_id TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  meta_json TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id TEXT PRIMARY KEY,
  leaderboard_id TEXT NOT NULL,
  leaderboard_name TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  period TEXT NOT NULL,
  descending INTEGER NOT NULL DEFAULT 1,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  metric_value INTEGER NOT NULL DEFAULT 0,
  rank_position INTEGER NOT NULL DEFAULT 0,
  period_started_at TEXT,
  period_ended_at TEXT,
  refreshed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  meta_json TEXT NOT NULL DEFAULT '{}',
  UNIQUE(leaderboard_id, user_id, period_started_at, period_ended_at)
);

CREATE INDEX IF NOT EXISTS idx_farm_slots_farm_id ON farm_slots(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_instances_farm_id ON crop_instances(farm_id);
CREATE INDEX IF NOT EXISTS idx_crop_instances_slot_id ON crop_instances(farm_slot_id);
CREATE INDEX IF NOT EXISTS idx_inventory_entries_user_id ON inventory_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships(user_id_a, user_id_b);
CREATE INDEX IF NOT EXISTS idx_friendship_requests_pair ON friendship_requests(requester_user_id, addressee_user_id);
CREATE INDEX IF NOT EXISTS idx_visit_logs_pair ON visit_logs(visitor_user_id, visited_user_id);
CREATE INDEX IF NOT EXISTS idx_interaction_logs_visit ON interaction_logs(visit_log_id);
CREATE INDEX IF NOT EXISTS idx_message_logs_conversation ON message_logs(conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_task_progress_user_id ON task_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_entries_lookup ON leaderboard_entries(leaderboard_id, period, rank_position);
