import { compareTwoStrings } from 'string-similarity';
import { AllHtmlEntities } from 'html-entities';

import { CacheServiceInterface } from './cacheService';
import { RaceServiceInterface } from './raceService';
import { ResultRepositoryInterface } from '../repositories/resultRepository';
import { prettyMs, getMonthName } from '../utils/dateTimeUtils';
import { upperCaseWords } from '../utils/stringUtils';
import { isEmpty } from '../utils/objectUtils';
import { RaceSearch } from '../models/raceSearch';
import { Race } from '../models/race';
import { SearchServiceInterface, SearchService } from './searchService';

const entities = new AllHtmlEntities();

export interface ResultServiceInterface {
  searchRunner(
    names: string,
    startIndex: number,
    endIndex: number,
  ): Promise<Object>;
  searchRunnerByRace(names: string, raceNames: string): Promise<Object>;
}

export class ResultService implements ResultServiceInterface {
  static allRunnerCacheKey = 'allrunnersnames';
  static allRawNamesCacheKey = 'allrawnames';
  static allFormattedRunnerCacheKey = 'allformattedrunnersnames';
  static oneDayCacheTime = 86400000;

  cacheService: CacheServiceInterface;
  raceService: RaceServiceInterface;
  searchService: SearchServiceInterface;
  resultRepository: ResultRepositoryInterface;

  constructor(
    cacheService: CacheServiceInterface,
    raceService: RaceServiceInterface,
    searchService: SearchServiceInterface,
    resultRepository: ResultRepositoryInterface,
  ) {
    this.cacheService = cacheService;
    this.raceService = raceService;
    this.searchService = searchService;
    this.resultRepository = resultRepository;
  }

  public async searchRunner(names: string, startIndex: number, endIndex: number): Promise<Object> {
    const cacheKey = `searchrunner${names}${startIndex}${endIndex}`;
    const cachedValue = this.cacheService.get(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }

    const clubRunnerCacheKey = `clubrunner${names}`;
    const clubRunnerCacheValue = this.cacheService.get(clubRunnerCacheKey);
    let runnersAndClubs;

    if (clubRunnerCacheValue) {
      runnersAndClubs = clubRunnerCacheValue;
    } else {
      runnersAndClubs = await this.searchService.searchRunner(names);
    }

    const searchResults = await this.search(
      runnersAndClubs.runners,
      runnersAndClubs.clubs,
      startIndex,
      endIndex,
    );
    this.cacheService.set(cacheKey, searchResults);

    return searchResults;
  }

  public async searchRunnerByRace(
    names: string,
    raceNames: string,
  ): Promise<Object> {
    const decodedRaceNames = entities.decode(raceNames).replace('**', '/');
    const cacheKey = `searchRunnerByRace${names}${decodedRaceNames}`;
    const cachedValue = this.cacheService.get(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }

    const clubRunnerCacheKey = `clubrunner${names}`;
    const clubRunnerCacheValue = this.cacheService.get(clubRunnerCacheKey);
    let runnersAndClubs;

    if (clubRunnerCacheValue) {
      runnersAndClubs = clubRunnerCacheValue;
    } else {
      runnersAndClubs = await this.searchService.searchRunner(names);
    }

    const races = decodedRaceNames.split('||');

    const searchResults = await this.search(
      runnersAndClubs.runners,
      runnersAndClubs.clubs,
      0,
      0,
      races,
    );
    this.cacheService.set(cacheKey, searchResults);

    return searchResults;
  }

  public async getAllRunnerNames(): Promise<Array<string>> {
    const cachedAllRunnersNames = this.cacheService.get(
      ResultService.allRunnerCacheKey,
    );

    if (cachedAllRunnersNames) {
      return cachedAllRunnersNames;
    }

    const runners = await this.searchService.getAllRunnerNames();
    const searchResults = runners.map((runner: string) => {
      return { name: runner };
    });

    this.cacheService.set(ResultService.allRunnerCacheKey, searchResults);

    return runners;
  }

