"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPredictions = loadPredictions;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const csv_parse_1 = require("csv-parse");
const REPO_ROOT = path_1.default.resolve(__dirname, '../../..');
const DEFAULT_PREDICTIONS_DIR = process.env.PREDICTIONS_DIR ||
    path_1.default.join(REPO_ROOT, 'predictions');
async function loadPredictions(predictionsDir = DEFAULT_PREDICTIONS_DIR) {
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
        const parsed = await parsePredictionFile(fileContent, username);
        allPredictions.push(...parsed);
    }
    return allPredictions;
}
async function parsePredictionFile(csvContent, username) {
    return new Promise((resolve, reject) => {
        const records = [];
        const parser = (0, csv_parse_1.parse)(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        const seenMatchIds = new Set();
        parser.on('readable', () => {
            let record;
            while ((record = parser.read()) !== null) {
                const matchId = parseInt(record['Match'], 10);
                const homeGoals = parseInt(record['HomeGoals'], 10);
                const awayGoals = parseInt(record['AwayGoals'], 10);
                if (Number.isNaN(matchId) ||
                    Number.isNaN(homeGoals) ||
                    Number.isNaN(awayGoals)) {
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
