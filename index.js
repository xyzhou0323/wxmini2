const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// ========== 配置（部署时设环境变量） ==========
const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
const MYSQL_PORT = process.env.MYSQL_PORT || 3306;
const MYSQL_USER = process.env.MYSQL_USER || 'root';
const MYSQL_PASS = process.env.MYSQL_PASS || '';
const MYSQL_DB   = process.env.MYSQL_DB   || 'neuroxyz';
const PORT       = process.env.PORT        || 80;

// ========== 数据库连接池 ==========
const pool = mysql.createPool({
  host: MYSQL_HOST, port: MYSQL_PORT, user: MYSQL_USER,
  password: MYSQL_PASS, database: MYSQL_DB,
  waitForConnections: true, connectionLimit: 5
});

// ========== 中间件：提取 openid（云托管自动注入） ==========
function auth(req, res, next) {
  var openid = req.headers['x-wx-openid'];
  if (!openid) return res.status(401).json({ error: '未登录' });
  req.openid = openid;
  next();
}

// ========== API ==========

// 保存结果
app.post('/api/results', auth, async (req, res) => {
  const { testType, testName, summary, resultData, answers, consent } = req.body;
  if (!testType || !testName || !summary || !resultData) {
    return res.status(400).json({ error: '缺少参数' });
  }
  try {
    const [r] = await pool.query(
      'INSERT INTO test_results (openid, test_type, test_name, summary, result_data, answers, consent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.openid, testType, testName, JSON.stringify(summary), JSON.stringify(resultData), answers ? JSON.stringify(answers) : null, consent !== undefined ? (consent ? 1 : 0) : null]
    );
    res.json({ id: r.insertId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '保存失败' });
  }
});

// 获取历史
app.get('/api/results', auth, async (req, res) => {
  const skip = parseInt(req.query.skip) || 0;
  const limit = Math.min(parseInt(req.query.limit) || 20, 50);
  try {
    const [rows] = await pool.query(
      'SELECT id, test_type, test_name, summary, result_data, answers, created_at FROM test_results WHERE openid = ? ORDER BY created_at DESC LIMIT ?, ?',
      [req.openid, skip, limit]
    );
    res.json({ items: rows.map(r => ({
      id: r.id,
      testType: r.test_type,
      testName: r.test_name,
      summary: typeof r.summary === 'string' ? JSON.parse(r.summary) : r.summary,
      resultData: typeof r.result_data === 'string' ? JSON.parse(r.result_data) : r.result_data,
      answers: r.answers ? (typeof r.answers === 'string' ? JSON.parse(r.answers) : r.answers) : null,
      createdAt: r.created_at
    })) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '查询失败' });
  }
});

// 删除
app.delete('/api/results/:id', auth, async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const [r] = await pool.query('DELETE FROM test_results WHERE id = ? AND openid = ?', [id, req.openid]);
    if (r.affectedRows === 0) return res.status(404).json({ error: '记录不存在' });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: '删除失败' });
  }
});

// 批量更新同意状态
function updateConsent(req, res) {
  const { consent } = req.body;
  if (consent === undefined) return res.status(400).json({ error: '缺少 consent 参数' });
  pool.query(
    'UPDATE test_results SET consent = ? WHERE openid = ?',
    [consent ? 1 : 0, req.openid]
  ).then(function(_a) {
    var r = _a[0];
    res.json({ ok: true, updated: r.affectedRows });
  }).catch(function(e) {
    console.error(e);
    res.status(500).json({ error: '更新失败' });
  });
}
app.post('/api/results/consent', auth, updateConsent);
app.patch('/api/results/consent', auth, updateConsent);

// 健康检查
app.get('/api/health', (req, res) => { res.json({ ok: true }); });

// ========== 启动 ==========
app.listen(PORT, () => { console.log('NeuroXYZ server running on port ' + PORT); });