  public async search(
    names: Array<string>,
    clubs: Array<string>,
    startIndex: number,
    endIndex: number,
    racesList?: Array<string>,
  ): Promise<any> {
    let filteredRaces = {
      runner: '',
      races: new Array(),
      overallStats: {},
      raceNames: new Array(),
    };

    if (names.length === 0 || clubs.length === 0) {
      return filteredRaces;
    }

    let cacheKey = `runnernamesclubs${names.join()}${clubs.join()}`;

    if (racesList) {
      cacheKey = `runnernamesclubsraces${names.join()}${clubs.join()}${racesList.join()}`;
    }

    const cachedSearchResult = this.cacheService.get(cacheKey);

    if (cachedSearchResult && racesList) {
      return cachedSearchResult;
    }

    let racesNamesCacheKey = `racenames${names.join()}`;
    let races;

    const cachedRaceNamesResult = this.cacheService.get(racesNamesCacheKey);

    if (cachedRaceNamesResult) {
      races = cachedRaceNamesResult;
    } else {
      races = await this.resultRepository.getRaces(names);
      this.cacheService.set(racesNamesCacheKey, races);
    }

    if (!races) {
      return filteredRaces;
    }

    let overallStats = {
      racesByYear: new Array(),
      overallPosition: 0,
      noOfRaces: 0,
      noOfWins: 0,
      raceWinPercentage: '0%',
      percentagePosition: 0,
      highestPlace: 0,
      highestPercentage: 0,
      bestRace: '',
      overallRaceData: new Array(),
      performanceByYear: new Array(),
      noOfRacesWithInfo: 0,
      kilometersRaced: 0,
      milesRaced: 0,
      metersClimbed: 0,
      feetClimbed: 0,
      longestRace: {},
      shortestRace: {},
      averageRace: {},
    };
    let listOfRaces: RaceSearch[] = [];

    for (let i = 0; i < names.length; i++) {
      const runnerName = names[i];

      races.forEach(async (race: any) => {
        const runners = race.runners.filter(
          (runner: any) =>
            runner.name.toLowerCase() === runnerName.toLowerCase(),
        );

        if (runners.length > 0) {
          // @TODO: Hack for tidying up unattached and empty (Unknown) club
          if (
            clubs.some((club: string) => {
              const clubNameTrimmed = club.toLowerCase().trim();
              const clubNameToCheckTrimmed = runners[0].club
                .toLowerCase()
                .trim();

              if (clubNameTrimmed === 'unattached') {
                if (
                  'ua' === clubNameToCheckTrimmed ||
                  'u/a' === clubNameToCheckTrimmed
                ) {
                  return true;
                }
              }

              if (clubNameTrimmed === 'Unknown') {
                if ('' === clubNameToCheckTrimmed) {
                  return true;
                }
              }

              return clubNameTrimmed === clubNameToCheckTrimmed;
            })
          ) {
            const categoryResult = this.calculateCategoryResult(
              race,
              runners[0],
              runnerName,
            );
            const clubResult = this.calculateClubResult(
              race,
              runners[0],
              runnerName,
            );
            const timeDifferenceFromFirst = this.calculateTimeDifference(
              race.runners,
              runners[0].time,
            );
            const raceSplitDate = race.date.split('/');
            const month = raceSplitDate[1] - 1; // Javascript months are 0-11
            const raceDateTime = new Date(
              raceSplitDate[2],
              month,
              raceSplitDate[0],
            );

            if (
              !filteredRaces.races.some(
                filteredRace => filteredRace.id === race.id,
              )
            ) {
              const raceData = this.buildRaceData(
                race,
                raceDateTime,
                runners,
                categoryResult,
                clubResult,
                timeDifferenceFromFirst,
              );
              filteredRaces.races.push(raceData);
              overallStats = this.updateOverallStats(
                race,
                runners[0],
                overallStats,
              );
            }

            listOfRaces.push(new RaceSearch(race.race.trim(), race.date));
          }
        }
      });
    }

    overallStats = this.buildOverallStats(overallStats, filteredRaces);

    if (filteredRaces) {
      filteredRaces.runner = upperCaseWords(names[0].toLowerCase());
      filteredRaces.raceNames = this.buildUniqueRaceNameList([
        ...new Set(filteredRaces.races.map(each => each.name).sort()),
      ]);
      filteredRaces.races = filteredRaces.races.sort(function(a, b) {
        return b.dateTime - a.dateTime;
      });

      if (endIndex > 0) {
        filteredRaces.races = filteredRaces.races.splice(startIndex, endIndex);
      }

      filteredRaces.overallStats = overallStats;
      filteredRaces = await this.buildRaceInfo(filteredRaces, listOfRaces);
      overallStats.averageRace = this.buildAverageRaceDistance(overallStats);
    }

    // Filter races by a user choosing a particular races
    if (racesList) {
      filteredRaces.races = this.filterRacesByRaceList(
        racesList,
        filteredRaces.races,
      ).sort(function(a, b) {
        return b.dateTime - a.dateTime;
      });
    }

    this.cacheService.set(cacheKey, filteredRaces);

    return filteredRaces;
  }

