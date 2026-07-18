require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');

const authRouter = require('./routes/auth');
const apiRouter = require('./routes/api');
const requireAuth = require('./middleware/auth');

const app = express();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json());
app.use(passport.initialize());

app.use('/auth', authRouter);
app.use('/api', requireAuth, apiRouter);

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
