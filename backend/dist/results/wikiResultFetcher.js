"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchResultsFromWikipedia = fetchResultsFromWikipedia;
exports.writeResultsCsv = writeResultsCsv;
const fs_1 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const csv_parse_1 = require("csv-parse");
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
async function fetchResultsFromWikipedia(schedule) {
    const response = await axios_1.default.get(RESULTS_SOURCE_URL, {
        headers: {
            'User-Agent': 'JA-WC-board/1.0 (+local dashboard)',
        },
    });
    const parsedRows = await parseResultsCsv(response.data);
    const latestPairResults = new Map();
    for (const row of parsedRows) {
        if (row.tournament !== 'FIFA World Cup') {
            continue;
        }
        const homeScore = parseInt(row.home_score, 10);
        const awayScore = parseInt(row.away_score, 10);
        if (Number.isNaN(homeScore) || Number.isNaN(awayScore)) {
            continue;
        }
        const key = buildPairKey(row.home_team, row.away_team);
        const current = latestPairResults.get(key);
        if (!current || row.date > current.date) {
            latestPairResults.set(key, {
                home: row.home_team,
                away: row.away_team,
                homeScore,
                awayScore,
                date: row.date,
            });
        }
    }
    const results = [];
    for (const match of schedule) {
        const homeAliases = buildScheduleNameAliases(match.homeTeam);
        const awayAliases = buildScheduleNameAliases(match.awayTeam);
        let matched;
        let homeAliasUsed = '';
        let awayAliasUsed = '';
        for (const homeAlias of homeAliases) {
            if (matched) {
                break;
            }
            for (const awayAlias of awayAliases) {
                const key = [homeAlias, awayAlias].sort().join('|');
                const candidate = latestPairResults.get(key);
                if (candidate) {
                    matched = candidate;
                    homeAliasUsed = homeAlias;
                    awayAliasUsed = awayAlias;
                    break;
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
            homeScore: matchIsSameDirection ? matched.homeScore : matched.awayScore,
            awayScore: matchIsSameDirection ? matched.awayScore : matched.homeScore,
        });
    }
    return results.sort((a, b) => a.matchId - b.matchId);
}
async function writeResultsCsv(resultsFilePath, results) {
    const lines = ['Match,HomeGoals,AwayGoals'];
    for (const result of results) {
        lines.push(`${result.matchId},${result.homeScore},${result.awayScore}`);
    }
    await fs_1.default.promises.writeFile(resultsFilePath, `${lines.join('\n')}\n`, 'utf8');
}