  private buildOverallStats(overallStats: any, filteredRaces: any) {
    const newOverallStats = Object.assign({}, overallStats);

    if (newOverallStats.noOfWins > 0) {
      newOverallStats.raceWinPercentage = `${Math.round(
        (newOverallStats.noOfWins / newOverallStats.noOfRaces) * 100,
      )}%`;
    }

    newOverallStats.percentagePosition = Math.round(
      newOverallStats.percentagePosition / newOverallStats.noOfRaces,
    );
    newOverallStats.overallPosition = Math.round(
      newOverallStats.overallPosition / newOverallStats.noOfRaces,
    );
    newOverallStats.racesByYear = newOverallStats.racesByYear.sort(
      (a: any, b: any) => {
        return b.year - a.year;
      },
    );
    newOverallStats.overallRaceData = filteredRaces.races.map((race: any) => [
      race.date,
      race.runner.percentagePosition,
    ]);
    newOverallStats.overallRaceData = this.sortByDateAscending(
      newOverallStats.overallRaceData,
    );
    newOverallStats.performanceByYear = this.buildAveragePerformanceByYearData(
      newOverallStats.racesByYear,
    );

    return newOverallStats;
  }

  private filterRacesByRaceList(racesList: Array<string>, races: Array<any>) {
    let filteredRaceList = new Array();

    racesList.map(raceName => {
      const foundRace = races.filter(race => raceName === race.name);

      if (foundRace && Array.isArray(foundRace)) {
        foundRace.map((eachRace: any) => {
          filteredRaceList.push(eachRace);
        });
      } 

      if (foundRace && !Array.isArray(foundRace)) {
        filteredRaceList.push(foundRace);
      }
    });

    return filteredRaceList;
  }

  private areRaceNamesSimilar(
    first: string,
    second: string,
    confidenceLevel: number,
  ): boolean {
    const firstStringSplit = first.split(' ');
    const secondStringSplit = second.split(' ');
    let foundMatch = false;

    if (firstStringSplit.length > 2 && secondStringSplit.length > 2) {
      if (
        compareTwoStrings(
          `${firstStringSplit[0]} ${firstStringSplit[1]} ${
            firstStringSplit[2]
          }`,
          `${secondStringSplit[0]} ${secondStringSplit[1]} ${
            secondStringSplit[2]
          }`,
        ) > confidenceLevel
      ) {
        foundMatch = true;
      }
    } else {
      if (firstStringSplit.length > 1) {
        if (
          compareTwoStrings(
            `${firstStringSplit[0]} ${firstStringSplit[1]}`,
            second,
          ) > confidenceLevel
        ) {
          foundMatch = true;
        }
      }

      if (firstStringSplit.length > 1 && secondStringSplit.length > 1) {
        if (
          compareTwoStrings(
            `${firstStringSplit[0]} ${firstStringSplit[1]}`,
            `${secondStringSplit[0]} ${secondStringSplit[1]}`,
          ) > confidenceLevel
        ) {
          foundMatch = true;
        }
      }
    }

    return foundMatch;
  }

