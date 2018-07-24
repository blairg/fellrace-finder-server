import axios from 'axios';

import { CacheServiceInterface } from './../services/cacheService';
import { RaceRepositoryInterface } from './../repositories/raceRepository';
import { prettyMs } from '../utils/dateTimeUtils';
import { upperCaseWords } from '../utils/stringUtils';

export interface RaceServiceInterface {
  searchRunner(name: string): Promise<Object>;
  getAllRunnerNames(): Promise<Array<string>>;
  getRunnerNames(partialRunnerName: string): Promise<Object>;
}

export class RaceService implements RaceServiceInterface {
    static allRunnerCacheKey = 'allrunnersnames';

    cacheService: CacheServiceInterface;
    raceRepository: RaceRepositoryInterface;

    constructor(cacheService: CacheServiceInterface, raceRepository: RaceRepositoryInterface) {
        this.cacheService = cacheService;
        this.raceRepository = raceRepository;
    }

    public async searchRunner(name: string): Promise<Object> {
        const lowerCaseName = upperCaseWords(name).trimRight();
        const cachedValue = this.cacheService.get(lowerCaseName);

        if (cachedValue) {
            return cachedValue;
        }

        const allRunners = await this.getAllRunnerNames();
        const nameVariations = [lowerCaseName];

        allRunners.map((runner: any) => {
            if (runner.display.toLowerCase() === name.toLowerCase() &&
                runner.display !== runner.original) {
                    nameVariations.push(runner.original);
            }
        });

        const raceDetails: any = await this.search(nameVariations);

        return raceDetails;
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

        const cachedAllRunnersNames = this.cacheService.get(RaceService.allRunnerCacheKey);

        if (cachedAllRunnersNames) {
            let runners = this.findRunnerByPartialName(partialRunnerName, cachedAllRunnersNames);

            if (runners.length > 0) {
                if (runners.length > 10) {
                    runners = runners.slice(0, 10);
                }

                const listToReturn = { items: runners };
                this.cacheService.set(partialMatchCacheKey, listToReturn);

                return listToReturn;
            }

            return { items: [] };
        }

        const rawRunnersList = await this.raceRepository.getRunnerNames();
        const runnersFormattedList = this.buildRunnersNames(rawRunnersList);

        this.cacheService.set(RaceService.allRunnerCacheKey, runnersFormattedList, 86400000);
        const searchResults = this.findRunnerByPartialName(partialRunnerName, runnersFormattedList);
        let listToReturn;
 
        if (searchResults.length > 0) {
            listToReturn = { items: searchResults };
            this.cacheService.set(partialMatchCacheKey, listToReturn);

            return listToReturn;
        }

        listToReturn = { items: [] };
        this.cacheService.set(partialMatchCacheKey, listToReturn);

        return listToReturn;
    }

    public async getAllRunnerNames(): Promise<Array<string>> {
        // const cachedAllRunnersNames = this.cacheService.get(RaceService.allRunnerCacheKey);

        // if (cachedAllRunnersNames) {
        //     return cachedAllRunnersNames;
        // }

        // const runners = await this.raceRepository.getRunnerNames();
        // const searchResults = runners.map((runner: string) => {
        //     return { name: runner };
        // });

        //this.cacheService.set(RaceService.allRunnerCacheKey, searchResults);

        const runners = await this.raceRepository.getRunnerNames();

        const filteredRunners: string[] = [];

        let toReturn;

        runners.map((runner: any) => {
            const runnerWithSameName = runners.filter((eachRunner: any) => eachRunner._id.name === runner._id.name);
            toReturn = runnerWithSameName;

            // if (toReturn != null) {
            //     return;
            // }
        });

        return toReturn;
    }

    private buildRunnersNames(runners: Array<string>): Array<Object> {
        return runners.map((name) => {
            let displayName = upperCaseWords(name.toLowerCase().replace(/[ ][ ]*/i, ' ')).trim();

            if (name.includes(',') && name.split(',').length === 2) {
                const nameParts = name.split(',');
                displayName = upperCaseWords(
                    `${nameParts[1].toLowerCase().trim()} ${nameParts[0].toLowerCase().trim()}`
                    .toLowerCase()
                    .replace(/[ ][ ]*/i, ' ')
                );
            }

            return {
                display: displayName,
                original: name,
            };
        });
    }

    private findRunnerByPartialName(partialRunnerName: string, listOfRunners: Array<any>): Array<string> {
        // @TODO: Stop using any
        let runnersNamesFound: any[] = [];

        if (listOfRunners.length > 0) {
            const length = listOfRunners.length;

            for (let i = 0; i < length; i++) {
                const displayName = listOfRunners[i].display.toLowerCase();

                if (displayName.startsWith(partialRunnerName.toLowerCase())) {
                    runnersNamesFound.push(listOfRunners[i]);
                }
            }
        }

        return runnersNamesFound;
    }

    private calculatePercentage(first: number, second: number): number  {
        return Math.round(Math.floor((first / second) * 100));
    }

