import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { loadSchedule } from './schedule/scheduleLoader';
import { loadPredictions } from './predictions/predictionLoader';
import { buildLeaderboard, buildUserSummary } from './scoring/scoringEngine';
import {
  applyResultsToMatches,
  getDefaultResultsPath,
  loadResults,
} from './results/resultLoader';
import {
  loadPreferredResults,
  writeResultsCsv,
} from './results/resultFetcher';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

async function loadMatchesWithResults() {
  const [schedule, results] = await Promise.all([
    loadSchedule(),
    loadResults(),
  ]);

  return applyResultsToMatches(schedule, results);
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/matches', async (_req, res) => {
  try {
    const matches = await loadMatchesWithResults();
    res.json(matches);
  } catch (err) {
    console.error('Failed to load schedule', err);
    res.status(500).json({ error: 'Failed to load schedule' });
  }
});

app.get('/api/leaderboard', async (_req, res) => {
  try {
    const [matches, predictions] = await Promise.all([
      loadMatchesWithResults(),
      loadPredictions(),
    ]);

    const leaderboard = buildLeaderboard(matches, predictions);
    res.json(leaderboard);
  } catch (err) {
    console.error('Failed to build leaderboard', err);
    res.status(500).json({ error: 'Failed to build leaderboard' });
  }
});

app.get('/api/users/:username', async (req, res) => {
  const username = req.params.username;

  try {
    const [matches, predictions] = await Promise.all([
      loadMatchesWithResults(),
      loadPredictions(),
    ]);

    const summary = buildUserSummary(username, matches, predictions);
    res.json(summary);
  } catch (err) {
    console.error('Failed to build user summary', err);
    res.status(500).json({ error: 'Failed to build user summary' });
  }
});

app.post('/api/admin/refresh-results', async (_req, res) => {
  try {
    const schedule = await loadSchedule();
    const results = await loadPreferredResults(schedule);

    await writeResultsCsv(getDefaultResultsPath(), results);

    res.json({
      updated: true,
      resultCount: results.length,
    });
  } catch (err) {
    console.error('Failed to refresh results', err);
    res.status(500).json({ error: 'Failed to refresh results' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server listening on port ${PORT}`);
});