  private buildUniqueRaceNameList(uniqueRaceList: string[]): string[] {
    const confidenceLevel = 0.8;
    let filteredUniqueRaceList = new Array();

    uniqueRaceList.map(race => {
      const splitRaceName = race.split('-');

      if (splitRaceName.length > 1) {
        const raceItem = {
          display: splitRaceName[0].trim(),
          original: race,
        };

        if (
          filteredUniqueRaceList.filter(e => e.display === raceItem.display)
            .length === 0
        ) {
          filteredUniqueRaceList.push(raceItem);
        } else {
          for (let i = 0; i < filteredUniqueRaceList.length; i++) {
            if (
              this.areRaceNamesSimilar(
                filteredUniqueRaceList[i].display,
                raceItem.display,
                confidenceLevel,
              )
            ) {
              filteredUniqueRaceList[i].original += `||${race}`;
              break;
            }

            if (
              filteredUniqueRaceList[i].display === raceItem.display ||
              compareTwoStrings(
                filteredUniqueRaceList[i].display,
                raceItem.display,
              ) > confidenceLevel
            ) {
              filteredUniqueRaceList[i].original += `||${race}`;
              break;
            }
          }
        }
      } else {
        const raceItem = {
          display: race,
          original: race,
        };

        if (
          filteredUniqueRaceList.filter(e => e.display === race).length === 0
        ) {
          let found = false;

          for (let i = 0; i < filteredUniqueRaceList.length; i++) {
            if (
              filteredUniqueRaceList[i].display === raceItem.display ||
              compareTwoStrings(
                filteredUniqueRaceList[i].display,
                raceItem.display,
              ) > confidenceLevel ||
              this.areRaceNamesSimilar(
                filteredUniqueRaceList[i].display,
                raceItem.display,
                confidenceLevel,
              )
            ) {
              filteredUniqueRaceList[i].original += `||${race}`;
              found = true;
              break;
            }
          }

          if (!found) {
            filteredUniqueRaceList.push({
              display: race,
              original: race,
            });
          }
        }
      }
    });

    return filteredUniqueRaceList;
  }

  private buildAverageRaceDistance(overallStats: any) {
    return {
      kilometers: parseFloat(
        parseFloat(
          (
            this.calculatePercentage(
              overallStats.kilometersRaced,
              overallStats.noOfRacesWithInfo,
            ) / 100
          ).toString(),
        ).toLocaleString(),
      ),
      miles: parseFloat(
        parseFloat(
          (
            this.calculatePercentage(
              overallStats.milesRaced,
              overallStats.noOfRacesWithInfo,
            ) / 100
          ).toString(),
        ).toLocaleString(),
      ),
    };
  }

  private buildRaceData(
    race: any,
    raceDateTime: Date,
    runners: any,
    categoryResult: any,
    clubResult: any,
    timeDifferenceFromFirst: string,
  ): object {
    return {
      id: race.id,
      name: race.race.trim(),
      date: race.date,
      dateTime: raceDateTime,
      resultsUrl: `https://fellrunner.org.uk/results.php?id=${race.id}`,
      runner: {
        position: `${runners[0].position} of ${race.numberofrunners}`,
        percentagePosition: Math.round(
          (runners[0].position / race.numberofrunners) * 100,
        ),
        percentagePositionDisplay: this.calculateRacePercentage(
          runners[0].position,
          race.numberofrunners,
        ),
        category: runners[0].category,
        categoryPosition: categoryResult.position,
        categoryPercentage: categoryResult.percentage,
        categoryWinner: categoryResult.winner,
        club: runners[0].club,
        clubPosition: clubResult.position,
        clubPercentage: clubResult.percentage,
        clubWinner: clubResult.winner,
        time: prettyMs(
          this.getNumberOfMillisecondsTaken(runners[0].time),
          null,
        ),
        winner: {
          name: upperCaseWords(race.runners[0].name.toLowerCase()),
          time: prettyMs(
            this.getNumberOfMillisecondsTaken(race.runners[0].time),
            null,
          ),
        },
        timeFromFirst: timeDifferenceFromFirst,
      },
    };
  }

