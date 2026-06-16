import { useEffect, useState } from 'react';
import './App.css';
import {
  fetchGeneratedAt,
  fetchLeaderboard,
  fetchMatches,
  fetchUserSummary,
  type LeaderboardEntry,
  type MatchItem,
  type UserMatchScore,
  type UserSummary,
} from './api';

function App() {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);
  const [showAllScheduled, setShowAllScheduled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError(null);

        const [matchesData, leaderboardData, generatedAt] = await Promise.all([
          fetchMatches(),
          fetchLeaderboard(),
          fetchGeneratedAt(),
        ]);

        if (cancelled) {
          return;
        }

        setMatches(matchesData);
        setLeaderboard(leaderboardData);
        setUpdatedAt(
          new Date(generatedAt).toLocaleString('sv-SE', {
            dateStyle: 'short',
            timeStyle: 'short',
          }),
        );
        setSelectedUser((current) => current ?? leaderboardData[0]?.username ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUserSummary() {
      if (!selectedUser) {
        setUserSummary(null);
        return;
      }

      try {
        const summary = await fetchUserSummary(selectedUser);
        if (!cancelled) {
          setUserSummary(summary);
        }
      } catch {
        if (!cancelled) {
          setUserSummary(null);
        }
      }
    }

    loadUserSummary();

    return () => {
      cancelled = true;
    };
  }, [selectedUser]);

  const finishedMatches = matches
    .filter((match) => match.status === 'finished')
    .sort((a, b) => a.matchId - b.matchId);

  const liveMatches = matches
    .filter((match) => match.status === 'live')
    .sort((a, b) => a.matchId - b.matchId);

  const scheduledMatches = matches
    .filter((match) => match.status === 'scheduled')
    .sort((a, b) => a.matchId - b.matchId);

  const userMatchById = new Map<number, UserMatchScore>(
    userSummary?.matches.map((item) => [item.match.matchId, item]) ?? [],
  );
  const selectedLeaderboardEntry = selectedUser
    ? leaderboard.find((entry) => entry.username === selectedUser) ?? null
    : null;

  const rankCounts = leaderboard.reduce<Record<number, number>>((acc, entry) => {
    acc[entry.rank] = (acc[entry.rank] ?? 0) + 1;
    return acc;
  }, {});
  const tiedRanks = new Set(
    Object.entries(rankCounts)
      .filter(([, count]) => count > 1)
      .map(([rank]) => Number(rank)),
  );

  return (
    <main className="page-shell">
      <section className="hero-banner">
        <div>
          <p className="eyebrow">FIFA World Cup 2026</p>
          <h1>Prediction Dashboard</h1>
          <p className="hero-copy">
            Group-stage leaderboard, fixtures, and final results from the 72-match schedule.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">Refresh</span>
          <strong>{updatedAt || 'Pending'}</strong>
          <span className="status-note">Updated when static data is regenerated</span>
        </div>
      </section>

      <section className="rule-strip">
        <span>1 point: prediction submitted but wrong outcome</span>
        <span>3 points: correct winner or draw</span>
        <span>5 points: exact score</span>
      </section>

      {error ? <section className="error-panel">{error}</section> : null}
      {isLoading ? <section className="loading-panel">Loading dashboard…</section> : null}

      <section className="content-grid">
        <article className="panel leaderboard-panel">
          <div className="panel-header">
            <h2>Leaderboard</h2>
            <span>{leaderboard.length} participants</span>
          </div>

          <div className="leaderboard-selected-summary">
            <span>Selected</span>
            <strong>
              {selectedUser
                ? `${selectedUser} · ${selectedLeaderboardEntry?.totalPoints ?? 0} pts`
                : 'None selected'}
            </strong>
          </div>

          <div className="leaderboard-table">
            <div className="leaderboard-head row">
              <span>Rank</span>
              <span>Participant</span>
              <span>Points</span>
            </div>
            {leaderboard.length === 0 ? (
              <div className="empty-state">No participant CSV files loaded yet.</div>
            ) : (
              leaderboard.map((entry) => (
                <button
                  className={selectedUser === entry.username ? 'row row-button is-selected' : 'row row-button'}
                  key={entry.username}
                  onClick={() => setSelectedUser(entry.username)}
                  type="button"
                >
                  <span>{tiedRanks.has(entry.rank) ? `T${entry.rank}` : `${entry.rank}`}</span>
                  <span>{entry.username}</span>
                  <strong>{entry.totalPoints}</strong>
                </button>
              ))
            )}
          </div>
        </article>

        <article className="panel matches-panel">
          <div className="panel-header">
            <h2>Matches</h2>
            <span>{matches.length} group-stage fixtures</span>
          </div>

          <MatchSection
            title="Results"
            items={showAllResults ? finishedMatches : finishedMatches.slice(-4)}
            showResults
            toggleText={
              finishedMatches.length > 4
                ? showAllResults
                  ? 'Hide older results'
                  : `Show all ${finishedMatches.length} results`
                : null
            }
            onToggle={() => setShowAllResults((value) => !value)}
            togglePlacement="before"
            selectedUser={selectedUser}
            userMatchById={userMatchById}
          />

          <MatchSection
            title="Live"
            items={liveMatches}
            live
            selectedUser={selectedUser}
            userMatchById={userMatchById}
          />

          <MatchSection
            title="Scheduled"
            items={showAllScheduled ? scheduledMatches : scheduledMatches.slice(0, 4)}
            toggleText={
              scheduledMatches.length > 4
                ? showAllScheduled
                  ? 'Hide later scheduled matches'
                  : `Show all scheduled matches (${scheduledMatches.length})`
                : null
            }
            onToggle={() => setShowAllScheduled((value) => !value)}
            togglePlacement="after"
            selectedUser={selectedUser}
            userMatchById={userMatchById}
          />
        </article>
      </section>
    </main>
  );
}

