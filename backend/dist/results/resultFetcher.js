"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchResultsFromSource = fetchResultsFromSource;
exports.mergeResults = mergeResults;
exports.loadPreferredResults = loadPreferredResults;
exports.writeResultsCsv = writeResultsCsv;
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const csv_parse_1 = require("csv-parse");
const resultLoader_1 = require("./resultLoader");
const RESULTS_SOURCE_URL = 'https://raw.githubusercontent.com/martj42/international_results/master/results.csv';
const TEAM_NAME_MAP = {
    Mexiko: ['Mexico'],
    Sydafrika: ['South Africa'],
    Sydkorea: ['South Korea'],
    Tjeckien: ['Czech Republic'],
    Kanada: ['Canada'],
    'Bosnien och Hercegovina': ['Bosnia and Herzegovina', 'Bosnia-Herzegovina'],
    USA: ['United States'],
    Paraguay: ['Paraguay'],
    Qatar: ['Qatar'],
    Schweiz: ['Switzerland'],
    Brasilien: ['Brazil'],
    Marocko: ['Morocco'],
    Haiti: ['Haiti'],
    Skottland: ['Scotland'],
    Australien: ['Australia'],
    Turkiet: ['Turkey'],
    Tyskland: ['Germany'],
    Curaçao: ['Curacao', 'Curaçao'],
    Nederländerna: ['Netherlands'],
    Japan: ['Japan'],
    Elfenbenskusten: ["Cote d'Ivoire", 'Côte d\'Ivoire', 'Ivory Coast'],
    Ecuador: ['Ecuador'],
    Sverige: ['Sweden'],
    Tunisien: ['Tunisia'],
    Spanien: ['Spain'],
    'Kap Verde': ['Cape Verde'],
    Belgien: ['Belgium'],
    Egypten: ['Egypt'],
    Saudiarabien: ['Saudi Arabia'],
    Uruguay: ['Uruguay'],
    Iran: ['Iran'],
    'Nya Zeeland': ['New Zealand'],
    Frankrike: ['France'],
    Senegal: ['Senegal'],
    Irak: ['Iraq'],
    Norge: ['Norway'],
    Argentina: ['Argentina'],
    Algeriet: ['Algeria'],
    Österrike: ['Austria'],
    Jordanien: ['Jordan'],
    Portugal: ['Portugal'],
    'DR Kongo': ['DR Congo', 'Congo DR'],
    England: ['England'],
    Kroatien: ['Croatia'],
    Ghana: ['Ghana'],
    Panama: ['Panama'],
    Uzbekistan: ['Uzbekistan'],
    Colombia: ['Colombia'],
};
const DAY_IN_MS = 24 * 60 * 60 * 1000;
function normalizeName(name) {
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}
function buildPairKey(teamA, teamB) {
    const [a, b] = [normalizeName(teamA), normalizeName(teamB)].sort();
    return `${a}|${b}`;
}
function buildScheduleNameAliases(team) {
    const aliases = TEAM_NAME_MAP[team] ?? [team];
    return aliases.map((alias) => normalizeName(alias));
}
function parseDateOnlyToUtc(date) {
    const [yearStr, monthStr, dayStr] = date.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
        return null;
    }
    return Date.UTC(year, month - 1, day);
}
function getScheduleMatchDateUtc(match) {
    return parseDateOnlyToUtc(match.kickoffLocal.slice(0, 10));
}
function getDayDistance(first, second) {
    return Math.abs(first - second) / DAY_IN_MS;
}
async function parseResultsCsv(csvText) {
    return new Promise((resolve, reject) => {
        const records = [];
        const parser = (0, csv_parse_1.parse)(csvText, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });
        parser.on('readable', () => {
            let record;
            while ((record = parser.read()) !== null) {
                records.push(record);
            }
        });
        parser.on('error', (err) => reject(err));
        parser.on('end', () => resolve(records));
    });
}
async function fetchResultsFromSource(schedule) {
    const response = await axios_1.default.get(RESULTS_SOURCE_URL, {
        headers: {
            'User-Agent': 'JA-WC-board/1.0 (+local dashboard)',
        },
    });
    const parsedRows = await parseResultsCsv(response.data);
    const scheduleYears = new Set(schedule.map((match) => match.kickoffLocal.slice(0, 4)));
    const pairResults = new Map();
    for (const row of parsedRows) {
        if (row.tournament !== 'FIFA World Cup' ||
            !scheduleYears.has(row.date.slice(0, 4))) {
            continue;
        }
        const homeScore = parseInt(row.home_score, 10);
        const awayScore = parseInt(row.away_score, 10);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
            continue;
        }
        const key = buildPairKey(row.home_team, row.away_team);
        const existingResults = pairResults.get(key) ?? [];
        existingResults.push({
            home: row.home_team,
            away: row.away_team,
            homeScore,
            awayScore,
            date: row.date,
        });
        pairResults.set(key, existingResults);
    }
    const results = [];
    for (const match of schedule) {
        const homeAliases = buildScheduleNameAliases(match.homeTeam);
        const awayAliases = buildScheduleNameAliases(match.awayTeam);
        const scheduledDateUtc = getScheduleMatchDateUtc(match);
        let matched;
        let homeAliasUsed = '';
        let awayAliasUsed = '';
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const homeAlias of homeAliases) {
            for (const awayAlias of awayAliases) {
                const key = [homeAlias, awayAlias].sort().join('|');
                const candidates = pairResults.get(key) ?? [];
                for (const candidate of candidates) {
                    const candidateDateUtc = parseDateOnlyToUtc(candidate.date);
                    if (scheduledDateUtc === null || candidateDateUtc === null) {
                        continue;
                    }
                    const dayDistance = getDayDistance(scheduledDateUtc, candidateDateUtc);
                    if (dayDistance > 1 || dayDistance >= bestDistance) {
                        continue;
                    }
                    matched = candidate;
                    homeAliasUsed = homeAlias;
                    awayAliasUsed = awayAlias;
                    bestDistance = dayDistance;
                }
            }
        }
        if (!matched) {
            continue;
        }
        const matchedHome = normalizeName(matched.home);
        const matchIsSameDirection = matchedHome === homeAliasUsed || normalizeName(matched.away) === awayAliasUsed;
        results.push({
            matchId: match.matchId,
            homeTeam: match.homeTeam,
            awayTeam: match.awayTeam,
            homeScore: matchIsSameDirection ? matched.homeScore : matched.awayScore,
            awayScore: matchIsSameDirection ? matched.awayScore : matched.homeScore,
        });
    }
    return results.sort((a, b) => a.matchId - b.matchId);
}
function mergeResults(existingResults, fetchedResults) {
    const merged = new Map();
    for (const result of existingResults) {
        merged.set(result.matchId, result);
    }
    for (const result of fetchedResults) {
        const previous = merged.get(result.matchId);
        merged.set(result.matchId, {
            ...previous,
            ...result,
        });
    }
    return [...merged.values()].sort((a, b) => a.matchId - b.matchId);
}
async function loadPreferredResults(schedule, resultsPath = (0, resultLoader_1.getDefaultResultsPath)()) {
    const existingResults = await (0, resultLoader_1.loadResults)(resultsPath);
    try {
        const fetchedResults = await fetchResultsFromSource(schedule);
        return mergeResults(existingResults, fetchedResults);
    }
    catch (err) {
        console.warn('Failed to fetch fresher results from source, using local results.csv', err);
        return existingResults;
    }
}
async function writeResultsCsv(resultsFilePath, results) {
    const lines = ['Match,HomeTeam,AwayTeam,HomeGoals,AwayGoals'];
    for (const result of results) {
        lines.push([
            result.matchId,
            escapeCsvValue(result.homeTeam ?? ''),
            escapeCsvValue(result.awayTeam ?? ''),
            result.homeScore,
            result.awayScore,
        ].join(','));
    }
    await fs_1.default.promises.writeFile(resultsFilePath, `${lines.join('\n')}\n`, 'utf8');
}
function escapeCsvValue(value) {
    if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
