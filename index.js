const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const mysql = require('mysql2/promise'); // เปลี่ยนมาใช้ mysql2 แบบ Promise
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const port = 3000;
const SECRET_KEY = 'my_super_secret_key';

app.use(express.json());

// --- 1. ตั้งค่าการเชื่อมต่อ MySQL (Connection Pool) ---
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',           // ใส่ username ของ MySQL (ค่าเริ่มต้น XAMPP คือ root)
  password: 'cpe1234',           // ใส่รหัสผ่านของ MySQL (ค่าเริ่มต้น XAMPP คือไม่มีรหัสผ่าน)
  database: 'flutter_db', // ชื่อ Database ที่เราสร้างเตรียมไว้
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// ตรวจสอบการเชื่อมต่อและสร้างตาราง (ถ้ายังไม่มี)
async function initDB() {
  try {
    const connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);
    console.log('เชื่อมต่อ MySQL และตรวจสอบตารางสำเร็จ');
    connection.release();
  } catch (error) {
    console.error('ไม่สามารถเชื่อมต่อ MySQL ได้ โปรดเช็ก user/password หรือเปิดเซิร์ฟเวอร์หรือยัง:', error.message);
  }
}
initDB();


// --- 2. ตั้งค่า Swagger UI (อัปเดตใหม่) ---
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: { title: 'Auth API (MySQL)', version: '1.0.0' },
    servers: [{ url: `http://localhost:${port}` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }], // บังคับใช้ security นี้กับทุก Endpoint เป็นค่าเริ่มต้น
  },
  apis: ['index.js'],
};
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerJsDoc(swaggerOptions)));

// --- 3. Endpoints สำหรับ Auth ---

/**
 * @swagger
 * /api/register:
 *   post:
 *     summary: สมัครสมาชิกใหม่
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, example: "phu_admin" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       201: { description: สร้างบัญชีสำเร็จ }
 *       400: { description: ชื่อผู้ใช้งานซ้ำ หรือข้อมูลไม่ครบ }
 */
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'กรุณาส่ง username และ password' });

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // บันทึกลง MySQL
    const [result] = await pool.query(
      'INSERT INTO users (username, password) VALUES (?, ?)', 
      [username, hashedPassword]
    );
    
    res.status(201).json({ message: 'สร้างบัญชีสำเร็จ', userId: result.insertId });
  } catch (error) {
    // เช็ก Error Code ของ MySQL กรณี username ซ้ำ
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'ชื่อผู้ใช้งานนี้มีในระบบแล้ว' });
    }
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
});

// ฟังก์ชันด่านตรวจ (Middleware) สำหรับตรวจสอบ Token
const verifyToken = (req, res, next) => {
  // ดึงค่ามาจาก Header ที่ชื่อว่า Authorization
  const authHeader = req.headers['authorization'];
  
  // ถ้าไม่มีการส่งแนบมาด้วย
  if (!authHeader) return res.status(403).json({ error: 'กรุณาส่ง Token มาด้วย' });

  // รูปแบบ Token จะมาเป็นคำว่า "Bearer eyJhbGci..." เราจึงต้องตัดช่องว่างเอาเฉพาะส่วนที่ 2
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'รูปแบบ Token ไม่ถูกต้อง' });

  // ตรวจสอบว่า Token ของแท้และยังไม่หมดอายุใช่ไหม
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token หมดอายุหรือไม่ถูกต้อง' });
    
    // ถ้าผ่าน ให้เก็บข้อมูล user ที่ซ่อนอยู่ใน Token ไว้ในตัวแปร req แล้วปล่อยผ่านไปทำงานต่อได้
    req.user = decoded; 
    next(); 
  });
};

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: เข้าสู่ระบบและรับ Token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, example: "phu_admin" }
 *               password: { type: string, example: "123456" }
 *     responses:
 *       200: { description: เข้าสู่ระบบสำเร็จ ได้รับ Token }
 *       401: { description: รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง }
 */
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // ค้นหาผู้ใช้จาก MySQL
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    
    // ถ้า query แล้วไม่มีข้อมูล
    if (rows.length === 0) return res.status(401).json({ error: 'ไม่พบผู้ใช้งานนี้' });

    const user = rows[0]; // ดึงข้อมูลแถวแรก

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    
    res.json({ message: 'เข้าสู่ระบบสำเร็จ', token: token });
  } catch (error) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
  }
});
/**
 * @swagger
 * /api/profile:
 *   get:
 *     summary: ดูข้อมูลส่วนตัว (ต้องใช้ Token)
 *     responses:
 *       200:
 *         description: แสดงข้อมูลส่วนตัวสำเร็จ
 *       401:
 *         description: ไม่มีสิทธิ์เข้าถึง
 */
// สังเกตว่าเราแทรก verifyToken ไว้ตรงกลาง เพื่อให้มันทำหน้าที่เป็นด่านตรวจ
app.get('/api/profile', verifyToken, (req, res) => {
  res.json({ 
    message: 'ยินดีต้อนรับเข้าสู่พื้นที่หวงห้าม!', 
    user_info: req.user // ข้อมูลนี้ถูกถอดรหัสมาจาก Token ที่ส่งมา
  });
});

app.listen(port, () => {
  console.log(`API Server รันอยู่ที่ http://localhost:${port}`);
});