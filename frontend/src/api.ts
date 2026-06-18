export interface MatchItem {
  matchId: number;
  dateRaw: string;
  timeRaw: string;
  kickoffLocal: string;
  homeTeam: string;
  awayTeam: string;
  status: 'scheduled' | 'live' | 'finished';
  homeScore: number | null;
  awayScore: number | null;
}

export interface LeaderboardEntry {
  username: string;
  totalPoints: number;
  rank: number;
}

export interface UserMatchScore {
  match: MatchItem;
  prediction: {
    username: string;
    matchId: number;
    homeGoals: number;
    awayGoals: number;
  } | null;
  points: number;
}

export interface UserSummary {
  username: string;
  totalPoints: number;
  matches: UserMatchScore[];
}

export interface MatchPredictionOverview {
  username: string;
  prediction:
    | {
        homeGoals: number;
        awayGoals: number;
      }
    | null;
  points: number;
  rankBefore: number;
  rankAfter: number;
  movement: 'up' | 'down' | 'same';
}

interface DashboardData {
  generatedAt: string;
  matches: MatchItem[];
  leaderboard: LeaderboardEntry[];
  userSummaries: Record<string, UserSummary>;
}

const DASHBOARD_PATH = `${import.meta.env.BASE_URL}data/dashboard.json`;
let dashboardDataPromise: Promise<DashboardData> | null = null;

async function loadDashboardData(): Promise<DashboardData> {
  if (!dashboardDataPromise) {
    dashboardDataPromise = fetch(DASHBOARD_PATH).then((response) => {
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      return response.json() as Promise<DashboardData>;
    });
  }

  return dashboardDataPromise;
}

export async function fetchMatches(): Promise<MatchItem[]> {
  const dashboardData = await loadDashboardData();
  return dashboardData.matches;
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const dashboardData = await loadDashboardData();
  return dashboardData.leaderboard;
}

export async function fetchUserSummary(username: string): Promise<UserSummary> {
  const dashboardData = await loadDashboardData();
  const summary = dashboardData.userSummaries[username];

  if (!summary) {
    throw new Error('Failed to fetch user summary');
  }

  return summary;
}

export async function fetchGeneratedAt(): Promise<string> {
  const dashboardData = await loadDashboardData();
  return dashboardData.generatedAt;
}

export async function fetchMatchPredictions(
  matchId: number,
): Promise<MatchPredictionOverview[]> {
  const dashboardData = await loadDashboardData();
  const userSummariesEntries = Object.entries(dashboardData.userSummaries);

  function computeRanks(beforeOrAfter: 'before' | 'after'): Map<string, number> {
    const scores: { username: string; totalPoints: number }[] = [];

    for (const [username, summary] of userSummariesEntries) {
      let total = 0;
      for (const matchScore of summary.matches) {
        const match = matchScore.match;
        if (
          match.status === 'finished' &&
          match.homeScore !== null &&
          match.awayScore !== null &&
          (beforeOrAfter === 'after'
            ? match.matchId <= matchId
            : match.matchId < matchId)
        ) {
          total += matchScore.points;
        }
      }
      scores.push({ username, totalPoints: total });
    }

    scores.sort((a, b) => b.totalPoints - a.totalPoints);

    const ranks = new Map<string, number>();
    let currentRank = 0;
    let lastPoints: number | null = null;

    scores.forEach((s, index) => {
      if (lastPoints === null || s.totalPoints !== lastPoints) {
        currentRank = index + 1;
        lastPoints = s.totalPoints;
      }
      ranks.set(s.username, currentRank);
    });

    return ranks;
  }

  const ranksBefore = computeRanks('before');
  const ranksAfter = computeRanks('after');

  return dashboardData.leaderboard.map((entry) => {
    const summary = dashboardData.userSummaries[entry.username];
    const matchScore = summary.matches.find((item) => item.match.matchId === matchId);
    const rankAfter = ranksAfter.get(entry.username) ?? entry.rank;
    const rankBefore = ranksBefore.get(entry.username) ?? rankAfter;

    let movement: 'up' | 'down' | 'same';
    if (rankAfter < rankBefore) {
      movement = 'up';
    } else if (rankAfter > rankBefore) {
      movement = 'down';
    } else {
      movement = 'same';
    }

    return {
      username: entry.username,
      prediction: matchScore?.prediction
        ? {
            homeGoals: matchScore.prediction.homeGoals,
            awayGoals: matchScore.prediction.awayGoals,
          }
        : null,
      points: matchScore?.points ?? 0,
      rankBefore,
      rankAfter,
      movement,
    };
  });
}
