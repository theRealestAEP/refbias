import React, { useState, useEffect, useMemo } from 'react';
import refereeStats from '../data/referee_stats.json';
import winLossStats from '../data/winloss_ref_stats.json';
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
    winner?: string;
}

interface TeamBias {
    [refName: string]: {
        [year: number]: {
            [team: string]: TeamStats
        }
    }
}

interface TeamStats {
    teamStats: {
        wins: number;
        losses: number;
        ties?: number;
    };
    totalGames: number;
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

interface WinLossStats {
    [refName: string]: {
        [year: string]: {
            teamStats: {
                [team: string]: { wins: number; losses: number; ties: number }
            }
        }
    }
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

    const teamNameMapping: { [key: string]: string } = {
        "Washington": "Washington Commanders",
        "Cincinnati": "Cincinnati Bengals",
        "Minnesota": "Minnesota Vikings",
        "Seattle": "Seattle Seahawks",
        "Las Vegas": "Las Vegas Raiders",
        "Denver": "Denver Broncos",
        "Tampa Bay": "Tampa Bay Buccaneers",
        "N.Y. Giants": "New York Giants",
        "New York Jets": "New York Jets",
        "San Francisco": "San Francisco 49ers",
        "Kansas City": "Kansas City Chiefs",
        "Baltimore": "Baltimore Ravens",
        "Buffalo": "Buffalo Bills",
        "Miami": "Miami Dolphins",
        "Atlanta": "Atlanta Falcons",
        "Carolina": "Carolina Panthers",
        "Detroit": "Detroit Lions",
        "Dallas": "Dallas Cowboys",
        "Philadelphia": "Philadelphia Eagles",
        "Pittsburgh": "Pittsburgh Steelers",
        "Cleveland": "Cleveland Browns",
        "Indianapolis": "Indianapolis Colts",
        "Jacksonville": "Jacksonville Jaguars",
        "Tennessee": "Tennessee Titans",
        "Arizona": "Arizona Cardinals",
        "LA Rams": "Los Angeles Rams",
        "LA Chargers": "Los Angeles Chargers",
        "New Orleans": "New Orleans Saints",
        "Chicago": "Chicago Bears",
        "New England": "New England Patriots",
        "Green Bay": "Green Bay Packers",
        "Houston": "Houston Texans",
        "N.Y. Jets": "New York Jets",
        // Add more mappings as needed
    };



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

    useEffect(() => {
        console.log('Updated teamBias:', teamBias);
    }, [teamBias]);
    
