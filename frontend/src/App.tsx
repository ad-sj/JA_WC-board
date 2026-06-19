import { useEffect, useState } from 'react';
import './App.css';
import {
  fetchGeneratedAt,
  fetchLeaderboard,
  fetchMatches,
  fetchUserSummary,
  fetchMatchPredictions,
  type LeaderboardEntry,
  type MatchItem,
  type UserMatchScore,
  type UserSummary,
  type MatchPredictionOverview,
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
  const [expandedMatchId, setExpandedMatchId] = useState<number | null>(null);
  const [expandedMatchPredictions, setExpandedMatchPredictions] = useState<
    MatchPredictionOverview[] | null
  >(null);
  const [isLoadingMatchPredictions, setIsLoadingMatchPredictions] = useState(false);

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

  async function handleToggleMatch(matchId: number) {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      setExpandedMatchPredictions(null);
      return;
    }

    setExpandedMatchId(matchId);
    setIsLoadingMatchPredictions(true);
    try {
      const predictions = await fetchMatchPredictions(matchId);
      setExpandedMatchPredictions(predictions);
    } catch {
      setExpandedMatchPredictions(null);
    } finally {
      setIsLoadingMatchPredictions(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="masthead">
        <div className="masthead-copy">
          <p className="eyebrow">FIFA World Cup 2026</p>
          <h1>Prediction Dashboard</h1>
        </div>
        <span className="masthead-refresh">Updated {updatedAt || '–'}</span>
      </header>

      <section className="hero-banner">
        <div className="hero-copy-block">
          <div className="focus-card">
            <span className="hero-kicker">Selected participant</span>
            <strong>{selectedParticipantLabel}</strong>
            <span>
              {selectedLeaderboardEntry
                ? `${selectedLeaderboardEntry.totalPoints} points overall`
                : 'Choose a participant below'}
            </span>
          </div>

          <div className="hero-metrics" aria-label="Dashboard summary">
            <div className="metric-chip metric-chip-primary">
              <span className="metric-label">Players</span>
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
            expandedMatchId={expandedMatchId}
            expandedPredictions={expandedMatchPredictions}
            isLoadingMatchPredictions={isLoadingMatchPredictions}
            tiedRanks={tiedRanks}
            onToggleMatch={handleToggleMatch}
          />

          <MatchSection
            title="Results"
            items={showAllResults ? finishedMatches : finishedMatches.slice(-4)}
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
            expandedMatchId={expandedMatchId}
            expandedPredictions={expandedMatchPredictions}
            isLoadingMatchPredictions={isLoadingMatchPredictions}
            tiedRanks={tiedRanks}
            onToggleMatch={handleToggleMatch}
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
            expandedMatchId={expandedMatchId}
            expandedPredictions={expandedMatchPredictions}
            isLoadingMatchPredictions={isLoadingMatchPredictions}
            tiedRanks={tiedRanks}
            onToggleMatch={handleToggleMatch}
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
  toggleText = null,
  onToggle,
  togglePlacement = 'before',
  participantLabel,
  userMatchById,
  expandedMatchId,
  expandedPredictions,
  isLoadingMatchPredictions,
  onToggleMatch,
  tiedRanks,
}: {
  title: string;
  items: MatchItem[];
  live?: boolean;
  toggleText?: string | null;
  onToggle?: () => void;
  togglePlacement?: 'before' | 'after';
  participantLabel: string;
  userMatchById: Map<number, UserMatchScore>;
  expandedMatchId: number | null;
  expandedPredictions: MatchPredictionOverview[] | null;
  isLoadingMatchPredictions: boolean;
  onToggleMatch: (matchId: number) => void;
  tiedRanks: Set<number>;
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
            const isFinished = match.status === 'finished';
            const isDraw = hasOfficialScore && winner === 'draw';
            const statusLabel = live ? 'LIVE' : match.timeRaw;
            const predictionValue = userMatch?.prediction
              ? `${userMatch.prediction.homeGoals}–${userMatch.prediction.awayGoals}`
              : '–';
            const points = userMatch?.points ?? 0;
            const outcomeLabel = hasOfficialScore
              ? `${points} pt${points === 1 ? '' : 's'}`
              : userMatch?.prediction
                ? 'Saved'
                : 'No pick';
            const outcomeTier = hasOfficialScore
              ? points >= 5
                ? 'is-exact'
                : points >= 3
                  ? 'is-outcome'
                  : points >= 1
                    ? 'is-played'
                    : 'is-miss'
              : 'is-pending';
            const homeTeamClass = isDraw
              ? 'match-team is-draw'
              : winner === 'home'
                ? 'match-team is-winner'
                : 'match-team';
            const awayTeamClass = isDraw
              ? 'match-team is-draw'
              : winner === 'away'
                ? 'match-team is-winner'
                : 'match-team';
            const isExpanded = expandedMatchId === match.matchId;

            return (
              <article
                className={
                  match.status === 'live'
                    ? 'match-card is-live'
                    : match.status === 'finished'
                      ? 'match-card is-finished'
                      : 'match-card is-scheduled'
                }
                key={match.matchId}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                onClick={() => onToggleMatch(match.matchId)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onToggleMatch(match.matchId);
                  }
                }}
              >
                <header className="match-card-top">
                  {isFinished ? null : (
                    <span className={live ? 'match-status is-live-status' : 'match-status'}>
                      {statusLabel}
                    </span>
                  )}
                  <span className="match-card-info">Match {match.matchId} · {match.dateRaw}</span>
                </header>

                <div className="match-teams">
                  <div className={homeTeamClass}>
                    <span className="match-team-name">{match.homeTeam}</span>
                    <span className="match-team-score">
                      {hasOfficialScore ? match.homeScore : '–'}
                    </span>
                  </div>
                  <div className={awayTeamClass}>
                    <span className="match-team-name">{match.awayTeam}</span>
                    <span className="match-team-score">
                      {hasOfficialScore ? match.awayScore : '–'}
                    </span>
                  </div>
                </div>

                <footer className="match-prediction-row">
                  <div className="match-pred">
                    <span className="match-pred-label">{participantLabel}</span>
                    <span className={`match-pred-value ${outcomeTier}`}>{predictionValue}</span>
                  </div>
                  <span className={`match-outcome ${outcomeTier}`}>{outcomeLabel}</span>
                </footer>

                {isExpanded ? (
                  <div className="match-extra">
                    {isLoadingMatchPredictions || !expandedPredictions ? (
                      <div className="match-extra-row">Loading picks…</div>
                    ) : (
                      <div className="match-extra-list">
                        {expandedPredictions
                          .slice()
                          .sort((a, b) => {
                            if (a.rankAfter === b.rankAfter) {
                              return a.username.localeCompare(b.username);
                            }
                            return a.rankAfter - b.rankAfter;
                          })
                          .map((p) => (
                            <div className="match-extra-row" key={p.username}>
                              <span
                                className={
                                  p.movement === 'up'
                                    ? 'match-extra-movement is-up'
                                    : p.movement === 'down'
                                      ? 'match-extra-movement is-down'
                                      : 'match-extra-movement is-same'
                                }
                              >
                                {p.movement === 'up'
                                  ? '↑'
                                  : p.movement === 'down'
                                    ? '↓'
                                    : '–'}
                              </span>
                                <span className="match-extra-rank">
                                  {p.rankAfter === 0
                                    ? '–'
                                    : `${tiedRanks.has(p.rankAfter) ? `T${p.rankAfter}` : p.rankAfter}`}
                                </span>
                                <span className="match-extra-name">{p.username}</span>
                                <span className="match-extra-prediction">
                                  {p.prediction
                                    ? `${p.prediction.homeGoals}–${p.prediction.awayGoals}`
                                    : '–'}
                                </span>
                                <span className="match-extra-points">{p.points}p</span>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </article>
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
