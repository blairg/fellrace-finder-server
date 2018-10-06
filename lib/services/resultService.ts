import { compareTwoStrings } from 'string-similarity';

import { CacheServiceInterface } from './cacheService';
import { RaceServiceInterface } from './raceService';
import { ResultRepositoryInterface } from '../repositories/resultRepository';
import { prettyMs, getMonthName } from '../utils/dateTimeUtils';
import { upperCaseWords } from '../utils/stringUtils';
import { RaceSearch } from '../models/raceSearch';
import { Race } from '../models/race';

export interface ResultServiceInterface {
  searchRunner(name: string): Promise<Object>;
  getAllRunnerNames(): Promise<Array<string>>;
  getRunnerNames(partialRunnerName: string): Promise<Object>;
}

export class ResultService implements ResultServiceInterface {
  static allRunnerCacheKey = 'allrunnersnames';
  static allFormattedRunnerCacheKey = 'allformattedrunnersnames';

  cacheService: CacheServiceInterface;
  raceService: RaceServiceInterface;
  resultRepository: ResultRepositoryInterface;

  constructor(
    cacheService: CacheServiceInterface,
    raceService: RaceServiceInterface,
    resultRepository: ResultRepositoryInterface,
  ) {
    this.cacheService = cacheService;
    this.raceService = raceService;
    this.resultRepository = resultRepository;
  }

  public async searchRunner(names: string): Promise<Object> {
    const cacheKey = `searchrunner${names}`;
    const cachedValue = this.cacheService.get(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }

    const listOfNames = names.split('$$');
    let nameVariations = new Array();
    let clubVariations = new Array();

    for (let i = 0; i < listOfNames.length; i++) {
      const nameAndClub = listOfNames[i].split(' - ');
      const nameOfRunner = nameAndClub[0];
      const clubOfRunner = nameAndClub[1];

      if (nameAndClub.length === 2) {
        const clubToRunnerList: any = await this.getRunnerNames(nameOfRunner);

        clubToRunnerList.items.map((eachClubRunner: any) => {
          eachClubRunner.original.split('|').map((eachOriginalName: string) => {
            nameVariations.push(eachOriginalName);
          });

          eachClubRunner.club.split('|').map((eachClub: string) => {
            const runnerToCheck = { club: eachClub };
            const runnerSearchedOn = { club: clubOfRunner };

            if (this.isClubNameSimilar(runnerToCheck, runnerSearchedOn)) {
              clubVariations.push(eachClub);
            }
          });

          // @TODO: Hack for me normalising Unknown clubs
          if (
            clubVariations.some(
              (club: string) =>
                club.toLowerCase().trim() === 'unknown' &&
                (!clubVariations.some((club: string) => club === '') &&
                  !clubVariations.some((club: string) => club === ' ')),
            )
          ) {
            clubVariations.push('');
            clubVariations.push(' ');
          }
        });
      }
    }

    const searchResults = await this.search(nameVariations, clubVariations);
    this.cacheService.set(cacheKey, searchResults);

    return searchResults;
  }

  public async getRunnerNames(partialRunnerName: string): Promise<Object> {
    if (partialRunnerName.trim().length < 3) {
      return { items: [] };
    }

    const partialMatchCacheKey = `partialnamematch${partialRunnerName}`;
    const cachedPartialName = this.cacheService.get(partialMatchCacheKey);

    if (cachedPartialName) {
      return cachedPartialName;
    }

    let cachedAllRunnersNames;

    if (cachedAllRunnersNames) {
      let runners = this.findRunnerByPartialName(
        partialRunnerName,
        cachedAllRunnersNames,
      );

      if (runners.length > 0) {
        const listToReturn = { items: runners };
        this.cacheService.set(partialMatchCacheKey, listToReturn);

        return listToReturn;
      }

      return { items: [] };
    }

    const rawRunnersList = await this.resultRepository.getRunnerNames();
    const runnersFormattedList = this.buildRunnersNames(rawRunnersList);
    const searchResults = this.findRunnerByPartialName(
      partialRunnerName,
      runnersFormattedList,
    );
    const runnersInClub = await this.resultRepository.getRunnersClubs(
      searchResults.map((runner: any) => {
        return runner.original;
      }),
    );
    let listToReturn;

    this.cacheService.set(
      ResultService.allFormattedRunnerCacheKey,
      runnersFormattedList,
      86400000,
    );

    if (searchResults.length > 0) {
      let runnersWithClubAndCount = this.appendClubNamesAndCount(
        searchResults,
        runnersInClub,
      );

      runnersWithClubAndCount = this.flattenClubsToRunner(
        runnersWithClubAndCount,
      );

      listToReturn = { items: runnersWithClubAndCount };

      this.cacheService.set(partialMatchCacheKey, listToReturn);

      return listToReturn;
    }

    listToReturn = { items: [] };
    this.cacheService.set(partialMatchCacheKey, listToReturn);

    return listToReturn;
  }

