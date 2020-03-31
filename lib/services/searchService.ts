import { CacheServiceInterface } from './cacheService';
import { upperCaseWords } from '../utils/stringUtils';
import { compareTwoStrings } from 'string-similarity';
import { SearchRepositoryInterface } from '../repositories/searchRepository';
import { RunnersClubs } from '../models/runnersClubs';
import { RaceServiceInterface } from './raceService';

export interface SearchServiceInterface {
    searchRunner(
        names: string,
    ): Promise<RunnersClubs>;
    getRunnerNames(partialRunnerName: string): Promise<Object>;
    getRaceNames(partialRunnerName: string): Promise<Object>;
    getAllRunnerNames(): Promise<any>;
}

export class SearchService implements SearchServiceInterface {
    static allFormattedRunnerCacheKey = 'allformattedrunnersnames';
    static runnersNamesCacheKey = 'SearchService-getAllRunnerNames';
    static allRacesCacheKey = 'SearchService-getAllRaces';
    static oneDayCacheTime = 86400000;
    static minimumLength = 4;

    cacheService: CacheServiceInterface;
    raceService: RaceServiceInterface;
    searchRepository: SearchRepositoryInterface;

    constructor(
        cacheService: CacheServiceInterface,
        raceService: RaceServiceInterface,
        searchRepository: SearchRepositoryInterface,
    ) {
        this.cacheService = cacheService;
        this.raceService = raceService;
        this.searchRepository = searchRepository;
    }

    public async searchRunner(
        names: string,
    ): Promise<RunnersClubs> {
        const cacheKey = `SearchService-searchrunner${names}`;
        const cachedValue = this.cacheService.get(cacheKey);

        if (cachedValue) {
            return cachedValue;
        }

        const splitNames = names.split('$$');
        const clubRunnerCacheKey = `clubrunner${names}`;
        const clubRunnerCacheValue = this.cacheService.get(clubRunnerCacheKey);
        let runnersAndClubs;

        if (clubRunnerCacheValue) {
            runnersAndClubs = clubRunnerCacheValue;
        } else {
            runnersAndClubs = await this.getClubAndRunnersNames(splitNames);
        }

        this.cacheService.set(cacheKey, runnersAndClubs);

        return runnersAndClubs;
    }

    public async getAllRunnerNames(): Promise<string[]> {
        let allRunnersNames = this.cacheService.get(
            SearchService.runnersNamesCacheKey,
        );

        if (allRunnersNames) {
            return allRunnersNames;
        }

        allRunnersNames = this.searchRepository.getAllRunnerNames();
        this.cacheService.set(SearchService.runnersNamesCacheKey, allRunnersNames, SearchService.oneDayCacheTime);

        return allRunnersNames;
    }

    public async getAllRaces(): Promise<any[]> {
        let allRaces = this.cacheService.get(
            SearchService.allRacesCacheKey,
        );

        if (allRaces) {
            return allRaces;
        }

        allRaces = await this.searchRepository.getAllRaces();

        this.cacheService.set(SearchService.allRacesCacheKey, allRaces, SearchService.oneDayCacheTime);

        return allRaces;
    }

    public async getRaceNames(partialRaceName: string): Promise<Object> {
        if (partialRaceName.trim().length < 3) {
            return { items: [] };
        }

        const cachePrefix = 'SearchService-getRaceNames-';
        const partialMatchCacheKey = `${cachePrefix}${partialRaceName}`;
        const cachedPartialName = this.cacheService.get(partialMatchCacheKey);

        if (cachedPartialName) {
            return cachedPartialName;
        }

        const races = await this.raceService.getRaceNames();
        const matches = this.getRaceMatches(races, partialRaceName);

        this.cacheService.set(partialMatchCacheKey, matches, 86400000);
        
        return matches;
    }

