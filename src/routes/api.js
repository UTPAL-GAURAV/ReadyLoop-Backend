const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/me', (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name });
});

// ── Job Applications ────────────────────────────────────────────────────────

router.get('/applications', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM job_applications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/applications', async (req, res) => {
  const { company, role, level, geography, jd_text, plan_gist } = req.body;
  if (!company || !role || !jd_text) {
    return res.status(400).json({ error: 'company, role, and jd_text are required' });
  }

  try {
    // Generate short_id: count existing apps for this user+company, then format
    const { rows: existing } = await pool.query(
      `SELECT COUNT(*) FROM job_applications WHERE user_id = $1 AND company ILIKE $2`,
      [req.user.id, company]
    );
    const seq = parseInt(existing[0].count, 10) + 1;
    const prefix = company.replace(/\s+/g, '').slice(0, 10).toUpperCase();
    const short_id = `${prefix}-${String(seq).padStart(3, '0')}`;

    const { rows } = await pool.query(
      `INSERT INTO job_applications (user_id, short_id, company, role, level, geography, jd_text, plan_gist)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.user.id, short_id, company, role, level || null, geography || null, jd_text, plan_gist || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/applications/:id', async (req, res) => {
  try {
    const { rows: app } = await pool.query(
      'SELECT * FROM job_applications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!app.length) return res.status(404).json({ error: 'Not found' });

    const { rows: rounds } = await pool.query(
      'SELECT * FROM interview_rounds WHERE job_application_id = $1 ORDER BY order_index',
      [app[0].id]
    );
    res.json({ ...app[0], rounds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Interview Rounds ────────────────────────────────────────────────────────

router.get('/applications/:id/rounds', async (req, res) => {
  try {
    const { rows: app } = await pool.query(
      'SELECT id FROM job_applications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!app.length) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      'SELECT * FROM interview_rounds WHERE job_application_id = $1 ORDER BY order_index',
      [app[0].id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/applications/:id/rounds', async (req, res) => {
  const {
    round_type, order_index, status, confidence_score,
    estimated_duration_minutes, question_count, depth_calibration_rationale,
  } = req.body;

  if (!round_type) return res.status(400).json({ error: 'round_type is required' });

  try {
    const { rows: app } = await pool.query(
      'SELECT id FROM job_applications WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!app.length) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      `INSERT INTO interview_rounds
         (job_application_id, round_type, order_index, status, confidence_score,
          estimated_duration_minutes, question_count, depth_calibration_rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        app[0].id, round_type, order_index ?? null, status ?? 'not_attempted',
        confidence_score ?? null, estimated_duration_minutes ?? null,
        question_count ?? null, depth_calibration_rationale ?? null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/rounds/:id', async (req, res) => {
  const allowed = ['status', 'confidence_score', 'estimated_duration_minutes', 'question_count', 'depth_calibration_rationale', 'order_index'];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  try {
    // Verify ownership via join
    const { rows: check } = await pool.query(
      `SELECT ir.id FROM interview_rounds ir
       JOIN job_applications ja ON ja.id = ir.job_application_id
       WHERE ir.id = $1 AND ja.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'Not found' });

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = [req.params.id, ...updates.map(([, v]) => v)];
    const { rows } = await pool.query(
      `UPDATE interview_rounds SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Question Sets ───────────────────────────────────────────────────────────

router.get('/rounds/:id/question-sets', async (req, res) => {
  try {
    const { rows: check } = await pool.query(
      `SELECT ir.id FROM interview_rounds ir
       JOIN job_applications ja ON ja.id = ir.job_application_id
       WHERE ir.id = $1 AND ja.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      'SELECT * FROM question_sets WHERE round_id = $1 ORDER BY attempt_number',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/rounds/:id/question-sets', async (req, res) => {
  const { attempt_number, questions, difficulty_profile } = req.body;
  if (!questions || !difficulty_profile) {
    return res.status(400).json({ error: 'questions and difficulty_profile are required' });
  }

  try {
    const { rows: check } = await pool.query(
      `SELECT ir.id FROM interview_rounds ir
       JOIN job_applications ja ON ja.id = ir.job_application_id
       WHERE ir.id = $1 AND ja.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      `INSERT INTO question_sets (round_id, attempt_number, questions, difficulty_profile)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.params.id, attempt_number ?? 1, JSON.stringify(questions), JSON.stringify(difficulty_profile)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Round Attempts ──────────────────────────────────────────────────────────

router.post('/rounds/:id/attempts', async (req, res) => {
  const { question_set_id } = req.body;

  try {
    const { rows: check } = await pool.query(
      `SELECT ir.id FROM interview_rounds ir
       JOIN job_applications ja ON ja.id = ir.job_application_id
       WHERE ir.id = $1 AND ja.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      `INSERT INTO round_attempts (round_id, question_set_id, started_at)
       VALUES ($1, $2, now())
       RETURNING *`,
      [req.params.id, question_set_id ?? null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/attempts/:id', async (req, res) => {
  const allowed = ['confidence_score', 'status', 'completed_at'];
  const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return res.status(400).json({ error: 'No valid fields to update' });

  try {
    const { rows: check } = await pool.query(
      `SELECT ra.id FROM round_attempts ra
       JOIN interview_rounds ir ON ir.id = ra.round_id
       JOIN job_applications ja ON ja.id = ir.job_application_id
       WHERE ra.id = $1 AND ja.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'Not found' });

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = [req.params.id, ...updates.map(([, v]) => v)];
    const { rows } = await pool.query(
      `UPDATE round_attempts SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Question Attempts ───────────────────────────────────────────────────────

router.post('/attempts/:id/questions', async (req, res) => {
  const { question_id, user_answer, strong_points, missed_points, interviewer_expectation, follow_up_count } = req.body;
  if (!question_id) return res.status(400).json({ error: 'question_id is required' });

  try {
    const { rows: check } = await pool.query(
      `SELECT ra.id FROM round_attempts ra
       JOIN interview_rounds ir ON ir.id = ra.round_id
       JOIN job_applications ja ON ja.id = ir.job_application_id
       WHERE ra.id = $1 AND ja.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      `INSERT INTO question_attempts
         (round_attempt_id, question_id, user_answer, strong_points, missed_points, interviewer_expectation, follow_up_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        req.params.id, question_id, user_answer ?? null,
        strong_points ? JSON.stringify(strong_points) : null,
        missed_points ? JSON.stringify(missed_points) : null,
        interviewer_expectation ?? null, follow_up_count ?? 0,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/attempts/:id/questions', async (req, res) => {
  try {
    const { rows: check } = await pool.query(
      `SELECT ra.id FROM round_attempts ra
       JOIN interview_rounds ir ON ir.id = ra.round_id
       JOIN job_applications ja ON ja.id = ir.job_application_id
       WHERE ra.id = $1 AND ja.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!check.length) return res.status(404).json({ error: 'Not found' });

    const { rows } = await pool.query(
      'SELECT * FROM question_attempts WHERE round_attempt_id = $1 ORDER BY created_at',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
