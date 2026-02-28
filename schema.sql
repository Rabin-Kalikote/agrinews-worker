CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  headline TEXT UNIQUE,
  description TEXT,
  image_url TEXT,
  article_url TEXT,
  date TEXT,
  source TEXT,
  content TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);