    public async getRunnerNames(partialRunnerName: string): Promise<Object> {
        if (partialRunnerName.trim().length < SearchService.minimumLength) {
            return { items: [] };
        }

        const cachePrefix = 'SearchService-getRunnerNames-';
        const partialMatchCacheKey = `${cachePrefix}${partialRunnerName}`;
        const cachedPartialName = this.cacheService.get(partialMatchCacheKey);

        if (cachedPartialName) {
            return cachedPartialName;
        }

        const allRunnersRawNamesCacheKey = partialRunnerName.substring(0, SearchService.minimumLength).toLowerCase() + SearchService.runnersNamesCacheKey;
        let cachedRawNames = this.cacheService.get(allRunnersRawNamesCacheKey);

        if (!cachedRawNames) {
            await this.buildNameCaches();
        }

        cachedRawNames = this.cacheService.get(allRunnersRawNamesCacheKey);

        if (!cachedRawNames) {
            return { items: [] };
        }

        const runnersFormattedList = this.buildRunnersNames(cachedRawNames);
        const searchResults = this.findRunnerByPartialName(
            partialRunnerName,
            runnersFormattedList,
        );
        const originalRunnerNames = searchResults.map((runner: any) => {
            return runner.original;
        });

        const runnersOriginalNamesCacheKey = `runnersoriginalnames${originalRunnerNames.join()}`;
        const runnersOriginalNamesCacheValue = this.cacheService.get(
            runnersOriginalNamesCacheKey,
        );
        let runnersInClub;

        if (runnersOriginalNamesCacheValue) {
            runnersInClub = runnersOriginalNamesCacheValue;
        } else {
            runnersInClub = await this.searchRepository.getRunnersClubs(
                originalRunnerNames,
            );
            this.cacheService.set(runnersOriginalNamesCacheKey, runnersInClub);
        }

        let listToReturn;

        this.cacheService.set(
            SearchService.allFormattedRunnerCacheKey,
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

    private getRaceMatches(races: any, partialRaceName: string): Array<any> {
        let matches = races.map((race: any) => {
            if (race.display.toLowerCase().includes(partialRaceName)) {
                return race;
            } else {
                return { remove: true };
            }
        }).filter((race: any) => !race.remove);

        return matches;
    }

    private async buildNameCaches() {
        const rawRunnersList = await this.searchRepository.getAllRunnerNames();

        let currentPrefix;
        let previousPrefix;
        let valuesToAddToCache = new Array();

        for (let i = 0; i < rawRunnersList.length; i++) {
            if (!rawRunnersList[i]) {
                continue;
            }

            currentPrefix = rawRunnersList[i].toString().substring(0, SearchService.minimumLength).toLowerCase();

            if (!previousPrefix) {
                previousPrefix = currentPrefix;
                valuesToAddToCache.push(rawRunnersList[i]);
                continue;
            }

            if (currentPrefix === previousPrefix) {
                valuesToAddToCache.push(rawRunnersList[i]);
            }

            if (rawRunnersList[i + 1]) {
                const nextPrefix = rawRunnersList[i + 1].toString().substring(0, SearchService.minimumLength).toLowerCase();

                if (currentPrefix !== nextPrefix) {
                    const cacheKey = currentPrefix + SearchService.runnersNamesCacheKey;
                    this.cacheService.set(cacheKey, valuesToAddToCache, SearchService.oneDayCacheTime);
                    valuesToAddToCache = new Array();
                }
            }

            previousPrefix = currentPrefix;
        }

        return rawRunnersList;
    }

    private async getClubAndRunnersNames(listOfNames: string[]): Promise<any> {
        let runnersAndClubs = {
            runners: new Array(),
            clubs: new Array(),
        };

        for (let i = 0; i < listOfNames.length; i++) {
            const nameAndClub = listOfNames[i].split(' - ');
            const nameOfRunner = nameAndClub[0];
            const clubOfRunner = nameAndClub[1];

            if (nameAndClub.length === 2) {
                const clubToRunnerList: any = await this.getRunnerNames(nameOfRunner);

                clubToRunnerList.items.map((eachClubRunner: any) => {
                    eachClubRunner.original.split('|').map((eachOriginalName: string) => {
                        runnersAndClubs.runners.push(eachOriginalName);
                    });

                    eachClubRunner.club.split('|').map((eachClub: string) => {
                        const runnerToCheck = { club: eachClub };
                        const runnerSearchedOn = { club: clubOfRunner };

                        if (this.isClubNameSimilar(runnerToCheck, runnerSearchedOn)) {
                            runnersAndClubs.clubs.push(eachClub);
                        }
                    });

                    // @TODO: Hack for me normalising Unknown clubs
                    if (
                        runnersAndClubs.clubs.some(
                            (club: string) =>
                                club.toLowerCase().trim() === 'unknown' &&
                                (!runnersAndClubs.clubs.some((club: string) => club === '') &&
                                    !runnersAndClubs.clubs.some((club: string) => club === ' ')),
                        )
                    ) {
                        runnersAndClubs.clubs.push('');
                        runnersAndClubs.clubs.push(' ');
                    }
                });
            }
        }

        return new RunnersClubs(runnersAndClubs.runners, runnersAndClubs.clubs);
    }

    private buildRunnersNames(runners: Array<string>): Array<Object> {
        const cacheKey = `buildRunnersNames${runners.join()}`;
        const cachedValue = this.cacheService.get(cacheKey);

        if (cachedValue) {
            return cachedValue;
        }

        const listOfRunners = runners.map(name => {
            if (name && name !== null && name !== undefined) {
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
            }
        });

        this.cacheService.set(cacheKey, listOfRunners);

        return listOfRunners;
    }

    private findRunnerByPartialName(
        partialRunnerName: string,
        listOfRunners: Array<any>,
    ): Array<string> {
        const cacheKey = `findRunnerByPartialName${partialRunnerName}${listOfRunners
            .map(runner => (runner ? runner.display : ''))
            .join()}`;
        const cachedValue = this.cacheService.get(cacheKey);

        if (cachedValue) {
            return cachedValue;
        }

        let runnersNamesFound: any[] = [];

        if (listOfRunners.length > 0) {
            const numberOfRunners = listOfRunners.length;

            for (let i = 0; i < numberOfRunners; i++) {
                if (listOfRunners[i]) {
                    const displayName = listOfRunners[i].display.toLowerCase();

                    if (displayName.startsWith(partialRunnerName.toLowerCase())) {
                        runnersNamesFound.push(listOfRunners[i]);
                    }

                    if (runnersNamesFound.length === 20) {
                        break;
                    }
                }
            }
        }

        this.cacheService.set(cacheKey, runnersNamesFound);

        return runnersNamesFound;
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
}
