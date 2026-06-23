"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultResultsPath = getDefaultResultsPath;
exports.loadResults = loadResults;
exports.applyResultsToMatches = applyResultsToMatches;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parse_1 = require("csv-parse");
const REPO_ROOT = path_1.default.resolve(__dirname, '../../..');
const DEFAULT_RESULTS_PATH = path_1.default.resolve(process.env.RESULTS_FILE ||
    path_1.default.join(REPO_ROOT, 'temp/results.csv'));
function getDefaultResultsPath() {
    return DEFAULT_RESULTS_PATH;
}
async function loadResults(resultsPath = DEFAULT_RESULTS_PATH) {
    try {
        const csvContent = await fs_1.default.promises.readFile(resultsPath, 'utf8');
        return new Promise((resolve, reject) => {
            const records = [];
            const parser = (0, csv_parse_1.parse)(csvContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });
            parser.on('readable', () => {
                let record;
                while ((record = parser.read()) !== null) {
                    const matchId = parseInt(record['Match'], 10);
                    const homeScore = parseInt(record['HomeGoals'], 10);
                    const awayScore = parseInt(record['AwayGoals'], 10);
                    const homeTeam = normalizeOptionalTeamName(record['HomeTeam']);
                    const awayTeam = normalizeOptionalTeamName(record['AwayTeam']);
                    if (Number.isNaN(matchId) ||
                        Number.isNaN(homeScore) ||
                        Number.isNaN(awayScore)) {
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
    }
    catch (err) {
        // If file is missing, treat as no results yet.
        if (err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }
}
function applyResultsToMatches(matches, results, now = Date.now()) {
    const resultById = new Map();
    const resultByTeams = new Map();
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
function deriveStatusFromKickoff(kickoffLocal, now) {
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
function normalizeOptionalTeamName(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function normalizeTeamName(team) {
    return team
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
function buildTeamPairKey(homeTeam, awayTeam) {
    return [normalizeTeamName(homeTeam), normalizeTeamName(awayTeam)].sort().join('|');
}
function resolveResultForMatch(match, resultById, resultByTeams) {
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
function orientResultToMatch(match, result) {
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
