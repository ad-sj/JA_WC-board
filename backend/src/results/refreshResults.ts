import { loadSchedule } from '../schedule/scheduleLoader';
import { loadPreferredResults, writeResultsCsv } from './resultFetcher';
import { getDefaultResultsPath } from './resultLoader';

async function main() {
  const schedule = await loadSchedule();
  const outputPath = getDefaultResultsPath();
  const results = await loadPreferredResults(schedule, outputPath);

  await writeResultsCsv(outputPath, results);

  console.log(`Wrote ${results.length} results to ${outputPath}`);
}

main().catch((err) => {
  console.error('Failed to refresh results', err);
  process.exit(1);
});