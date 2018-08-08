import { compareTwoStrings } from 'string-similarity';

import { CacheServiceInterface } from './../services/cacheService';
import { RaceRepositoryInterface } from './../repositories/raceRepository';
import { prettyMs } from '../utils/dateTimeUtils';
import { upperCaseWords } from '../utils/stringUtils';
import { DH_CHECK_P_NOT_SAFE_PRIME } from 'constants';

export interface RaceServiceInterface {
  searchRunner(name: string): Promise<Object>;
  getAllRunnerNames(): Promise<Array<string>>;
  getRunnerNames(partialRunnerName: string): Promise<Object>;
}

export class RaceService implements RaceServiceInterface {
  static allRunnerCacheKey = 'allrunnersnames';
  static allFormattedRunnerCacheKey = 'allformattedrunnersnames';

  cacheService: CacheServiceInterface;
  raceRepository: RaceRepositoryInterface;

  constructor(
    cacheService: CacheServiceInterface,
    raceRepository: RaceRepositoryInterface,
  ) {
    this.cacheService = cacheService;
    this.raceRepository = raceRepository;
  }

  public async searchRunner(name: string): Promise<Object> {
    const nameAndClub = name.split(' - ');
    const nameOfRunner = nameAndClub[0];
    const clubOfRunner = nameAndClub[1];

    if (nameAndClub.length !== 2) {
      return;
    }

    const cacheKey = `searchrunner${nameOfRunner}${clubOfRunner}`;
    const cachedValue = this.cacheService.get(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }

    const clubRunnerNameList: any = await this.getRunnerNames(nameOfRunner);
    let nameVariations = new Array();
    let clubVariations = new Array();

    clubRunnerNameList.items.map((eachRunner: any) => {
      if (
        eachRunner.display.toLowerCase().trim() === name.toLowerCase().trim()
      ) {
        nameVariations = eachRunner.original.split('|');
        clubVariations = eachRunner.club.split('|');

        // @TODO: Hack for me normalising Unknown clubs
        if (clubOfRunner.toLowerCase().trim() === 'unknown') {
          clubVariations.push('');
          clubVariations.push(' ');
        }
      }
    });

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

    const rawRunnersList = await this.raceRepository.getRunnerNames();
    const runnersFormattedList = this.buildRunnersNames(rawRunnersList);
    const searchResults = this.findRunnerByPartialName(
      partialRunnerName,
      runnersFormattedList,
    );
    const runnersInClub = await this.raceRepository.getRunnersClubs(
      searchResults.map((runner: any) => {
        return runner.original;
      }),
    );
    let listToReturn;

    this.cacheService.set(
      RaceService.allFormattedRunnerCacheKey,
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
      RaceService.allRunnerCacheKey,
    );

    if (cachedAllRunnersNames) {
      return cachedAllRunnersNames;
    }

    const runners = await this.raceRepository.getRunnerNames();
    const searchResults = runners.map((runner: string) => {
      return { name: runner };
    });

    this.cacheService.set(RaceService.allRunnerCacheKey, searchResults);

    return runners;
  }

  public async search(
    names: Array<string>,
    clubs: Array<string>,
  ): Promise<Object> {
    const filteredRaces = {
      runner: '',
      races: new Array(),
    };

    if (names.length === 0 || clubs.length === 0) {
      return filteredRaces;
    }

    const cacheKey = `runnernamesclubs${names.join()}${clubs.join()}`;
    const cachedSearchResult = this.cacheService.get(cacheKey);

    if (cachedSearchResult) {
      return cachedSearchResult;
    }

    const races = await this.raceRepository.getRaces(names);

    if (!races) {
      return filteredRaces;
    }

    for (let i = 0; i < names.length; i++) {
      const runnerName = names[i];

      races.forEach((race: any) => {
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
              filteredRaces.races.push({
                id: race.id,
                name: race.race.trim(),
                date: race.date,
                dateTime: raceDateTime,
                resultsUrl: `http://www.fellrunner.org.uk/results.php?id=${
                  race.id
                }`,
                runner: {
                  position: `${runners[0].position} of ${race.numberofrunners}`,
                  racePercentagePosition: this.calculateRacePercentage(
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
              });
            }
          }
        }
      });
    }

    if (filteredRaces) {
      filteredRaces.runner = upperCaseWords(names[0].toLowerCase());
      filteredRaces.races = filteredRaces.races.sort(function(a, b) {
        return b.dateTime - a.dateTime;
      });
    }

    this.cacheService.set(cacheKey, filteredRaces);

    return filteredRaces;
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
