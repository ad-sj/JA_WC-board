import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

export interface Prediction {
  username: string;
  matchId: number;
  homeGoals: number;
  awayGoals: number;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_PREDICTIONS_DIR = process.env.PREDICTIONS_DIR ||
  path.join(REPO_ROOT, 'predictions');

export async function loadPredictions(
  predictionsDir: string = DEFAULT_PREDICTIONS_DIR,
): Promise<Prediction[]> {
  let files: string[] = [];
  try {
    files = await fs.promises.readdir(predictionsDir);
  } catch (err) {
    // If the directory does not exist yet, return empty predictions.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }

  const csvFiles = files.filter((f) => f.toLowerCase().endsWith('.csv'));

  const allPredictions: Prediction[] = [];

  for (const fileName of csvFiles) {
    const username = path.basename(fileName, path.extname(fileName));
    const fullPath = path.join(predictionsDir, fileName);
    const fileContent = await fs.promises.readFile(fullPath, 'utf8');

    const parsed: Prediction[] = await parsePredictionFile(
      fileContent,
      username,
    );
    allPredictions.push(...parsed);
  }

  return allPredictions;
}

async function parsePredictionFile(
  csvContent: string,
  username: string,
): Promise<Prediction[]> {
  return new Promise((resolve, reject) => {
    const records: Prediction[] = [];

    const parser = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const seenMatchIds = new Set<number>();

    parser.on('readable', () => {
      let record: any;
      while ((record = parser.read()) !== null) {
        const matchId = parseInt(record['Match'], 10);
        const homeGoals = parseInt(record['HomeGoals'], 10);
        const awayGoals = parseInt(record['AwayGoals'], 10);

        if (
          Number.isNaN(matchId) ||
          Number.isNaN(homeGoals) ||
          Number.isNaN(awayGoals)
        ) {
          continue;
        }

        if (seenMatchIds.has(matchId)) {
          // Skip duplicates from the same file.
          continue;
        }

        seenMatchIds.add(matchId);

        records.push({
          username,
          matchId,
          homeGoals,
          awayGoals,
        });
      }
    });

    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve(records));
  });
}