  private async buildRaceInfo(
    raceData: any,
    races: RaceSearch[],
  ): Promise<any> {
    let raceInfoList: Race[];

    try {
      raceInfoList = await this.raceService.getRacesByNamesAndDates(races);
    } catch (exception) {
      console.log(exception);
    }

    for (let i = 0; i < raceData.races.length; i++) {
      const raceInfo = raceInfoList.filter(
        (eachRace: Race) =>
          eachRace.name.toLowerCase().trim() ===
            raceData.races[i].name.toLowerCase().trim() &&
          eachRace.date.toLowerCase().trim() ===
            raceData.races[i].date.toLowerCase().trim(),
      );

      if (raceInfo && raceInfo.length > 0) {
        raceData.races[i].raceInfo = raceInfo[0];

        // Extra race stats iterating over the race collection
        if (raceInfo[0].distanceKilometers > 0) {
          raceData.overallStats.noOfRacesWithInfo =
            raceData.overallStats.noOfRacesWithInfo + 1;
        }

        raceData.overallStats.kilometersRaced = parseFloat(
          parseFloat(
            raceData.overallStats.kilometersRaced +
              raceInfo[0].distanceKilometers,
          ).toFixed(1),
        );
        raceData.overallStats.metersClimbed = parseFloat(
          parseFloat(
            raceData.overallStats.metersClimbed + raceInfo[0].climbMeters,
          ).toFixed(1),
        );
        raceData.overallStats.milesRaced = parseFloat(
          parseFloat(
            raceData.overallStats.milesRaced + raceInfo[0].distanceMiles,
          ).toFixed(1),
        );
        raceData.overallStats.feetClimbed = parseFloat(
          parseFloat(
            raceData.overallStats.feetClimbed + raceInfo[0].climbFeet,
          ).toFixed(1),
        );
        raceData = this.updateRaceDistances(
          raceData,
          raceData.races[i].raceInfo,
        );
      }
    }

    return raceData;
  }

  private updateRaceDistances(raceData: any, raceInfo: any) {
    const buildRaceObject = (raceInfo: any) => {
      return {
        name: `${raceInfo.name} - ${raceInfo.date}`,
        kilometers: raceInfo.distanceKilometers,
        miles: raceInfo.distanceMiles,
      };
    };

    if (isEmpty(raceData.overallStats.longestRace)) {
      raceData.overallStats.longestRace = buildRaceObject(raceInfo);
      raceData.overallStats.shortestRace = raceData.overallStats.longestRace;
    } else {
      if (
        raceInfo.distanceKilometers > 0 &&
        raceInfo.distanceKilometers <
          raceData.overallStats.shortestRace.kilometers
      ) {
        raceData.overallStats.shortestRace = buildRaceObject(raceInfo);
      }

      if (
        raceInfo.distanceKilometers >
        raceData.overallStats.longestRace.kilometers
      ) {
        raceData.overallStats.longestRace = buildRaceObject(raceInfo);
      }
    }

    return raceData;
  }

  private sortByDateAscending(raceData: any): any {
    raceData.sort((a: any, b: any) => {
      const aSplitDate: any = a[0].split('/');
      const aMonth = aSplitDate[1] - 1;
      const aDate = new Date(aSplitDate[2], aMonth, aSplitDate[0]);

      const bSplitDate: any = b[0].split('/');
      const bMonth = bSplitDate[1] - 1;
      const bDate = new Date(bSplitDate[2], bMonth, bSplitDate[0]);

      return aDate.getTime() - bDate.getTime();
    });

    return raceData;
  }

  private updateOverallStats(race: any, runner: any, overallStats: any) {
    const updatedResults = Object.assign({}, overallStats);
    const racePosition = parseInt(runner.position);
    const percentagePosition = this.calculatePercentage(
      runner.position,
      race.numberofrunners,
    );
    const raceSplitDate = race.date.split('/');
    const day = raceSplitDate[0];
    const month = raceSplitDate[1] - 1;
    const year = raceSplitDate[2];
    const raceDateTime = new Date(year, month, day);
    const monthName = getMonthName(raceDateTime);

    if (runner.position === '1') {
      updatedResults.noOfWins = updatedResults.noOfWins + 1;
    }

    if (updatedResults.highestPlace === 0) {
      updatedResults.highestPlace = racePosition;
    } else {
      if (racePosition < updatedResults.highestPlace) {
        updatedResults.highestPlace = racePosition;
      }
    }

    if (updatedResults.highestPercentage === 0) {
      updatedResults.highestPercentage = percentagePosition;
      updatedResults.bestRace = `${race.race.trim()} - ${race.date}`;
    } else {
      if (percentagePosition < updatedResults.highestPercentage) {
        updatedResults.highestPercentage = percentagePosition;
        updatedResults.bestRace = `${race.race.trim()} - ${race.date}`;
        updatedResults.bestRaceId = race.id;
      }
    }

    updatedResults.noOfRaces = updatedResults.noOfRaces + 1;
    updatedResults.overallPosition =
      parseInt(updatedResults.overallPosition) + racePosition;
    updatedResults.percentagePosition =
      updatedResults.percentagePosition + percentagePosition;
    updatedResults.racesByYear = this.groupRacesByMonthAndYear(
      updatedResults.racesByYear,
      year,
      monthName,
      percentagePosition,
    );
    updatedResults.performanceByMonthData = this.buildAveragePerformanceByMonthData(
      updatedResults.racesByYear,
    );
    updatedResults.performanceByYearData = this.buildAveragePerformanceByYearData(
      updatedResults.racesByYear,
    );

    return updatedResults;
  }

