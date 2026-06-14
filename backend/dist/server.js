"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const scheduleLoader_1 = require("./schedule/scheduleLoader");
const predictionLoader_1 = require("./predictions/predictionLoader");
const scoringEngine_1 = require("./scoring/scoringEngine");
const resultLoader_1 = require("./results/resultLoader");
const wikiResultFetcher_1 = require("./results/wikiResultFetcher");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const PORT = process.env.PORT || 4000;
async function loadMatchesWithResults() {
    const [schedule, results] = await Promise.all([
        (0, scheduleLoader_1.loadSchedule)(),
        (0, resultLoader_1.loadResults)(),
    ]);
    return (0, resultLoader_1.applyResultsToMatches)(schedule, results);
}
app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.get('/api/matches', async (_req, res) => {
    try {
        const matches = await loadMatchesWithResults();
        res.json(matches);
    }
    catch (err) {
        console.error('Failed to load schedule', err);
        res.status(500).json({ error: 'Failed to load schedule' });
    }
});
app.get('/api/leaderboard', async (_req, res) => {
    try {
        const [matches, predictions] = await Promise.all([
            loadMatchesWithResults(),
            (0, predictionLoader_1.loadPredictions)(),
        ]);
        const leaderboard = (0, scoringEngine_1.buildLeaderboard)(matches, predictions);
        res.json(leaderboard);
    }
    catch (err) {
        console.error('Failed to build leaderboard', err);
        res.status(500).json({ error: 'Failed to build leaderboard' });
    }
});
app.get('/api/users/:username', async (req, res) => {
    const username = req.params.username;
    try {
        const [matches, predictions] = await Promise.all([
            loadMatchesWithResults(),
            (0, predictionLoader_1.loadPredictions)(),
        ]);
        const summary = (0, scoringEngine_1.buildUserSummary)(username, matches, predictions);
        res.json(summary);
    }
    catch (err) {
        console.error('Failed to build user summary', err);
        res.status(500).json({ error: 'Failed to build user summary' });
    }
});
app.post('/api/admin/refresh-results', async (_req, res) => {
    try {
        const schedule = await (0, scheduleLoader_1.loadSchedule)();
        const results = await (0, wikiResultFetcher_1.fetchResultsFromWikipedia)(schedule);
        await (0, wikiResultFetcher_1.writeResultsCsv)((0, resultLoader_1.getDefaultResultsPath)(), results);
        res.json({
            updated: true,
            resultCount: results.length,
        });
    }
    catch (err) {
        console.error('Failed to refresh results', err);
        res.status(500).json({ error: 'Failed to refresh results' });
    }
});
app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
});
