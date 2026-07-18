const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const { query: dbQuery } = require('../db');

const router = express.Router();

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/auth/callback',
  },
  async (_accessToken, _refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      const name = profile.displayName;

      const { rows } = await dbQuery(
        `INSERT INTO users (google_id, email, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (google_id) DO UPDATE SET name = EXCLUDED.name
         RETURNING *`,
        [googleId, email, name]
      );
      done(null, rows[0]);
    } catch (err) {
      done(err);
    }
  }
));

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get(
  '/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/?auth=failed` }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, name: req.user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`${process.env.FRONTEND_URL}/#token=${token}`);
  }
);

module.exports = router;
