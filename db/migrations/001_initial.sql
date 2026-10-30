-- WEF Canada admin — initial schema.
--
-- Applied automatically when the site starts (src/instrumentation.ts runs
-- src/server/migrate.ts), or by hand with `npm run db:migrate`. Every
-- migration runs once and is recorded in schema_migrations, so editing this
-- file after it has run anywhere changes nothing there: add 002_*.sql instead.
--
-- Written to run on both MySQL 8 and MariaDB 10.6+ (Hostinger uses MariaDB).
-- JSON is stored in LONGTEXT and parsed by the app, because MariaDB's JSON
-- type is only an alias with a CHECK and the two engines disagree on it.
--
-- Conventions shared by every content table:
--   status      'draft' | 'published' — only published rows reach the site
--   display_order  lower first; ties broken by title/name
--   deleted_at  set = in Trash. Every public query filters it out.
--   *_media_id  FK to media; ON DELETE SET NULL so removing a file can never
--               take the row that used it down with it.

-- ---------------------------------------------------------------------
-- People who can sign in to /admin
-- ---------------------------------------------------------------------
CREATE TABLE admin_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('super_admin','administrator','editor') NOT NULL DEFAULT 'editor',
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server-side sessions. The cookie holds a random token; only its SHA-256
-- is stored, so a leaked database cannot be replayed as a login.
CREATE TABLE admin_sessions (
  id CHAR(64) NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY idx_admin_sessions_user (user_id),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Both login rate limits (per email, per IP) read this one table.
CREATE TABLE login_attempts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_login_attempts_email_time (email, created_at),
  KEY idx_login_attempts_ip_time (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE activity_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  action VARCHAR(40) NOT NULL,
  module VARCHAR(60) NOT NULL,
  details VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_activity_created (created_at, id),
  KEY idx_activity_module (module, created_at),
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Media library. Files live on the server's disk under UPLOAD_DIR, never
-- in git; `path` is relative to it (e.g. "2026/10/3f9c1a2b7e4d5f6a.webp").
-- ---------------------------------------------------------------------
CREATE TABLE media (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  path VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NULL,
  mime VARCHAR(80) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL DEFAULT 0,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  alt VARCHAR(300) NOT NULL DEFAULT '',
  caption VARCHAR(300) NULL,
  source_url VARCHAR(500) NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_media_path (path),
  KEY idx_media_source (source_url(191)),
  KEY idx_media_created (created_at, id),
  CONSTRAINT fk_media_user FOREIGN KEY (created_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Site-wide settings (contact details, name, tagline, socials…) as
-- key/value, so adding a setting never needs a migration.
-- ---------------------------------------------------------------------
CREATE TABLE settings (
  setting_key VARCHAR(80) NOT NULL,
  value TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Editable copy on the built-in pages (home, about, contact…). A row exists
-- only once something has been changed; otherwise the page shows the default
-- from src/server/blocks.ts, which is how "Reset to original" works.
CREATE TABLE content_blocks (
  page_key VARCHAR(60) NOT NULL,
  block_key VARCHAR(80) NOT NULL,
  value MEDIUMTEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  PRIMARY KEY (page_key, block_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- On/off switch and SEO overrides for the built-in pages.
CREATE TABLE core_pages (
  page_key VARCHAR(60) NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  seo_title VARCHAR(200) NULL,
  seo_description VARCHAR(400) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by INT UNSIGNED NULL,
  PRIMARY KEY (page_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pages built in the admin from sections. Served at /<slug> by the catch-all
-- route; `sections` is a JSON array, see src/server/sections.ts.
CREATE TABLE pages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(200) NOT NULL,
  eyebrow VARCHAR(120) NULL,
  lede TEXT NULL,
  sections LONGTEXT NULL,
  seo_title VARCHAR(200) NULL,
  seo_description VARCHAR(400) NULL,
  noindex TINYINT(1) NOT NULL DEFAULT 0,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pages_slug (slug),
  KEY idx_pages_public (status, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Header and footer menus. Footer: top-level rows are the group headings and
-- their children the links. `kind` lets an entry fill itself in: every
-- published project, or every blog category, so adding one updates the menu.
CREATE TABLE nav_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  menu ENUM('header','footer') NOT NULL,
  parent_id INT UNSIGNED NULL,
  kind ENUM('link','auto_projects','auto_categories') NOT NULL DEFAULT 'link',
  label VARCHAR(120) NOT NULL,
  href VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_nav_menu (menu, parent_id, display_order),
  CONSTRAINT fk_nav_parent FOREIGN KEY (parent_id) REFERENCES nav_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Content collections
-- ---------------------------------------------------------------------

-- The photographs that cross-fade at the top of the home page.
CREATE TABLE hero_slides (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label VARCHAR(120) NULL,
  description VARCHAR(300) NOT NULL,
  image_media_id INT UNSIGNED NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_hero_public (status, deleted_at, display_order),
  CONSTRAINT fk_hero_media FOREIGN KEY (image_media_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Program cards. Each row belongs to one of three places, which draw it
-- differently: strip (the home photo strip: title, line, photo), home
-- (the home "Our Programs" rows: badge, lead, points, stats) and mission
-- (the Mission page rows: category, accent, columns, notes). A mission card
-- with a parent_id is a "track" shown as an expandable part of its parent.
-- points, stats and notes hold one item per line; a stats line reads
-- "100 | centers today". columns holds blocks separated by a blank line,
-- each a heading line followed by one item per line.
CREATE TABLE programs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  placement ENUM('strip','home','mission') NOT NULL DEFAULT 'home',
  parent_id INT UNSIGNED NULL,
  title VARCHAR(255) NOT NULL,
  lead TEXT NULL,
  badge VARCHAR(80) NULL,
  category VARCHAR(80) NULL,
  accent VARCHAR(20) NULL,
  points TEXT NULL,
  stats TEXT NULL,
  columns_text TEXT NULL,
  notes TEXT NULL,
  image_media_id INT UNSIGNED NULL,
  post_id INT UNSIGNED NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_programs_public (placement, status, deleted_at, display_order),
  CONSTRAINT fk_programs_parent FOREIGN KEY (parent_id) REFERENCES programs (id) ON DELETE SET NULL,
  CONSTRAINT fk_programs_media FOREIGN KEY (image_media_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Headline figures: the home impact counters, the Mission "at a glance" and
-- the figures under the Donate page's donation form.
CREATE TABLE stats (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  placement ENUM('home','mission','donate') NOT NULL DEFAULT 'home',
  value VARCHAR(40) NOT NULL,
  label VARCHAR(160) NOT NULL,
  note VARCHAR(200) NULL,
  as_of DATE NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_stats_public (placement, status, deleted_at, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every learning center on the map. `name` is the woman who runs it (not
-- recorded for most government-school centers).
CREATE TABLE learning_centers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NULL,
  village VARCHAR(160) NOT NULL,
  region VARCHAR(80) NULL,
  model VARCHAR(80) NULL,
  sponsor VARCHAR(255) NULL,
  enrollment INT UNSIGNED NULL,
  lat DECIMAL(9,6) NULL,
  lon DECIMAL(9,6) NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_centers_public (status, deleted_at, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "Before you give" on the Donate page.
CREATE TABLE faqs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  question VARCHAR(300) NOT NULL,
  answer LONGTEXT NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_faqs_public (status, deleted_at, display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE team_groups (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  heading VARCHAR(160) NOT NULL,
  eyebrow VARCHAR(120) NULL,
  description VARCHAR(500) NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE team_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  group_id INT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  role VARCHAR(160) NULL,
  bio TEXT NULL,
  linkedin_url VARCHAR(500) NULL,
  image_media_id INT UNSIGNED NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_team_public (status, deleted_at, group_id, display_order),
  CONSTRAINT fk_team_group FOREIGN KEY (group_id) REFERENCES team_groups (id) ON DELETE SET NULL,
  CONSTRAINT fk_team_media FOREIGN KEY (image_media_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The filter chips on the Gallery page.
CREATE TABLE gallery_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  label VARCHAR(80) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE gallery_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  media_id INT UNSIGNED NULL,
  caption VARCHAR(300) NULL,
  category_id INT UNSIGNED NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_gallery_public (status, deleted_at, display_order),
  CONSTRAINT fk_gallery_media FOREIGN KEY (media_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT fk_gallery_category FOREIGN KEY (category_id) REFERENCES gallery_categories (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Articles: one posts table, three kinds. `section` decides the URL and
-- the list page: update -> /updates/..., story -> /stories/...,
-- project -> /projects/....
-- ---------------------------------------------------------------------
CREATE TABLE authors (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  role VARCHAR(160) NULL,
  bio TEXT NULL,
  image_media_id INT UNSIGNED NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_authors_media FOREIGN KEY (image_media_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Topics. Each has a page at /topics/<slug> and a filter chip.
CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  title VARCHAR(160) NOT NULL,
  slug VARCHAR(160) NOT NULL,
  description VARCHAR(400) NULL,
  seo_title VARCHAR(200) NULL,
  seo_description VARCHAR(400) NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'published',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE posts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  section ENUM('update','story','project') NOT NULL DEFAULT 'update',
  title VARCHAR(255) NOT NULL,
  card_title VARCHAR(255) NULL,
  slug VARCHAR(200) NOT NULL,
  excerpt TEXT NULL,
  body LONGTEXT NULL,
  author_id INT UNSIGNED NULL,
  image_media_id INT UNSIGNED NULL,
  published_at DATETIME NOT NULL,
  date_label VARCHAR(80) NULL,
  location VARCHAR(200) NULL,
  featured TINYINT(1) NOT NULL DEFAULT 0,
  cta_heading VARCHAR(200) NULL,
  cta_text VARCHAR(400) NULL,
  cta_primary_label VARCHAR(80) NULL,
  cta_primary_url VARCHAR(500) NULL,
  cta_secondary_label VARCHAR(80) NULL,
  cta_secondary_url VARCHAR(500) NULL,
  seo_title VARCHAR(200) NULL,
  seo_description VARCHAR(400) NULL,
  legacy_url VARCHAR(500) NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_posts_slug (section, slug),
  KEY idx_posts_public (section, status, deleted_at, published_at),
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE SET NULL,
  CONSTRAINT fk_posts_media FOREIGN KEY (image_media_id) REFERENCES media (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE programs ADD CONSTRAINT fk_programs_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE SET NULL;

CREATE TABLE post_categories (
  post_id INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, category_id),
  KEY idx_post_categories_category (category_id),
  CONSTRAINT fk_pc_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
  CONSTRAINT fk_pc_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- "The difference your support makes" on the home page.
CREATE TABLE testimonials (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  quote TEXT NOT NULL,
  name VARCHAR(160) NULL,
  context VARCHAR(200) NULL,
  location VARCHAR(160) NULL,
  image_media_id INT UNSIGNED NULL,
  post_id INT UNSIGNED NULL,
  display_order INT NOT NULL DEFAULT 0,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_testimonials_public (status, deleted_at, display_order),
  CONSTRAINT fk_testimonials_media FOREIGN KEY (image_media_id) REFERENCES media (id) ON DELETE SET NULL,
  CONSTRAINT fk_testimonials_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Messages sent through the contact form.
-- ---------------------------------------------------------------------
CREATE TABLE submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  form_type VARCHAR(40) NOT NULL DEFAULT 'contact',
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(60) NULL,
  subject VARCHAR(200) NULL,
  message TEXT NOT NULL,
  status ENUM('new','read','replied','archived') NOT NULL DEFAULT 'new',
  admin_note VARCHAR(1000) NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  handled_by INT UNSIGNED NULL,
  handled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_submissions_status (deleted_at, status, created_at),
  KEY idx_submissions_ip_time (ip_address, created_at),
  CONSTRAINT fk_submissions_user FOREIGN KEY (handled_by) REFERENCES admin_users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Access keys for the Content API (/api/v1), created under Admin -> API Access.
--
-- A key acts as the admin who created it, with that person's role: an
-- editor's key can do what an editor can. Only the key's SHA-256 is stored;
-- the key itself is shown once, when it is created. Deleting the admin
-- deletes their keys.
CREATE TABLE api_tokens (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  token_hint VARCHAR(12) NOT NULL,
  last_used_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_api_tokens_hash (token_hash),
  KEY idx_api_tokens_user (user_id),
  CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id) REFERENCES admin_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Email addresses from the home-page signup and the contact-form opt-in.
-- Listed and exported under Admin -> Newsletter. An address that signs up
-- twice keeps one row; signing up again after unsubscribing re-subscribes.
CREATE TABLE newsletter_subscribers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  name VARCHAR(200) NULL,
  status ENUM('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed',
  source VARCHAR(60) NOT NULL DEFAULT 'homepage',
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_newsletter_email (email),
  KEY idx_newsletter_status (status, created_at),
  KEY idx_newsletter_ip_time (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
