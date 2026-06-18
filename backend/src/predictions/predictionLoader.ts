import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import { loadSchedule, type GroupMatch } from '../schedule/scheduleLoader';

export interface Prediction {
  username: string;
  matchId: number;
  homeGoals: number;
  awayGoals: number;
}

interface ResolvedPredictionMatch {
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
  const schedule = await loadSchedule();
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
      schedule,
    );
    allPredictions.push(...parsed);
  }

  return allPredictions;
}

async function parsePredictionFile(
  csvContent: string,
  username: string,
  schedule: GroupMatch[],
): Promise<Prediction[]> {
  return new Promise((resolve, reject) => {
    const records: Prediction[] = [];
    const scheduleById = new Map<number, GroupMatch>();
    const scheduleByTeams = new Map<string, GroupMatch>();

    for (const match of schedule) {
      scheduleById.set(match.matchId, match);
      scheduleByTeams.set(buildTeamPairKey(match.homeTeam, match.awayTeam), match);
    }

    const parser = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const seenMatchIds = new Set<number>();

    parser.on('readable', () => {
      let record: any;
      while ((record = parser.read()) !== null) {
        const homeGoals = parseInt(
          record['HomeGoals'] ?? record['PredictedHomeGoals'],
          10,
        );
        const awayGoals = parseInt(
          record['AwayGoals'] ?? record['PredictedAwayGoals'],
          10,
        );

        if (
          Number.isNaN(homeGoals) ||
          Number.isNaN(awayGoals)
        ) {
          continue;
        }

        const resolvedMatch = resolvePredictionMatch(
          record,
          homeGoals,
          awayGoals,
          scheduleById,
          scheduleByTeams,
        );

        if (!resolvedMatch) {
          continue;
        }

        if (seenMatchIds.has(resolvedMatch.matchId)) {
          // Skip duplicates from the same file.
          continue;
        }

        seenMatchIds.add(resolvedMatch.matchId);

        records.push({
          username,
          matchId: resolvedMatch.matchId,
          homeGoals: resolvedMatch.homeGoals,
          awayGoals: resolvedMatch.awayGoals,
        });
      }
    });

    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve(records));
  });
}

function resolvePredictionMatch(
  record: Record<string, unknown>,
  homeGoals: number,
  awayGoals: number,
  scheduleById: Map<number, GroupMatch>,
  scheduleByTeams: Map<string, GroupMatch>,
): ResolvedPredictionMatch | null {
  const matchIdCandidate = parseInt(String(record['Match'] ?? ''), 10);
  const homeTeam = normalizeOptionalTeamName(record['HomeTeam'] ?? record['Hemma']);
  const awayTeam = normalizeOptionalTeamName(record['AwayTeam'] ?? record['Borta']);

  if (homeTeam && awayTeam) {
    const byId = Number.isNaN(matchIdCandidate)
      ? undefined
      : scheduleById.get(matchIdCandidate);

    if (byId) {
      const orientedById = orientPredictionToMatch(byId, homeTeam, awayTeam, homeGoals, awayGoals);
      if (orientedById) {
        return orientedById;
      }
    }

    const byTeams = scheduleByTeams.get(buildTeamPairKey(homeTeam, awayTeam));
    if (!byTeams) {
      return null;
    }

    return orientPredictionToMatch(byTeams, homeTeam, awayTeam, homeGoals, awayGoals);
  }

  if (Number.isNaN(matchIdCandidate)) {
    return null;
  }

  if (!scheduleById.has(matchIdCandidate)) {
    return null;
  }

  return {
    matchId: matchIdCandidate,
    homeGoals,
    awayGoals,
  };
}

function normalizeOptionalTeamName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function orientPredictionToMatch(
  match: GroupMatch,
  homeTeam: string,
  awayTeam: string,
  homeGoals: number,
  awayGoals: number,
): ResolvedPredictionMatch | null {
  const normalizedMatchHome = normalizeTeamName(match.homeTeam);
  const normalizedMatchAway = normalizeTeamName(match.awayTeam);
  const normalizedPredictionHome = normalizeTeamName(homeTeam);
  const normalizedPredictionAway = normalizeTeamName(awayTeam);

  if (
    normalizedPredictionHome === normalizedMatchHome &&
    normalizedPredictionAway === normalizedMatchAway
  ) {
    return {
      matchId: match.matchId,
      homeGoals,
      awayGoals,
    };
  }

  if (
    normalizedPredictionHome === normalizedMatchAway &&
    normalizedPredictionAway === normalizedMatchHome
  ) {
    return {
      matchId: match.matchId,
      homeGoals: awayGoals,
      awayGoals: homeGoals,
    };
  }

  return null;
}
