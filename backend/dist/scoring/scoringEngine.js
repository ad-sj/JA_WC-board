"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scorePrediction = scorePrediction;
exports.buildLeaderboard = buildLeaderboard;
exports.buildUserSummary = buildUserSummary;
function scorePrediction(match, prediction) {
    if (!prediction) {
        return 0;
    }
    if (match.homeScore === null ||
        match.awayScore === null ||
        match.status !== 'finished') {
        return 0;
    }
    const actualOutcome = outcome(match.homeScore, match.awayScore);
    const predictedOutcome = outcome(prediction.homeGoals, prediction.awayGoals);
    const exactScore = prediction.homeGoals === match.homeScore &&
        prediction.awayGoals === match.awayScore;
    if (exactScore) {
        return 5;
    }
    if (actualOutcome === predictedOutcome) {
        return 3;
    }
    // Prediction exists but outcome is wrong.
    return 1;
}
function buildLeaderboard(matches, predictions) {
    // Index finished matches by id.
    const finishedMatches = matches.filter((m) => m.status === 'finished' && m.homeScore !== null && m.awayScore !== null);
    const matchById = new Map();
    for (const m of finishedMatches) {
        matchById.set(m.matchId, m);
    }
    const predictionsByUser = new Map();
    for (const p of predictions) {
        if (!predictionsByUser.has(p.username)) {
            predictionsByUser.set(p.username, []);
        }
        predictionsByUser.get(p.username).push(p);
    }
    const scores = [];
    for (const [username, userPredictions] of predictionsByUser.entries()) {
        let total = 0;
        for (const match of finishedMatches) {
            const prediction = userPredictions.find((p) => p.matchId === match.matchId) || null;
            total += scorePrediction(match, prediction);
        }
        scores.push({ username, totalPoints: total });
    }
    // Sort by total points descending.
    scores.sort((a, b) => b.totalPoints - a.totalPoints);
    // Assign shared ranks for equal totals.
    const leaderboard = [];
    let currentRank = 0;
    let lastPoints = null;
    scores.forEach((s, index) => {
        if (lastPoints === null || s.totalPoints !== lastPoints) {
            currentRank = index + 1;
            lastPoints = s.totalPoints;
        }
        leaderboard.push({
            username: s.username,
            totalPoints: s.totalPoints,
            rank: currentRank,
        });
    });
    return leaderboard;
}
function buildUserSummary(username, matches, predictions) {
    const userPredictions = predictions.filter((p) => p.username.toLowerCase() === username.toLowerCase());
    const scores = [];
    let totalPoints = 0;
    const sortedMatches = [...matches].sort((a, b) => a.matchId - b.matchId);
    for (const match of sortedMatches) {
        const prediction = userPredictions.find((p) => p.matchId === match.matchId) || null;
        const points = scorePrediction(match, prediction);
        totalPoints += points;
        scores.push({ match, prediction, points });
    }
    return { username, totalPoints, matches: scores };
}
function outcome(home, away) {
    if (home > away)
        return 'home';
    if (away > home)
        return 'away';
    return 'draw';
}
