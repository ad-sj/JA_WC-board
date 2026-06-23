import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import type { GroupMatch } from '../schedule/scheduleLoader';

export interface MatchResult {
  matchId: number;
  homeTeam?: string;
  awayTeam?: string;
  homeScore: number;
  awayScore: number;
}

const REPO_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_RESULTS_PATH = path.resolve(
  process.env.RESULTS_FILE ||
    path.join(REPO_ROOT, 'temp/results.csv'),
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
          const homeTeam = normalizeOptionalTeamName(record['HomeTeam']);
          const awayTeam = normalizeOptionalTeamName(record['AwayTeam']);

          if (
            Number.isNaN(matchId) ||
            Number.isNaN(homeScore) ||
            Number.isNaN(awayScore)
          ) {
            continue;
          }

          records.push({
            matchId,
            homeTeam,
            awayTeam,
            homeScore,
            awayScore,
          });
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
  now: number = Date.now(),
): GroupMatch[] {
  const resultById = new Map<number, MatchResult>();
  const resultByTeams = new Map<string, MatchResult>();
  for (const r of results) {
    resultById.set(r.matchId, r);
    if (r.homeTeam && r.awayTeam) {
      resultByTeams.set(buildTeamPairKey(r.homeTeam, r.awayTeam), r);
    }
  }

  return matches.map((match) => {
    const byId = resultById.get(match.matchId);
    const resolved = resolveResultForMatch(match, byId, resultByTeams);
    if (resolved) {
      return {
        ...match,
        status: 'finished',
        homeScore: resolved.homeScore,
        awayScore: resolved.awayScore,
      };
    }

    // No result yet: derive whether the match is currently in progress from its
    // kickoff time so the board can show live matches before final scores publish.
    return {
      ...match,
      status: deriveStatusFromKickoff(match.kickoffLocal, now),
    };
  });
}

// Window after kickoff during which a match without a published result is treated
// as "live" (90 min play + half-time + stoppage + a safety buffer).
const LIVE_WINDOW_MS = 150 * 60 * 1000;

function deriveStatusFromKickoff(
  kickoffLocal: string,
  now: number,
): GroupMatch['status'] {
  // kickoffLocal is stored as Europe/Stockholm local time (CEST, UTC+2 in June).
  const kickoffMs = Date.parse(`${kickoffLocal}+02:00`);
  if (Number.isNaN(kickoffMs)) {
    return 'scheduled';
  }

  if (now < kickoffMs) {
    return 'scheduled';
  }

  if (now < kickoffMs + LIVE_WINDOW_MS) {
    return 'live';
  }

  return 'scheduled';
}

function normalizeOptionalTeamName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeTeamName(team: string): string {
  return team
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildTeamPairKey(homeTeam: string, awayTeam: string): string {
  return [normalizeTeamName(homeTeam), normalizeTeamName(awayTeam)].sort().join('|');
}

function resolveResultForMatch(
  match: GroupMatch,
  resultById: MatchResult | undefined,
  resultByTeams: Map<string, MatchResult>,
): MatchResult | null {
  if (resultById) {
    const orientedById = orientResultToMatch(match, resultById);
    if (orientedById) {
      return orientedById;
    }
  }

  const byTeams = resultByTeams.get(buildTeamPairKey(match.homeTeam, match.awayTeam));
  if (!byTeams) {
    return null;
  }

  return orientResultToMatch(match, byTeams);
}

function orientResultToMatch(
  match: GroupMatch,
  result: MatchResult,
): MatchResult | null {
  if (!result.homeTeam || !result.awayTeam) {
    return result;
  }

  const matchHome = normalizeTeamName(match.homeTeam);
  const matchAway = normalizeTeamName(match.awayTeam);
  const resultHome = normalizeTeamName(result.homeTeam);
  const resultAway = normalizeTeamName(result.awayTeam);

  if (resultHome === matchHome && resultAway === matchAway) {
    return result;
  }

  if (resultHome === matchAway && resultAway === matchHome) {
    return {
      ...result,
      homeScore: result.awayScore,
      awayScore: result.homeScore,
    };
  }

  return null;
}