    private calculateRacePercentage (position: number, numberOfRunners: number): any {
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

    private calculateCategoryResult(race: any, runner: any, runnerName: string): any {
        const runnersInCategory = race.runners.filter(
            (eachRunner: any) => eachRunner.category.toLowerCase() === runner.category.toLowerCase()
        );
        const countInCategory = runnersInCategory.length;
        let position;
        let percentage;

        for (let i = 0; i < countInCategory; i++) {
            if (runnersInCategory[i].name.toLowerCase() === runnerName.toLowerCase()) {
                const positionResult = i + 1;
                position = `${positionResult} of ${countInCategory}`;

                if (positionResult === 1) {
                    percentage = `Fastest ${runnersInCategory[i].category}`;
                } else {
                    let percent = this.calculatePercentage(positionResult, countInCategory);

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
            time: prettyMs(this.getNumberOfMillisecondsTaken(runnersInCategory[0].time), null),
        };

        return {position, percentage, winner};
    }

    private calculateClubResult(race: any, runner: any, runnerName: string): any {
        const runnersInClub = race.runners.filter(
            (eachRunner: any) => eachRunner.club.toLowerCase() === runner.club.toLowerCase()
        );
        const countInClub = runnersInClub.length;
        let position;
        let percentage = '';

        for (let i = 0; i < countInClub; i++) {
            if (runnersInClub[i].name.toLowerCase() === runnerName.toLowerCase()) {
                const positionResult = i + 1;
                position = `${positionResult} of ${countInClub}`;

                if (positionResult > 1) {
                    percentage = `Top ${this.calculatePercentage(positionResult, countInClub)}%`;
                }
                break;
            }
        }

        const winner = {
            name: upperCaseWords(runnersInClub[0].name.toLowerCase()),
            time: prettyMs(this.getNumberOfMillisecondsTaken(runnersInClub[0].time), null),
        };

        return {position, percentage, winner};
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

    private calculateTimeDifference(runnersInRace: Array<any>, runnerTime: string): string {
        const firstRunnerTime = runnersInRace[0].time;
        const runnerToCheckNumberOfSeconds = this.getNumberOfMillisecondsTaken(runnerTime);
        const firstPlaceNumberOfSeconds = this.getNumberOfMillisecondsTaken(firstRunnerTime);
        const differenceFromFirstPlace = runnerToCheckNumberOfSeconds - firstPlaceNumberOfSeconds;
        const timeFromFirst = prettyMs(differenceFromFirstPlace, null);

        return (timeFromFirst === '0ms') ? '' : timeFromFirst;
    }

    private async getRaces(runner: string): Promise<any> {
        return await this.raceRepository.getRaces(runner);
    }

    public async search(runnerNames: Array<string>): Promise<Object> {
        const filteredRaces = {
            runner: '',
            races: new Array()
        };

        if (runnerNames.length === 0) {
            return filteredRaces;
        }

        for (let i = 0; i < runnerNames.length; i++) {
            const runnerName = runnerNames[i];
            const races = await this.getRaces(runnerName);

            if (races) {
                races.forEach((race: any) => {
                    const runners = race.runners.filter((runner: any) => runner.name.toLowerCase() === runnerName.toLowerCase());

                    if (runners.length > 0) {
                        const categoryResult = this.calculateCategoryResult(race, runners[0], runnerName);
                        const clubResult = this.calculateClubResult(race, runners[0], runnerName);
                        const timeDifferenceFromFirst = this.calculateTimeDifference(race.runners, runners[0].time);
                        const raceSplitDate = race.date.split('/');
                        const month = raceSplitDate[1] - 1; // Javascript months are 0-11
                        const raceDateTime = new Date(raceSplitDate[2], month, raceSplitDate[0]);

                        filteredRaces.races.push({
                            id: race.id,
                            name: race.race,
                            date: race.date,
                            dateTime: raceDateTime,
                            resultsUrl: `http://www.fellrunner.org.uk/results.php?id=${race.id}`,
                            runner: {
                                position: `${runners[0].position} of ${race.numberofrunners}`,
                                racePercentagePosition: this.calculateRacePercentage(
                                    runners[0].position, race.numberofrunners
                                ),
                                category: runners[0].category,
                                categoryPosition: categoryResult.position,
                                categoryPercentage: categoryResult.percentage,
                                categoryWinner: categoryResult.winner,
                                club: runners[0].club,
                                clubPosition: clubResult.position,
                                clubPercentage: clubResult.percentage,
                                clubWinner: clubResult.winner,
                                time: prettyMs(this.getNumberOfMillisecondsTaken(runners[0].time), null),
                                winner: {
                                    name: upperCaseWords(race.runners[0].name.toLowerCase()),
                                    time: prettyMs(this.getNumberOfMillisecondsTaken(race.runners[0].time), null),
                                },
                                timeFromFirst: timeDifferenceFromFirst,
                            }
                        });
                    }
                });

            }
        }

        if (filteredRaces) {
            filteredRaces.runner = upperCaseWords(runnerNames[0].toLowerCase());
            filteredRaces.races = filteredRaces.races.sort(function(a, b){ return b.dateTime - a.dateTime; });
        }

        return filteredRaces;
    }
}