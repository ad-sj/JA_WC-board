import { useEffect, useState } from 'react';
import './App.css';
import {
  fetchLeaderboard,
  fetchMatches,
  fetchUserSummary,
  type LeaderboardEntry,
  type MatchItem,
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

        const [matchesData, leaderboardData] = await Promise.all([
          fetchMatches(),
          fetchLeaderboard(),
        ]);

        if (cancelled) {
          return;
        }

        setMatches(matchesData);
        setLeaderboard(leaderboardData);
        setUpdatedAt(new Date().toLocaleTimeString('sv-SE'));
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
          <span className="status-note">Updates on page reload</span>
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
                  <span>#{entry.rank}</span>
                  <span>{entry.username}</span>
                  <strong>{entry.totalPoints}</strong>
                </button>
              ))
            )}
          </div>

          <div className="user-summary-panel">
            <div className="panel-header compact">
              <h2>Participant</h2>
              <span>{selectedUser ?? 'None selected'}</span>
            </div>

            {userSummary ? (
              <>
                <div className="summary-total">{userSummary.totalPoints} pts</div>
                <div className="user-match-list">
                  {userSummary.matches.map((item) => (
                    <div className="user-match-row" key={item.match.matchId}>
                      <span>
                        {item.match.matchId}. {item.match.homeTeam} - {item.match.awayTeam}
                      </span>
                      <span>
                        {item.prediction
                          ? `${item.prediction.homeGoals}-${item.prediction.awayGoals}`
                          : 'No pick'}
                      </span>
                      <strong>
                        {item.match.status === 'finished' &&
                        item.match.homeScore !== null &&
                        item.match.awayScore !== null
                          ? item.points
                          : '-'}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">Select a participant to inspect scored matches.</div>
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
          />

          <MatchSection title="Live" items={liveMatches} live />

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
}: {
  title: string;
  items: MatchItem[];
  live?: boolean;
  showResults?: boolean;
  toggleText?: string | null;
  onToggle?: () => void;
  togglePlacement?: 'before' | 'after';
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
