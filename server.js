const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDatabase } = require('./database');

// Initialize database schema
initDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Security Headers via Helmet (with permissive CSP for CDN Chart libraries & UI icons)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"] // Prevent Clickjacking
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS Policy
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  })
);

// 3. Body parser with strict payload size limits (prevent DoS)
app.use(express.json({ limit: '500kb' }));
app.use(express.urlencoded({ extended: true, limit: '500kb' }));

// 4. Global API Rate Limiter
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'คำขอเข้าใช้งานระบบมากเกินขีดจำกัด กรุณารอสักครู่' }
});
app.use('/api/', globalApiLimiter);

// 5. Mount API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/patients', require('./routes/patients'));
app.use('/api/patients', require('./routes/records'));
app.use('/api/patients', require('./routes/analytics'));
app.use('/api/audit-logs', require('./routes/audit'));

// 6. Serve Frontend Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for Single Page Application
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Secure Error Handler (No sensitive stack trace leak)
app.use((err, req, res, next) => {
  console.error('Unhandled System Error:', err);
  res.status(err.status || 500).json({
    error: 'เกิดข้อผิดพลาดภายในระบบ กรุณาติดต่อผู้ดูแลระบบ'
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🏥 DM Remission Health Application Running Successfully!`);
  console.log(`🌐 Local URL: http://localhost:${PORT}`);
  console.log(`🛡️ Enterprise Security & OWASP Protections Active`);
  console.log(`====================================================`);
});