  public async getAllRunnerNames(): Promise<Array<string>> {
    const cachedAllRunnersNames = this.cacheService.get(
      ResultService.allRunnerCacheKey,
    );

    if (cachedAllRunnersNames) {
      return cachedAllRunnersNames;
    }

    const runners = await this.resultRepository.getRunnerNames();
    const searchResults = runners.map((runner: string) => {
      return { name: runner };
    });

    this.cacheService.set(ResultService.allRunnerCacheKey, searchResults);

    return runners;
  }

  public async search(
    names: Array<string>,
    clubs: Array<string>,
  ): Promise<Object> {
    const filteredRaces = {
      runner: '',
      races: new Array(),
      overallStats: {},
    };

    if (names.length === 0 || clubs.length === 0) {
      return filteredRaces;
    }

    const cacheKey = `runnernamesclubs${names.join()}${clubs.join()}`;
    const cachedSearchResult = this.cacheService.get(cacheKey);

    if (cachedSearchResult) {
      return cachedSearchResult;
    }

    const races = await this.resultRepository.getRaces(names);

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

    if (overallStats.noOfWins > 0) {
      overallStats.raceWinPercentage = `${Math.round(
        (overallStats.noOfWins / overallStats.noOfRaces) * 100,
      )}%`;
    }

    overallStats.percentagePosition = Math.round(
      overallStats.percentagePosition / overallStats.noOfRaces,
    );
    overallStats.overallPosition = Math.round(
      overallStats.overallPosition / overallStats.noOfRaces,
    );
    overallStats.racesByYear = overallStats.racesByYear.sort((a, b) => {
      return b.year - a.year;
    });
    overallStats.overallRaceData = filteredRaces.races.map((race: any) => [
      race.date,
      race.runner.percentagePosition,
    ]);
    overallStats.overallRaceData = this.sortByDateAscending(
      overallStats.overallRaceData,
    );
    overallStats.performanceByYear = this.buildAveragePerformanceByYearData(
      overallStats.racesByYear,
    );

    if (filteredRaces) {
      filteredRaces.runner = upperCaseWords(names[0].toLowerCase());
      filteredRaces.races = filteredRaces.races.sort(function(a, b) {
        return b.dateTime - a.dateTime;
      });
      filteredRaces.overallStats = overallStats;

      filteredRaces.races = await this.buildRaceInfo(
        filteredRaces.races,
        listOfRaces,
      );
    }

    this.cacheService.set(cacheKey, filteredRaces);

    return filteredRaces;
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
      // raceInfo: raceInfo,
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
  ): Promise<Array<any>> {
    let raceInfoList: Race[];

    try {
      raceInfoList = await this.raceService.getRaces(races);
    } catch (exception) {
      console.log(exception);
    }

    for (let i = 0; i < raceData.length; i++) {
      const raceInfo = raceInfoList.filter(
        (eachRace: Race) =>
          eachRace.name.toLowerCase().trim() ===
            raceData[i].name.toLowerCase().trim() &&
          eachRace.date.toLowerCase().trim() ===
            raceData[i].date.toLowerCase().trim(),
      );

      if (raceInfo && raceInfo.length > 0) {
        raceData[i].raceInfo = raceInfo[0];
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

  private appendClubNamesAndCount(
    searchResults: Array<any>,
    runnersInClub: Array<any>,
  ): Array<any> {
    const resultsToReturn = new Array();

    runnersInClub.map((runnerInClub: any) => {
      searchResults.map((searchResult: any) => {
        if (
          searchResult.original.toLowerCase() ===
          runnerInClub.name.toLowerCase()
        ) {
          if (
            !resultsToReturn.some(
              result =>
                result.display === searchResult.display &&
                result.original === searchResult.original &&
                result.club === searchResult.club,
            )
          ) {
            resultsToReturn.push({
              display: searchResult.display,
              original: searchResult.original,
              club: runnerInClub.club,
              count: runnerInClub.count,
            });
          }
        }
      });
    });

    return resultsToReturn;
  }

  private flattenClubsToRunner(
    runnersWithClubAndCount: Array<any>,
  ): Array<any> {
    const flattenedListOfRunners = new Array();

    // @TODO: Find most common club and use that to suffix the club name to display property
    runnersWithClubAndCount.map((runner: any) => {
      if (flattenedListOfRunners.length === 0) {
        flattenedListOfRunners.push(runner);
      } else {
        let exists = false;

        for (let i = 0; i < flattenedListOfRunners.length; i++) {
          if (
            runner.display.toLowerCase() ===
            flattenedListOfRunners[i].display.toLowerCase()
          ) {
            if (!this.isClubNameSimilar(runner, flattenedListOfRunners[i])) {
              continue;
            }

            // @TODO: Tidy me please!
            let nameAlreadyAdded = false;

            flattenedListOfRunners[i].original
              .split('|')
              .map((eachName: string) => {
                if (eachName === runner.original) {
                  nameAlreadyAdded = true;
                }
              });

            if (!nameAlreadyAdded) {
              flattenedListOfRunners[i].original += `|${runner.original}`;
            }

            let clubAlreadyAdded = false;

            flattenedListOfRunners[i].club
              .split('|')
              .map((eachClub: string) => {
                if (eachClub === runner.club) {
                  clubAlreadyAdded = true;
                }
              });

            if (!clubAlreadyAdded) {
              flattenedListOfRunners[i].club += `|${runner.club}`;
            }

            exists = true;

            break;
          } else {
            // If runner name is a close match and club name is in the list then append
            if (
              compareTwoStrings(
                runner.display.toLowerCase(),
                flattenedListOfRunners[i].display.toLowerCase(),
              ) >= 0.5
            ) {
              let clubExists = false;

              if (!flattenedListOfRunners[i].club) {
                flattenedListOfRunners[i].club = runner.club;
              } else {
                flattenedListOfRunners[i].club
                  .split('|')
                  .map((club: string) => {
                    if (
                      runner.club === club ||
                      this.isClubNameSimilar(runner, flattenedListOfRunners[i])
                    ) {
                      clubExists = true;
                    }
                  });
              }

              if (clubExists) {
                exists = true;

                // @TODO: Duplication from above!
                let nameAlreadyAdded = false;

                flattenedListOfRunners[i].original
                  .split('|')
                  .map((eachName: string) => {
                    if (eachName === runner.original) {
                      nameAlreadyAdded = true;
                    }
                  });

                if (!nameAlreadyAdded) {
                  flattenedListOfRunners[i].original += `|${runner.original}`;
                }

                let clubAlreadyAdded = false;

                flattenedListOfRunners[i].club
                  .split('|')
                  .map((eachClub: string) => {
                    if (eachClub === runner.club) {
                      clubAlreadyAdded = true;
                    }
                  });

                if (!clubAlreadyAdded) {
                  flattenedListOfRunners[i].club += `|${runner.club}`;
                }
              }
            }
          }
        }

        if (!exists) {
          flattenedListOfRunners.push(runner);
        }
      }
    });

    flattenedListOfRunners.map(
      runner => (runner = this.appendClubName(runner)),
    );

    return flattenedListOfRunners;
  }

  private appendClubName(runner: any): any {
    if (runner && runner.club) {
      const clubNames = runner.club.split('|')[0];

      if (clubNames.length === 1) {
        // Don't want to tidy acronyms
        runner.display = `${runner.display} - ${runner.club.split('|')[0]}`;
      } else {
        runner.display = `${runner.display} - ${upperCaseWords(
          runner.club.split('|')[0],
        )}`;
      }
    }

    return runner;
  }

  private isClubNameSimilar(
    runnerToCheck: any,
    runnerAlreadyAdded: any,
  ): boolean {
    let isClubNameSimilar = false;

    const runnerToCheckClubs = runnerToCheck.club.split('|');
    const runnerAlreadyAddedClubs = runnerAlreadyAdded.club.split('|');

    runnerToCheckClubs.map((toClub: string) => {
      runnerAlreadyAddedClubs.map((addedClub: string) => {
        const formattedToClubName = this.tidyClubName(toClub);
        const formattedAddedClubName = this.tidyClubName(addedClub);

        // Check if the first word of each club name is similar
        if (
          formattedToClubName.includes(' ') &&
          formattedAddedClubName.includes(' ')
        ) {
          if (
            compareTwoStrings(
              formattedToClubName.split(' ')[0].toLowerCase(),
              formattedAddedClubName.split(' ')[0].toLowerCase(),
            ) >= 0.5
          ) {
            isClubNameSimilar = true;
          }
        } else {
          // Check if the first word of each club name is similar
          if (
            formattedToClubName.includes('') &&
            formattedAddedClubName.includes(' ')
          ) {
            if (
              compareTwoStrings(
                formattedToClubName.toLowerCase(),
                formattedAddedClubName.split(' ')[0].toLowerCase(),
              ) >= 0.5
            ) {
              isClubNameSimilar = true;
            }
          }

          // Check if the first word of each club name is similar
          if (
            formattedToClubName.includes(' ') &&
            formattedAddedClubName.includes('')
          ) {
            if (
              compareTwoStrings(
                formattedToClubName.split(' ')[0].toLowerCase(),
                formattedAddedClubName.toLowerCase(),
              ) >= 0.5
            ) {
              isClubNameSimilar = true;
            }
          }

          // Check if club names match with spaces removed
          if (
            compareTwoStrings(
              formattedToClubName.replace(' ', '').toLowerCase(),
              formattedAddedClubName.replace(' ', '').toLowerCase(),
            ) >= 0.5
          ) {
            isClubNameSimilar = true;
          }

          // First name of each club does not match, but may match an acronym
          // check for acronymns
          if (formattedToClubName.includes(' ')) {
            const toClubAcronymn = formattedToClubName
              .split(' ')
              .map((s: string) => s.toLowerCase().substring(0, 1))
              .join('');

            let addedClubAcronymn;

            if (formattedAddedClubName.includes(' ')) {
              addedClubAcronymn = formattedAddedClubName
                .split(' ')
                .map((s: string) => s.toLowerCase().substring(0, 1))
                .join('');
            } else {
              addedClubAcronymn = formattedAddedClubName;
            }

            // Check if acronymns of the names are similar
            if (compareTwoStrings(toClubAcronymn, addedClubAcronymn) >= 0.3) {
              isClubNameSimilar = true;
            }
          }

          if (formattedAddedClubName.includes(' ')) {
            const acronymn = formattedAddedClubName
              .split(' ')
              .map((s: string) => s.toLowerCase().substring(0, 1))
              .join('');

            if (compareTwoStrings(acronymn, formattedToClubName) >= 0.3) {
              isClubNameSimilar = true;
            }
          }

          if (
            compareTwoStrings(formattedToClubName, formattedAddedClubName) >=
            0.5
          ) {
            isClubNameSimilar = true;
          }
        }
      });
    });

    return isClubNameSimilar;
  }

  private tidyClubName(clubName: string): string {
    return clubName
      .trim()
      .toLowerCase()
      .replace(/\./g, '')
      .replace('&', '')
      .replace(' & ', ' ')
      .replace(' and ', ' ')
      .replace('.', ' ')
      .replace('-', ' ');
  }

  private buildRunnersNames(runners: Array<string>): Array<Object> {
    return runners.map(name => {
      let displayName = upperCaseWords(
        name.toLowerCase().replace(/[ ][ ]*/i, ' '),
      ).trim();

      if (name.includes(',') && name.split(',').length === 2) {
        const nameParts = name.split(',');
        displayName = upperCaseWords(
          `${nameParts[1]
            .toLowerCase()
            .trim()} ${nameParts[0].toLowerCase().trim()}`
            .toLowerCase()
            .replace(/[ ][ ]*/i, ' '),
        );
      }

      return {
        display: displayName,
        original: name,
      };
    });
  }

  private findRunnerByPartialName(
    partialRunnerName: string,
    listOfRunners: Array<any>,
  ): Array<string> {
    let runnersNamesFound: any[] = [];

    if (listOfRunners.length > 0) {
      const length = listOfRunners.length;

      for (let i = 0; i < length; i++) {
        const displayName = listOfRunners[i].display.toLowerCase();

        if (displayName.startsWith(partialRunnerName.toLowerCase())) {
          runnersNamesFound.push(listOfRunners[i]);
        }

        if (runnersNamesFound.length === 10) {
          break;
        }
      }
    }

    return runnersNamesFound;
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