  private buildAveragePerformanceByMonthData(racesByYear: any): Array<any> {
    const buildYearMonthEntry = (
      eachYear: any,
      eachMonthName: string,
      eachMonth: any,
    ) => [`${eachYear.year}-${eachMonthName}`, `${eachMonth.performance}%`];
    const getArrayOfSize12 = () => {
      let monthsOfYearArray = new Array();

      for (let i = 0; i < 12; i++) {
        monthsOfYearArray.push([]);
      }

      return monthsOfYearArray;
    };
    let performanceData = new Array();
    let completedMonths = new Array();

    racesByYear
      .sort((a: any, b: any) => parseInt(a.year, 10) > parseInt(b.year, 10))
      .map((eachYear: any) => {
        const monthsOfYearArray = getArrayOfSize12();
        let yearData = { year: eachYear.year, months: monthsOfYearArray };

        eachYear.months.map((eachMonth: any) => {
          const eachMonthName = Object.keys(eachMonth)[0];

          switch (eachMonthName.toLowerCase()) {
            case 'january':
              yearData.months[0] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'february':
              yearData.months[1] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'march':
              yearData.months[2] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'april':
              yearData.months[3] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'may':
              yearData.months[4] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'june':
              yearData.months[5] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'july':
              yearData.months[6] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'august':
              yearData.months[7] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'september':
              yearData.months[8] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'october':
              yearData.months[9] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'november':
              yearData.months[10] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
            case 'december':
              yearData.months[11] = buildYearMonthEntry(
                eachYear,
                eachMonthName,
                eachMonth,
              );
              break;
          }
        });

        performanceData.push(yearData);
      });

    performanceData.map((eachYear: any) => {
      eachYear.months.map((eachMonth: any) => {
        if (eachMonth.length !== 0) {
          completedMonths.push(eachMonth);
        }
      });
    });

    return completedMonths;
  }

  private buildAveragePerformanceByYearData(racesByYear: any): Array<any> {
    let performanceData = new Array();

    racesByYear
      .sort((a: any, b: any) => parseInt(a.year, 10) > parseInt(b.year, 10))
      .map((eachYear: any) => {
        let averagePerformance = 0;

        eachYear.months.map((eachMonth: any) => {
          averagePerformance = averagePerformance + eachMonth.performance;
        });

        performanceData.push([
          eachYear.year,
          Math.round(averagePerformance / eachYear.months.length),
        ]);
      });

    return performanceData;
  }

  private groupRacesByMonthAndYear(
    racesByYear: any,
    year: number,
    monthName: string,
    percentagePosition: number,
  ) {
    let yearFound = false;
    let monthFound = false;

    racesByYear.map((eachYear: any) => {
      if (eachYear.year === year) {
        yearFound = true;

        eachYear.months.map((eachMonth: any) => {
          const eachMonthName = Object.keys(eachMonth)[0];

          if (
            eachMonthName.toLowerCase().trim() ===
            monthName.toLowerCase().trim()
          ) {
            monthFound = true;

            if (percentagePosition > eachMonth.performance) {
              eachMonth.performance = percentagePosition;
            }

            eachMonth[eachMonthName]++;
          }
        });
      }
    });

    if (yearFound && monthFound) {
      return racesByYear;
    }

    if (!yearFound && !monthFound) {
      racesByYear.push({
        year: year,
        months: [
          {
            [monthName]: 1,
            performance: percentagePosition,
          },
        ],
      });

      return racesByYear;
    }

    racesByYear.map((eachYear: any) => {
      if (eachYear.year === year) {
        eachYear.months.map((eachMonth: any) => {
          const eachMonthName = Object.keys(eachMonth)[0];

          if (
            eachMonthName.toLowerCase().trim() ===
            monthName.toLowerCase().trim()
          ) {
            monthFound = true;
          }
        });

        if (!monthFound) {
          eachYear.months.push({
            [monthName]: 1,
            performance: percentagePosition,
          });
        }
      }
    });

    return racesByYear;
  }

