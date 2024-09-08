import React, { useState, useEffect, useMemo } from 'react';
import refereeStats from '../data/referee_stats.json';
import '../styles/refBias.css';

interface RefStats {
  year: number;
  totalGames: number;
  totalPenalties: number;
  totalYards: number;
  homePenalties: number;
  homeYards: number;
  awayPenalties: number;
  awayYards: number;
  penaltiesDeclined: number;
  penaltiesOffsetting: number;
  games: Game[];
}

interface Game {
  date: string;
  week: string;
  homeTeam: string;
  awayTeam: string;
  totalPenalties: number;
  totalYards: number;
  homePenalties: number;
  homeYards: number;
  awayPenalties: number;
  awayYards: number;
  penaltiesDeclined: number;
  penaltiesOffsetting: number;
}

interface TeamBias {
  [refName: string]: {
    [year: number]: {
      [team: string]: TeamStats
    }
  }
}

interface TeamStats {
  biasRatio: number;
  totalPenalties: number;
}

interface TeamTotalStats {
  totalPenalties: number;
  homePenalties: number;
  awayPenalties: number;
  totalGames: number;
  homeGames: number;
  awayGames: number;
}

const RefBias: React.FC = () => {
  const [refData, setRefData] = useState<{ [key: string]: RefStats[] }>({});
  const [teamBias, setTeamBias] = useState<TeamBias>({});
  const [homeAwayAdvantage, setHomeAwayAdvantage] = useState<{ [key: string]: { [key: number]: number } }>({});
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [teamTotalStats, setTeamTotalStats] = useState<{ [team: string]: TeamTotalStats }>({});
  const [defaultYears, setDefaultYears] = useState<{ [ref: string]: string }>({});
  const [selectedYears, setSelectedYears] = useState<{ [ref: string]: string }>({});

  useEffect(() => {
    setRefData(refereeStats as { [key: string]: RefStats[] });
    calculateTeamBias();
    calculateHomeAwayAdvantage();
    calculateTeamTotalStats();
    setDefaultYearsForRefs();
  }, []);

  useEffect(() => {
    setSelectedYears(defaultYears);
  }, [defaultYears]);

  const calculateTeamBias = () => {
    const bias: TeamBias = {};
    const leagueAverages: { [year: number]: number } = {};

    // Calculate league averages
    Object.values(refereeStats as { [key: string]: RefStats[] }).flat().forEach(season => {
      if (!leagueAverages[season.year]) leagueAverages[season.year] = 0;
      leagueAverages[season.year] += season.totalPenalties / season.totalGames;
    });
    Object.keys(leagueAverages).forEach(year => {
      leagueAverages[Number(year)] /= Object.keys(refereeStats).length;
    });

    Object.entries(refereeStats as { [key: string]: RefStats[] }).forEach(([refName, seasons]) => {
      bias[refName] = {};
      
      seasons.forEach((season) => {
        const yearBias: { [team: string]: TeamStats } = {};
        const teamGames: { [team: string]: number } = {};

        season.games.forEach((game) => {
          const homeTeam = game.homeTeam;
          const awayTeam = game.awayTeam;
          const homePenalties = game.homePenalties;
          const awayPenalties = game.awayPenalties;

          [
            { team: homeTeam, penalties: homePenalties },
            { team: awayTeam, penalties: awayPenalties }
          ].forEach(({ team, penalties }) => {
            if (!(team in yearBias)) {
              yearBias[team] = { biasRatio: 0, totalPenalties: 0 };
              teamGames[team] = 0;
            }
            yearBias[team].totalPenalties += penalties;
            teamGames[team]++;
          });
        });

        // Calculate bias ratio and store total penalties
        Object.keys(yearBias).forEach(team => {
          const avgPenalties = yearBias[team].totalPenalties / teamGames[team];
          yearBias[team].biasRatio = avgPenalties / leagueAverages[season.year];
        });

        bias[refName][season.year] = yearBias;
      });
    });

    setTeamBias(bias);
  };

  const calculateHomeAwayAdvantage = () => {
    const advantage: { [key: string]: { [key: number]: number } } = {};
    
    Object.entries(refereeStats as { [key: string]: RefStats[] }).forEach(([refName, seasons]) => {
      advantage[refName] = {};
      seasons.forEach(season => {
        advantage[refName][season.year] = (season.awayPenalties - season.homePenalties) / season.totalGames;
      });
    });

    setHomeAwayAdvantage(advantage);
  };

  const calculateTeamTotalStats = () => {
    const stats: { [team: string]: TeamTotalStats } = {};
    
    Object.values(refereeStats as { [key: string]: RefStats[] }).flat().forEach(season => {
      season.games.forEach(game => {
        [
          { team: game.homeTeam, penalties: game.homePenalties, isHome: true },
          { team: game.awayTeam, penalties: game.awayPenalties, isHome: false }
        ].forEach(({ team, penalties, isHome }) => {
          if (!stats[team]) {
            stats[team] = { totalPenalties: 0, homePenalties: 0, awayPenalties: 0, totalGames: 0, homeGames: 0, awayGames: 0 };
          }
          stats[team].totalPenalties += penalties;
          stats[team].totalGames++;
          if (isHome) {
            stats[team].homePenalties += penalties;
            stats[team].homeGames++;
          } else {
            stats[team].awayPenalties += penalties;
            stats[team].awayGames++;
          }
        });
      });
    });

    setTeamTotalStats(stats);
  };

  const setDefaultYearsForRefs = () => {
    const defaults: { [ref: string]: string } = {};
    Object.entries(refereeStats as { [key: string]: RefStats[] }).forEach(([ref, seasons]) => {
      const mostRecentYear = seasons.reduce((latest, season) => 
        season.year > parseInt(latest) ? season.year.toString() : latest
      , '0');
      defaults[ref] = mostRecentYear;
    });
    setDefaultYears(defaults);
  };

  const handleYearClick = (ref: string, year: number) => {
    setSelectedYears(prev => ({
      ...prev,
      [ref]: year.toString()
    }));
  };

  const toggleTeam = (team: string) => {
    setSelectedTeams(prev => 
      prev.includes(team) 
        ? prev.filter(t => t !== team)
        : [...prev, team]
    );
  };

  const getFavorableRefs = (team: string) => {
    const refBiases = Object.entries(teamBias).map(([refName, yearData]) => {
      const latestYear = Math.max(...Object.keys(yearData).map(Number));
      const bias = yearData[latestYear]?.[team]?.biasRatio || 0;
      return { name: refName, biasRatio: bias };
    });
    return refBiases.sort((a, b) => b.biasRatio - a.biasRatio);
  };

  const calculatePenaltiesDelta = (seasons: RefStats[]) => {
    if (seasons.length < 2) return 'N/A';
    const sortedSeasons = seasons.sort((a, b) => a.year - b.year);
    const firstSeason = sortedSeasons[0];
    const lastSeason = sortedSeasons[sortedSeasons.length - 1];
    const delta = (lastSeason.totalPenalties / lastSeason.totalGames) - (firstSeason.totalPenalties / firstSeason.totalGames);
    return delta.toFixed(2);
  };

  const filteredRefs = Object.keys(refData).filter(refName => 
    refName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    Object.values(refData).forEach(seasons => 
      seasons.forEach(season => 
        season.games.forEach(game => {
          teams.add(game.homeTeam);
          teams.add(game.awayTeam);
        })
      )
    );
    return Array.from(teams).sort();
  }, [refData]);

  return (
    <div className="ref-bias-container">
      <h1>Referee Bias Analysis</h1>
      
      <div className="bias-explanation">
        Referee bias is calculated as follows:
        1. Calculate the average penalties per game for each team under a specific referee.
        2. Calculate the league average penalties per game for that season.
        3. Bias Ratio = (Team's average penalties under referee) / (League average penalties)
        A bias ratio above 1 indicates more penalties than average, while below 1 indicates fewer penalties.
      </div>

      <input
        type="text"
        placeholder="Search referees..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="referee-search"
      />

      <div className="team-selection">
        {allTeams.map(team => (
          <button 
            key={team} 
            onClick={() => toggleTeam(team)}
            className={selectedTeams.includes(team) ? 'selected' : ''}
          >
            {team}
          </button>
        ))}
      </div>

      <div className="team-stats">
        {selectedTeams.map(team => (
          <div key={team} className="team-stats-item">
            <h3>{team} Total Stats</h3>
            <table className="stats-table">
              <tbody>
                <tr>
                  <td>Total Penalties:</td>
                  <td>{teamTotalStats[team]?.totalPenalties || 0}</td>
                </tr>
                <tr>
                  <td>Home Penalties:</td>
                  <td>{teamTotalStats[team]?.homePenalties || 0}</td>
                </tr>
                <tr>
                  <td>Away Penalties:</td>
                  <td>{teamTotalStats[team]?.awayPenalties || 0}</td>
                </tr>
                <tr>
                  <td>Total Games:</td>
                  <td>{teamTotalStats[team]?.totalGames || 0}</td>
                </tr>
                <tr>
                  <td>Penalties per Game:</td>
                  <td>{((teamTotalStats[team]?.totalPenalties || 0) / (teamTotalStats[team]?.totalGames || 1)).toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="favorable-refs">
        {selectedTeams.map(team => (
          <div key={team}>
            <h3>{team}</h3>
            {getFavorableRefs(team).map(ref => (
              <div key={ref.name} className="ref-bias-item">
                <span className="ref-name">{ref.name}</span>
                <span className={`bias-ratio ${ref.biasRatio < 1 ? 'favorable' : 'unfavorable'}`}>
                  {ref.biasRatio.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {Object.entries(refereeStats as { [key: string]: RefStats[] }).map(([ref, seasons]) => (
        <div key={ref} className="referee-section">
          <h2>{ref}</h2>
          <p>Penalties Delta (per game): {calculatePenaltiesDelta(seasons)}</p>
          <div className="year-buttons">
            {seasons.map(season => (
              <button
                key={season.year}
                onClick={() => handleYearClick(ref, season.year)}
                className={selectedYears[ref] === season.year.toString() ? 'selected' : ''}
              >
                {season.year}
              </button>
            ))}
          </div>
          {seasons.map(season => (
            season.year.toString() === selectedYears[ref] && (
              <div key={season.year} className="season-section">
                <h3>Year: {season.year}</h3>
                <table className="stats-table">
                  <tbody>
                    <tr>
                      <td>Total Games:</td>
                      <td>{season.totalGames}</td>
                      <td>Total Penalties:</td>
                      <td>{season.totalPenalties}</td>
                    </tr>
                    <tr>
                      <td>Home Penalties:</td>
                      <td>{season.homePenalties}</td>
                      <td>Away Penalties:</td>
                      <td>{season.awayPenalties}</td>
                    </tr>
                    <tr>
                      <td>Home/Away Advantage:</td>
                      <td colSpan={3}>
                        {homeAwayAdvantage[ref]?.[season.year]?.toFixed(2) || 'N/A'}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <h4>Team Bias:</h4>
                <table className="bias-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Total Penalties</th>
                      <th>Bias Ratio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(teamBias[ref]?.[season.year] || {})
                      .filter(([team]) => selectedTeams.length === 0 || selectedTeams.includes(team))
                      .sort(([, a], [, b]) => b.biasRatio - a.biasRatio)
                      .map(([team, stats]) => (
                        <tr key={team}>
                          <td>{team}</td>
                          <td>{stats.totalPenalties}</td>
                          <td>{stats.biasRatio.toFixed(2)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )
          ))}
        </div>
      ))}
    </div>
  );
};

export default RefBias;