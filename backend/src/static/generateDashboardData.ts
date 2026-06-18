import fs from 'fs';
import path from 'path';
import { loadSchedule } from '../schedule/scheduleLoader';
import { loadPredictions } from '../predictions/predictionLoader';
import { buildLeaderboard, buildUserSummary } from '../scoring/scoringEngine';
import { applyResultsToMatches, loadResults } from '../results/resultLoader';

interface StaticDashboardData {
  generatedAt: string;
  matches: Awaited<ReturnType<typeof loadSchedule>>;
  leaderboard: ReturnType<typeof buildLeaderboard>;
  userSummaries: Record<string, ReturnType<typeof buildUserSummary>>;
}

const OUTPUT_PATH = path.resolve(
  process.env.STATIC_DASHBOARD_OUTPUT ||
    path.join(__dirname, '../../../frontend/public/data/dashboard.json'),
);

async function generateDashboardData(): Promise<StaticDashboardData> {
  const schedule = await loadSchedule();
  const results = await loadResults();
  const matches = applyResultsToMatches(schedule, results);
  const predictions = await loadPredictions();
  const leaderboard = buildLeaderboard(matches, predictions);

  const userSummaries = Object.fromEntries(
    leaderboard.map((entry) => [
      entry.username,
      buildUserSummary(entry.username, matches, predictions),
    ]),
  );

  return {
    generatedAt: new Date().toISOString(),
    matches,
    leaderboard,
    userSummaries,
  };
}

async function main() {
  const dashboardData = await generateDashboardData();

  await fs.promises.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.promises.writeFile(
    OUTPUT_PATH,
    `${JSON.stringify(dashboardData, null, 2)}\n`,
    'utf8',
  );

  console.log(`Wrote static dashboard data to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed to generate static dashboard data', err);
  process.exit(1);
});