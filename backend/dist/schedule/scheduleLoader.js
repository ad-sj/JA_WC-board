"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadSchedule = loadSchedule;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parse_1 = require("csv-parse");
const REPO_ROOT = path_1.default.resolve(__dirname, '../../..');
const DEFAULT_SCHEDULE_PATH = path_1.default.resolve(process.env.MATCH_SCHEDULE_FILE ||
    path_1.default.join(REPO_ROOT, 'temp/matches.csv'));
async function loadSchedule(schedulePath = DEFAULT_SCHEDULE_PATH) {
    const csvContent = await fs_1.default.promises.readFile(schedulePath, 'utf8');
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
                const status = homeScore !== null && awayScore !== null
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
function buildKickoffIso(dateRaw, timeRaw) {
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
function parseResultScore(result) {
    // Expect format like "2-1"; fall back to nulls if malformed.
    const parts = result.split('-');
    if (parts.length !== 2) {
        return { home: NaN, away: NaN };
    }
    const home = parseInt(parts[0].trim(), 10);
    const away = parseInt(parts[1].trim(), 10);
    return { home, away };
}