function MatchSection({
  title,
  items,
  live = false,
  showResults = false,
  toggleText = null,
  onToggle,
  togglePlacement = 'before',
  selectedUser,
  userMatchById,
}: {
  title: string;
  items: MatchItem[];
  live?: boolean;
  showResults?: boolean;
  toggleText?: string | null;
  onToggle?: () => void;
  togglePlacement?: 'before' | 'after';
  selectedUser: string | null;
  userMatchById: Map<number, UserMatchScore>;
}) {
  const toggleRow = toggleText && onToggle ? (
    <button className="match-toggle-row" type="button" onClick={onToggle}>
      <span>{toggleText}</span>
    </button>
  ) : null;

  return (
    <section className="match-section">
      <div className="match-section-header">
        <h3>{title}</h3>
        <span>{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">No matches in this section.</div>
      ) : (
        <div className="match-list">
          {togglePlacement === 'before' ? toggleRow : null}
          {items.map((match) => {
            const winner = getWinner(match);
            const userMatch = userMatchById.get(match.matchId);
            const pointsLabel =
              match.status === 'finished' && match.homeScore !== null && match.awayScore !== null
                ? `${userMatch?.points ?? 0} pts`
                : '-';

            return (
              <div className="match-card" key={match.matchId}>
                <div className="match-meta">
                  <span>Match {match.matchId}</span>
                  <span>{match.dateRaw} {match.timeRaw}</span>
                  {live ? <span className="live-pill">LIVE</span> : null}
                </div>

                <div className="teams">
                  <div className={winner === 'home' ? 'team winner' : 'team'}>{match.homeTeam}</div>
                  <div className="score-block">
                    {showResults && match.homeScore !== null && match.awayScore !== null
                      ? `${match.homeScore} - ${match.awayScore}`
                      : 'vs'}
                  </div>
                  <div className={winner === 'away' ? 'team winner' : 'team'}>{match.awayTeam}</div>
                </div>

                <div className="prediction-row">
                  <span className="prediction-user">{selectedUser ?? 'No participant selected'}</span>
                  <span className="prediction-score">
                    {userMatch?.prediction
                      ? `${userMatch.prediction.homeGoals}-${userMatch.prediction.awayGoals}`
                      : 'No pick'}
                  </span>
                  <strong className="prediction-points">{pointsLabel}</strong>
                </div>
              </div>
            );
          })}
          {togglePlacement === 'after' ? toggleRow : null}
        </div>
      )}
    </section>
  );
}

function getWinner(match: MatchItem): 'home' | 'away' | 'draw' | null {
  if (match.homeScore === null || match.awayScore === null) {
    return null;
  }

  if (match.homeScore > match.awayScore) {
    return 'home';
  }

  if (match.awayScore > match.homeScore) {
    return 'away';
  }

  return 'draw';
}

export default App;
