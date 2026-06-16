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
                    if (Number.isNaN(matchId) ||
                        Number.isNaN(homeScore) ||
                        Number.isNaN(awayScore)) {
                        continue;
                    }
                    records.push({ matchId, homeScore, awayScore });
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
function applyResultsToMatches(matches, results) {
    if (results.length === 0) {
        return matches;
    }
    const resultById = new Map();
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
