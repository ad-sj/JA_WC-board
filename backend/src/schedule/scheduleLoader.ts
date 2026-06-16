import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

export type MatchStatus = 'scheduled' | 'live' | 'finished';

export interface GroupMatch {
  matchId: number;
  dateRaw: string; // e.g. "11 juni"
  timeRaw: string; // e.g. "21:00"
  kickoffLocal: string; // ISO string in local time for 2026
  homeTeam: string;
  awayTeam: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_SCHEDULE_PATH = path.resolve(
  process.env.MATCH_SCHEDULE_FILE ||
    path.join(REPO_ROOT, 'temp/matches.csv'),
);

export async function loadSchedule(
  schedulePath: string = DEFAULT_SCHEDULE_PATH,
): Promise<GroupMatch[]> {
  const csvContent = await fs.promises.readFile(schedulePath, 'utf8');

  return new Promise((resolve, reject) => {
    const records: GroupMatch[] = [];

    const parser = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    parser.on('readable', () => {
      let record: any;
      while ((record = parser.read()) !== null) {
        const matchId = parseInt(record['Match'], 10);
        if (Number.isNaN(matchId)) {
          continue;
        }

        const dateRaw = record['Datum'];
        const timeRaw = record['Tid'];
        const homeTeam = record['Hemma'];
        const awayTeam = record['Borta'];

        const kickoffLocal = buildKickoffIso(dateRaw, timeRaw);

        const homeScore = record['Resultat']
          ? parseResultScore(record['Resultat']).home
          : null;
        const awayScore = record['Resultat']
          ? parseResultScore(record['Resultat']).away
          : null;

        const status: MatchStatus = homeScore !== null && awayScore !== null
          ? 'finished'
          : 'scheduled';

        records.push({
          matchId,
          dateRaw,
          timeRaw,
          kickoffLocal,
          homeTeam,
          awayTeam,
          status,
          homeScore,
          awayScore,
        });
      }
    });

    parser.on('error', (err) => {
      reject(err);
    });

    parser.on('end', () => {
      resolve(records);
    });
  });
}

function buildKickoffIso(dateRaw: string, timeRaw: string): string {
  // dateRaw example: "11 juni"
  // We assume all dates are in June 2026.
  const dayMatch = dateRaw.match(/\d+/);
  const day = dayMatch ? dayMatch[0].padStart(2, '0') : '01';

  const [hourStr, minuteStr] = timeRaw.split(':');
  const hour = hourStr.padStart(2, '0');
  const minute = minuteStr.padStart(2, '0');

  // Interpret as Europe/Stockholm local time by convention; here we store as ISO without timezone conversion.
  // e.g. 2026-06-11T21:00:00
  return `2026-06-${day}T${hour}:${minute}:00`;
}

function parseResultScore(result: string): { home: number; away: number } {
  // Expect format like "2-1"; fall back to nulls if malformed.
  const parts = result.split('-');
  if (parts.length !== 2) {
    return { home: NaN, away: NaN };
  }
  const home = parseInt(parts[0].trim(), 10);
  const away = parseInt(parts[1].trim(), 10);
  return { home, away };
}
