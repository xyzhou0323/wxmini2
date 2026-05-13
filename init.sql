CREATE TABLE IF NOT EXISTS test_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  openid VARCHAR(64) NOT NULL,
  test_type VARCHAR(32) NOT NULL,
  test_name VARCHAR(100) NOT NULL,
  summary JSON NOT NULL,
  result_data JSON NOT NULL,
  answers JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_openid_time (openid, created_at DESC)
);