  private calculatePercentage(first: number, second: number): number {
    return Math.round(Math.floor((first / second) * 100));
  }

  private calculateRacePercentage(
    position: number,
    numberOfRunners: number,
  ): any {
    if (position === 1) {
      return 'Winner!';
    } else {
      let percent = this.calculatePercentage(position, numberOfRunners);

      if (percent === 0) {
        percent = 1;
      }

      return `Top ${percent}%`;
    }
  }

  private calculateCategoryResult(
    race: any,
    runner: any,
    runnerName: string,
  ): any {
    const runnersInCategory = race.runners.filter(
      (eachRunner: any) =>
        eachRunner.category.toLowerCase() === runner.category.toLowerCase(),
    );
    const countInCategory = runnersInCategory.length;
    let position;
    let percentage;

    for (let i = 0; i < countInCategory; i++) {
      if (
        runnersInCategory[i].name.toLowerCase() === runnerName.toLowerCase()
      ) {
        const positionResult = i + 1;
        position = `${positionResult} of ${countInCategory}`;

        if (positionResult === 1) {
          percentage = `Fastest ${runnersInCategory[i].category}`;
        } else {
          let percent = this.calculatePercentage(
            positionResult,
            countInCategory,
          );

          if (percent === 0) {
            percent = 1;
          }

          percentage = `Top ${percent}%`;
        }
        break;
      }
    }

    const winner = {
      name: upperCaseWords(runnersInCategory[0].name.toLowerCase()),
      time: prettyMs(
        this.getNumberOfMillisecondsTaken(runnersInCategory[0].time),
        null,
      ),
    };

    return { position, percentage, winner };
  }

  private calculateClubResult(race: any, runner: any, runnerName: string): any {
    const runnersInClub = race.runners.filter(
      (eachRunner: any) =>
        eachRunner.club.toLowerCase() === runner.club.toLowerCase(),
    );
    const countInClub = runnersInClub.length;
    let position;
    let percentage = '';

    for (let i = 0; i < countInClub; i++) {
      if (runnersInClub[i].name.toLowerCase() === runnerName.toLowerCase()) {
        const positionResult = i + 1;
        position = `${positionResult} of ${countInClub}`;

        if (positionResult > 1) {
          percentage = `Top ${this.calculatePercentage(
            positionResult,
            countInClub,
          )}%`;
        }
        break;
      }
    }

    const winner = {
      name: upperCaseWords(runnersInClub[0].name.toLowerCase()),
      time: prettyMs(
        this.getNumberOfMillisecondsTaken(runnersInClub[0].time),
        null,
      ),
    };

    return { position, percentage, winner };
  }

  private getNumberOfMillisecondsTaken(raceDuration: string): number {
    let minutesTaken = 0;
    let secondsTaken = 0;

    if (parseInt(raceDuration.substring(0, 2), 10) > 0) {
      minutesTaken = parseInt(raceDuration.substring(0, 2), 10) * 60;
    }

    if (parseInt(raceDuration.substring(3, 5), 10) > 0) {
      minutesTaken = minutesTaken + parseInt(raceDuration.substring(3, 5), 10);
    }

    secondsTaken = minutesTaken * 60;

    if (parseInt(raceDuration.substring(6, 8), 10) > 0) {
      secondsTaken = secondsTaken + parseInt(raceDuration.substring(6, 8), 10);
    }

    return secondsTaken * 1000;
  }

  private calculateTimeDifference(
    runnersInRace: Array<any>,
    runnerTime: string,
  ): string {
    const firstRunnerTime = runnersInRace[0].time;
    const runnerToCheckNumberOfSeconds = this.getNumberOfMillisecondsTaken(
      runnerTime,
    );
    const firstPlaceNumberOfSeconds = this.getNumberOfMillisecondsTaken(
      firstRunnerTime,
    );
    const differenceFromFirstPlace =
      runnerToCheckNumberOfSeconds - firstPlaceNumberOfSeconds;
    const timeFromFirst = prettyMs(differenceFromFirstPlace, null);

    return timeFromFirst === '0ms' ? '' : timeFromFirst;
  }
}
