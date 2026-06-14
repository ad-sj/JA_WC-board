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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export async function fetchMatches(): Promise<MatchItem[]> {
  const response = await fetch(`${API_BASE}/api/matches`);
  if (!response.ok) {
    throw new Error('Failed to fetch matches');
  }

  return response.json();
}

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const response = await fetch(`${API_BASE}/api/leaderboard`);
  if (!response.ok) {
    throw new Error('Failed to fetch leaderboard');
  }

  return response.json();
}

export async function fetchUserSummary(username: string): Promise<UserSummary> {
  const response = await fetch(
    `${API_BASE}/api/users/${encodeURIComponent(username)}`,
  );

  if (!response.ok) {
    throw new Error('Failed to fetch user summary');
  }

  return response.json();
}