    const getShortTeamName = (fullName: string): string => {
        for (const [short, full] of Object.entries(teamNameMapping)) {
          if (fullName.includes(full)) {
            return short;
          }
        }
        return fullName.split(' ').pop() || fullName; // Return last word of team name or full name if no space
      };

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
                            yearBias[team] = { teamStats: { wins: 0, losses: 0, ties: 0 }, biasRatio: 0, totalPenalties: 0, totalGames: 0 };
                            teamGames[team] = 0;
                        }
                        yearBias[team].totalPenalties += penalties;
                        yearBias[team].totalGames++;
                        teamGames[team]++;
                    });
                });

                // Calculate bias ratio and store total penalties
                Object.keys(yearBias).forEach(team => {
                    const refKey = refName.toLowerCase().replace(/\s+/g, '-');
                    const refWinLossData = (winLossStats as WinLossStats)[refKey];
                    const yearWinLossData = refWinLossData?.[season.year.toString()]?.teamStats;
                    const longTeamName = teamNameMapping[team] || team;
                    const teamWinLossData = yearWinLossData?.[longTeamName];

                    const totalGames = teamWinLossData ? 
                        (teamWinLossData.wins + teamWinLossData.losses + (teamWinLossData.ties || 0)) || 1 : 
                        1;

                    const avgPenalties = yearBias[team].totalPenalties / totalGames;
                    yearBias[team].biasRatio = avgPenalties / leagueAverages[season.year];
                    yearBias[team].totalGames = totalGames;
                });

                // Add win-loss data from winLossStats
                const refKey = refName.toLowerCase().replace(/\s+/g, '-');
                console.log('Looking for ref key:', refKey);
                const refWinLossData = (winLossStats as WinLossStats)[refKey];
                console.log('Test:\n', winLossStats['adrian-hill']);
                console.log('Test2:\n', refWinLossData);
                // console.log('Test:\n', refWinLossData["adrian-hill"]);
                // console.log('Ref win-loss data:', refWinLossData);
                if (refWinLossData) {
                    console.log('Found win-loss data for', refName);
                    if (refWinLossData[season.year.toString()]) {
                        const yearWinLossData = refWinLossData[season.year.toString()].teamStats;
                        Object.keys(yearBias).forEach(team => {
                            const longTeamName = teamNameMapping[team] || team;
                            console.log('Long team name:', longTeamName);
                            if (yearWinLossData[longTeamName]) {
                                yearBias[team].teamStats = {
                                    wins: yearWinLossData[longTeamName].wins,
                                    losses: yearWinLossData[longTeamName].losses,
                                    ties: yearWinLossData[longTeamName].ties
                                };
                                console.log(`Updated ${refName} ${season.year} ${team}: W:${yearBias[team].teamStats.wins} L:${yearBias[team].teamStats.losses} T:${yearBias[team].teamStats.ties}`);
                            } else {
                                console.log(`No win-loss data for ${refName} ${season.year} ${longTeamName}`);
                            }
                        });
                    } else {
                        console.log('No data for', refName, 'in year', season.year);
                    }
                } else {
                    console.log('No win-loss data found for', refName);
                }

                console.log(`Processed bias for ${refName} in ${season.year}:`, yearBias);
                bias[refName][season.year] = yearBias;
            });
        });

        console.log('Final calculated bias:', bias);
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
        return Object.entries(teamBias).map(([refName, yearData]) => {
            const yearlyBias = Object.entries(yearData)
                .filter(([year, teamData]) => team in teamData)
                .map(([year, teamData]) => ({
                    year: parseInt(year),
                    biasRatio: teamData[team].biasRatio,
                    totalPenalties: teamData[team].totalPenalties,
                    wins: teamData[team].teamStats.wins,
                    losses: teamData[team].teamStats.losses,
                    ties: teamData[team].teamStats.ties
                }))
                .sort((a, b) => b.year - a.year);

            return { name: refName, yearlyBias };
        }).sort((a, b) => {
            const aLatestBias = a.yearlyBias[0]?.biasRatio || 0;
            const bLatestBias = b.yearlyBias[0]?.biasRatio || 0;
            return bLatestBias - aLatestBias;
        });
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
    console.log('Filtered refs:', filteredRefs);

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

    console.log('Referee names in refereeStats:', Object.keys(refereeStats));
    console.log('Referee names in winLossStats:', Object.keys(winLossStats));

    useEffect(() => {
        console.log('Referee data:', refData);
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
                    <div key={team} className="team-section">
                        <h3>{team}</h3>
                        {getFavorableRefs(team).map(ref => (
                            <div key={ref.name} className="ref-bias-item">
                                <h4>{ref.name}</h4>
                                <table className="ref-bias-table">
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            <th>Bias Ratio</th>
                                            <th>Penalties</th>
                                            <th>Record</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ref.yearlyBias.map(yearData => (
                                            <tr key={yearData.year}>
                                                <td>{yearData.year}</td>
                                                <td className={yearData.biasRatio < 1 ? 'favorable' : 'unfavorable'}>
                                                    {yearData.biasRatio.toFixed(2)}
                                                </td>
                                                <td>{yearData.totalPenalties}</td>
                                                <td>{`${yearData.wins}-${yearData.losses}${yearData.ties?.toString() ? `-${yearData.ties}` : ''}`}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {filteredRefs.map(ref => (
                <div key={ref} className="referee-section">
                    <h2>{ref}</h2>

                    <p>Penalties Delta (per game): {calculatePenaltiesDelta(refData[ref])}</p>
                    <div className="year-buttons">
                        {refData[ref].map(season => (
                            <button
                                key={season.year}
                                onClick={() => handleYearClick(ref, season.year)}
                                className={selectedYears[ref] === season.year.toString() ? 'selected' : ''}
                            >
                                {season.year}
                            </button>
                        ))}
                    </div>
                    {refData[ref].map(season => (
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
                                <h4>Team Bias and Record:</h4>
                                <table className="bias-table">
                                    <thead>
                                        <tr>
                                            <th>Team</th>
                                            <th>Total Penalties</th>
                                            <th>Bias Ratio</th>
                                            <th>Record</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {Object.entries(teamBias[ref]?.[season.year] || {})
                                            .filter(([team]) => selectedTeams.length === 0 || selectedTeams.includes(team))
                                            .sort((a, b) => b[1].biasRatio - a[1].biasRatio)
                                            .map(([team, stats]) => (
                                                <tr key={team}>
                                                    <td>{team}</td>
                                                    <td>{stats.totalPenalties}</td>
                                                    <td>{stats.biasRatio.toFixed(2)}</td>
                                                    <td>{`${stats.teamStats.wins}-${stats.teamStats.losses}${stats.teamStats.ties?.toString() ? `-${stats.teamStats.ties}` : ''}`}</td>
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