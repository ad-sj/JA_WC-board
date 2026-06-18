"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPredictions = loadPredictions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parse_1 = require("csv-parse");
const scheduleLoader_1 = require("../schedule/scheduleLoader");
const REPO_ROOT = path_1.default.resolve(__dirname, '../../..');
const DEFAULT_PREDICTIONS_DIR = process.env.PREDICTIONS_DIR ||
    path_1.default.join(REPO_ROOT, 'predictions');
async function loadPredictions(predictionsDir = DEFAULT_PREDICTIONS_DIR) {
    const schedule = await (0, scheduleLoader_1.loadSchedule)();
    let files = [];
    try {
        files = await fs_1.default.promises.readdir(predictionsDir);
    }
    catch (err) {
        // If the directory does not exist yet, return empty predictions.
        if (err.code === 'ENOENT') {
            return [];
        }
        throw err;
    }
    const csvFiles = files.filter((f) => f.toLowerCase().endsWith('.csv'));
    const allPredictions = [];
    for (const fileName of csvFiles) {
        const username = path_1.default.basename(fileName, path_1.default.extname(fileName));
        const fullPath = path_1.default.join(predictionsDir, fileName);
        const fileContent = await fs_1.default.promises.readFile(fullPath, 'utf8');
        const parsed = await parsePredictionFile(fileContent, username, schedule);
        allPredictions.push(...parsed);
    }
    return allPredictions;
}
async function parsePredictionFile(csvContent, username, schedule) {
    return new Promise((resolve, reject) => {
        const records = [];
        const scheduleById = new Map();
        const scheduleByTeams = new Map();
        for (const match of schedule) {
            scheduleById.set(match.matchId, match);
            scheduleByTeams.set(buildTeamPairKey(match.homeTeam, match.awayTeam), match);
        }
        const parser = (0, csv_parse_1.parse)(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        const seenMatchIds = new Set();
        parser.on('readable', () => {
            let record;
            while ((record = parser.read()) !== null) {
                const homeGoals = parseInt(record['HomeGoals'] ?? record['PredictedHomeGoals'], 10);
                const awayGoals = parseInt(record['AwayGoals'] ?? record['PredictedAwayGoals'], 10);
                if (Number.isNaN(homeGoals) ||
                    Number.isNaN(awayGoals)) {
                    continue;
                }
                const resolvedMatch = resolvePredictionMatch(record, homeGoals, awayGoals, scheduleById, scheduleByTeams);
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
function resolvePredictionMatch(record, homeGoals, awayGoals, scheduleById, scheduleByTeams) {
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
function normalizeOptionalTeamName(value) {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
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
function orientPredictionToMatch(match, homeTeam, awayTeam, homeGoals, awayGoals) {
    const normalizedMatchHome = normalizeTeamName(match.homeTeam);
    const normalizedMatchAway = normalizeTeamName(match.awayTeam);
    const normalizedPredictionHome = normalizeTeamName(homeTeam);
    const normalizedPredictionAway = normalizeTeamName(awayTeam);
    if (normalizedPredictionHome === normalizedMatchHome &&
        normalizedPredictionAway === normalizedMatchAway) {
        return {
            matchId: match.matchId,
            homeGoals,
            awayGoals,
        };
    }
    if (normalizedPredictionHome === normalizedMatchAway &&
        normalizedPredictionAway === normalizedMatchHome) {
        return {
            matchId: match.matchId,
            homeGoals: awayGoals,
            awayGoals: homeGoals,
        };
    }
    return null;
}
