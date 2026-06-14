import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import type { GroupMatch } from '../schedule/scheduleLoader';

export interface MatchResult {
  matchId: number;
  homeScore: number;
  awayScore: number;
}

const DEFAULT_RESULTS_PATH = path.resolve(
  process.env.RESULTS_FILE ||
    '/home/adam/Documents/JA_WC-board/temp/results.csv',
);

export function getDefaultResultsPath(): string {
  return DEFAULT_RESULTS_PATH;
}

export async function loadResults(
  resultsPath: string = DEFAULT_RESULTS_PATH,
): Promise<MatchResult[]> {
  try {
    const csvContent = await fs.promises.readFile(resultsPath, 'utf8');

    return new Promise((resolve, reject) => {
      const records: MatchResult[] = [];

      const parser = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      parser.on('readable', () => {
        let record: any;
        while ((record = parser.read()) !== null) {
          const matchId = parseInt(record['Match'], 10);
          const homeScore = parseInt(record['HomeGoals'], 10);
          const awayScore = parseInt(record['AwayGoals'], 10);

          if (
            Number.isNaN(matchId) ||
            Number.isNaN(homeScore) ||
            Number.isNaN(awayScore)
          ) {
            continue;
          }

          records.push({ matchId, homeScore, awayScore });
        }
      });

      parser.on('error', (err) => reject(err));
      parser.on('end', () => resolve(records));
    });
  } catch (err) {
    // If file is missing, treat as no results yet.
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export function applyResultsToMatches(
  matches: GroupMatch[],
  results: MatchResult[],
): GroupMatch[] {
  if (results.length === 0) {
    return matches;
  }

  const resultById = new Map<number, MatchResult>();
  for (const r of results) {
    resultById.set(r.matchId, r);
  }

  return matches.map((match) => {
    const r = resultById.get(match.matchId);
    if (!r) {
      return match;
    }

    return {
      ...match,
      status: 'finished',
      homeScore: r.homeScore,
      awayScore: r.awayScore,
    };
  });
}
