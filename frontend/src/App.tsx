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

  const participantCount = leaderboard.length;
  const selectedParticipantLabel = selectedUser ?? 'Select a participant';

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
      <header className="masthead">
        <div className="masthead-copy">
          <p className="eyebrow">FIFA World Cup 2026</p>
          <h1>Prediction Dashboard</h1>
          <p className="hero-copy">
            Live fixtures, finished matches, and each participant&apos;s prediction performance in a
            flat, mobile-first dashboard.
          </p>
        </div>

        <div className="status-card" aria-label="Refresh status">
          <span className="status-label">Latest refresh</span>
          <strong>{updatedAt || 'Pending'}</strong>
          <span className="status-note">Static data updates whenever the dashboard payload is rebuilt</span>
        </div>
      </header>

      <section className="hero-banner">
        <div className="hero-copy-block">
          <p className="hero-kicker">Selected participant</p>
          <div className="focus-card">
            <strong>{selectedParticipantLabel}</strong>
            <span>
              {selectedLeaderboardEntry
                ? `${selectedLeaderboardEntry.totalPoints} points overall`
                : 'Choose a participant to compare predictions against every match'}
            </span>
          </div>

          <div className="hero-metrics" aria-label="Dashboard summary">
            <div className="metric-chip metric-chip-primary">
              <span className="metric-label">Participants</span>
              <strong>{participantCount}</strong>
            </div>
            <div className="metric-chip metric-chip-secondary">
              <span className="metric-label">Finished</span>
              <strong>{finishedMatches.length}</strong>
            </div>
            <div className="metric-chip metric-chip-accent">
              <span className="metric-label">Live</span>
              <strong>{liveMatches.length}</strong>
            </div>
            <div className="metric-chip metric-chip-muted">
              <span className="metric-label">Scheduled</span>
              <strong>{scheduledMatches.length}</strong>
            </div>
          </div>
        </div>

        <div className="hero-art" aria-hidden="true">
          <div className="art-circle art-circle-large" />
          <div className="art-circle art-circle-small" />
          <div className="art-square art-square-large" />
          <div className="art-square art-square-small" />
          <div className="art-band" />
        </div>
      </section>

      <section className="rule-strip" aria-label="Scoring rules">
        <article className="rule-card rule-card-primary">
          <span className="rule-label">1 point</span>
          <strong>Prediction submitted but wrong outcome</strong>
        </article>
        <article className="rule-card rule-card-secondary">
          <span className="rule-label">3 points</span>
          <strong>Correct winner or draw</strong>
        </article>
        <article className="rule-card rule-card-accent">
          <span className="rule-label">5 points</span>
          <strong>Exact score</strong>
        </article>
      </section>

      {error ? <section className="error-panel">{error}</section> : null}
      {isLoading ? <section className="loading-panel">Loading dashboard…</section> : null}

      <section className="content-grid">
        <article className="panel matches-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Match centre</p>
              <h2>Matches</h2>
            </div>
            <span>{matches.length} group-stage fixtures</span>
          </div>

          <div className="selected-participant-banner">
            <span className="selected-participant-label">Comparing against</span>
            <strong>{selectedParticipantLabel}</strong>
          </div>

          <MatchSection
            title="Live"
            items={liveMatches}
            live
            participantLabel={selectedParticipantLabel}
            userMatchById={userMatchById}
          />

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
            participantLabel={selectedParticipantLabel}
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
            participantLabel={selectedParticipantLabel}
            userMatchById={userMatchById}
          />
        </article>

        <article className="panel leaderboard-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Standings</p>
              <h2>Leaderboard</h2>
            </div>
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
                  aria-pressed={selectedUser === entry.username}
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
  participantLabel,
  userMatchById,
}: {
  title: string;
  items: MatchItem[];
  live?: boolean;
  showResults?: boolean;
  toggleText?: string | null;
  onToggle?: () => void;
  togglePlacement?: 'before' | 'after';
  participantLabel: string;
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
            const hasOfficialScore = match.homeScore !== null && match.awayScore !== null;
            const pointsLabel =
              match.status === 'finished' && hasOfficialScore ? `${userMatch?.points ?? 0} pts` : 'Pending';
            const officialValue = hasOfficialScore ? `${match.homeScore}-${match.awayScore}` : 'VS';
            const officialLabel = live ? 'Current score' : showResults ? 'Official result' : 'Kickoff';
            const predictionValue = userMatch?.prediction
              ? `${userMatch.prediction.homeGoals}-${userMatch.prediction.awayGoals}`
              : 'No pick';
            const predictionNote = hasOfficialScore
              ? pointsLabel
              : userMatch?.prediction
                ? 'Prediction saved'
                : 'No prediction submitted';

            return (
              <div
                className={
                  match.status === 'live'
                    ? 'match-card is-live'
                    : match.status === 'finished'
                      ? 'match-card is-finished'
                      : 'match-card is-scheduled'
                }
                key={match.matchId}
              >
                <div className="match-meta">
                  <span className="match-number">Match {match.matchId}</span>
                  <span className="match-kickoff">{match.dateRaw} {match.timeRaw}</span>
                  {live ? <span className="live-pill">LIVE</span> : null}
                </div>

                <div className="teams">
                  <div className={winner === 'home' ? 'team winner team-block' : 'team team-block'}>
                    <span className="team-side">Home</span>
                    <strong>{match.homeTeam}</strong>
                  </div>
                  <div className="score-block" aria-label={officialLabel}>
                    {officialValue}
                  </div>
                  <div className={winner === 'away' ? 'team winner team-block' : 'team team-block'}>
                    <span className="team-side">Away</span>
                    <strong>{match.awayTeam}</strong>
                  </div>
                </div>

                <div className="prediction-grid">
                  <div className="prediction-panel">
                    <span className="prediction-label">{officialLabel}</span>
                    <strong className="prediction-score prediction-score-official">{officialValue}</strong>
                    <span className="prediction-meta">
                      {hasOfficialScore ? 'Recorded result' : `${match.dateRaw} ${match.timeRaw}`}
                    </span>
                  </div>

                  <div className="prediction-panel prediction-panel-user">
                    <span className="prediction-label">{participantLabel}</span>
                    <strong className="prediction-score prediction-score-user">{predictionValue}</strong>
                    <span className="prediction-meta">{predictionNote}</span>
                  </div>
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
