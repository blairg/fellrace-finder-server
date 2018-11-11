import { CacheServiceInterface } from './cacheService';
import { upperCaseWords } from '../utils/stringUtils';
import { compareTwoStrings } from 'string-similarity';
import { SearchRepositoryInterface } from '../repositories/searchRepository';
import { RunnersClubs } from '../models/runnersClubs';
import { basename } from 'path';

export interface SearchServiceInterface {
    searchRunner(
        names: string,
    ): Promise<RunnersClubs>;
    getRunnerNames(partialRunnerName: string): Promise<Object>;
    getAllRunnerNames(): Promise<any>;
}

export class SearchService implements SearchServiceInterface {
    static allRunnersRawCacheKey = 'allrunnersrawnames';
    static allFormattedRunnerCacheKey = 'allformattedrunnersnames';
    static runnersNamesCacheKey = 'SearchService-getAllRunnerNames';
    static oneDayCacheTime = 86400000;
    static minimumLength = 3;

    cacheService: CacheServiceInterface;
    searchRepository: SearchRepositoryInterface;

    constructor(
        cacheService: CacheServiceInterface,
        searchRepository: SearchRepositoryInterface,
    ) {
        this.cacheService = cacheService;
        this.searchRepository = searchRepository;
    }

    public async searchRunner(
        names: string,
    ): Promise<RunnersClubs> {
        const namesTrimmed = names.replace(' ', '');
        const cacheKey = `SearchService-searchrunner${namesTrimmed}`;
        const cachedValue = this.cacheService.get(cacheKey);

        if (cachedValue) {
            return cachedValue;
        }

        const splitNames = names.split('$$');

        const clubRunnerCacheKey = `clubrunner${namesTrimmed}`;
        const clubRunnerCacheValue = this.cacheService.get(clubRunnerCacheKey);
        let runnersAndClubs;

        if (clubRunnerCacheValue) {
            runnersAndClubs = clubRunnerCacheValue;
        } else {
            runnersAndClubs = await this.getClubAndRunnersNames(splitNames);
        }

        console.log('runnersAndClubs', runnersAndClubs);

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

    public async getRunnerNames(partialRunnerName: string): Promise<Object> {
        if (partialRunnerName.trim().length < SearchService.minimumLength) {
            return { items: [] };
        }

        const fullCacheKey = `getRunnerNames-${partialRunnerName.toLowerCase()}`;
        const cachedResults = this.cacheService.get(fullCacheKey);

        if (cachedResults) {
            return cachedResults;
        }

        const eachName = partialRunnerName.toLowerCase().split(' ');

        if (eachName.length === 2) {
            partialRunnerName = eachName[1].toLowerCase();
        } else if (eachName.length === 3) {
            partialRunnerName = eachName[2].toLowerCase();
        }

        const cachePrefix = 'SearchService-getRunnerNames-';
        const partialMatchCacheKey = `${cachePrefix}${partialRunnerName.substring(0, SearchService.minimumLength).toLowerCase()}`;
        let cachedPartialName = this.cacheService.get(partialMatchCacheKey);

        // if (cachedPartialName) {
        //     return cachedPartialName;
        // }

        // const allRunnersRawNamesCacheKey = partialRunnerName.substring(0, SearchService.minimumLength).toLowerCase() + SearchService.runnersNamesCacheKey;
        // let cachedRawNames = this.cacheService.get(allRunnersRawNamesCacheKey);

        const cachedRawNames = this.cacheService.get(SearchService.allRunnersRawCacheKey);

        if (!cachedRawNames) {
            await this.buildNameCaches();
        }

        cachedPartialName = this.cacheService.get(partialMatchCacheKey);

        if (!cachedPartialName) {
            return { items: [] };
        }

        this.cacheService.set(partialMatchCacheKey, cachedPartialName);

        //console.log(cachedPartialName);

        // cachedRawNames = this.cacheService.get(allRunnersRawNamesCacheKey);

        // if (!cachedRawNames) {
        //     return { items: [] };
        // }

        //console.log(cachedPartialName);

        //console.log(cachedPartialName);

        //const runnersFormattedList = this.buildRunnersNames(cachedRawNames);
        const runnersFormattedList = this.buildRunnersNames(cachedPartialName);
        const searchResults = this.findRunnerByPartialName(
            partialRunnerName,
            runnersFormattedList,
        );

        //console.log(searchResults);
        //console.log('after buildRunnersNames');

        const originalRunnerNames = searchResults.map((runner: any) => {
            return runner.original;
        });

        const runnersOriginalNamesCacheKey = `runnersoriginalnames${originalRunnerNames.join()}`;
        const runnersOriginalNamesCacheValue = this.cacheService.get(runnersOriginalNamesCacheKey);
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

        // this.cacheService.set(
        //     SearchService.allFormattedRunnerCacheKey,
        //     runnersFormattedList,
        //     86400000,
        // );

        if (searchResults.length > 0) {
            let runnersWithClubAndCount = this.appendClubNamesAndCount(
                searchResults,
                runnersInClub,
            );

            runnersWithClubAndCount = this.flattenClubsToRunner(
                runnersWithClubAndCount,
            );

            console.log(runnersWithClubAndCount);

            listToReturn = { items: runnersWithClubAndCount };
            //this.cacheService.set(partialMatchCacheKey, listToReturn);
            this.cacheService.set(fullCacheKey, listToReturn);

            return listToReturn;
        }

        listToReturn = { items: [] };
        //this.cacheService.set(partialMatchCacheKey, listToReturn);
        this.cacheService.set(fullCacheKey, listToReturn);

        return listToReturn;
    }

    private async buildNameCaches() {
        const rawRunnersList = await this.searchRepository.getAllRunnerNames();
        this.cacheService.set(
            SearchService.allRunnersRawCacheKey,
            rawRunnersList,
            86400000,
        );

        let surnameMap: any = [];

        for (let i = 0; i < rawRunnersList.length; i++) {
            let names;
            if (rawRunnersList[i].toString().includes(',')) {
                // @TODO: Check for commas
                names = rawRunnersList[i].toString().split(',');
                names.reverse();
            } else {
                names = rawRunnersList[i].toString().split(' ');
            }

            //const names = rawRunnersList[i].toString().split(' ');

            if (names.length > 1) {
                const surnamePrefix = names[1].toString().substring(0, SearchService.minimumLength).toLowerCase().trimRight();

                if (surnameMap.length === 0) {
                    surnameMap.push({ 
                        prefix: surnamePrefix,
                        names: [ rawRunnersList[i].toString() ],
                    });
                } else {
                    let added = false;

                    for (let j = 0; j < surnameMap.length; j++) {
                        if (surnameMap[j].prefix === surnamePrefix) {
                            surnameMap[j].names.push(rawRunnersList[i].toString());
                            added = true; 
                            break;
                        }
                    }

                    if (!added) {
                        surnameMap.push({ 
                            prefix: surnamePrefix,
                            names: [ rawRunnersList[i].toString() ],
                        });
                    }
                }
            }
        }

        const cachePrefix = 'SearchService-getRunnerNames-';

        for (let i = 0; i < surnameMap.length; i++) {
            const cacheKey = `${cachePrefix}${surnameMap[i].prefix}`;
            this.cacheService.set(cacheKey, surnameMap[i].names, SearchService.oneDayCacheTime);
        }

        return surnameMap;

        //console.log(surnameMap);

        // let currentPrefixFirstName;
        // let previousPrefixFirstName;
        // let currentPrefixSurname;
        // let previousPrefixSurname;
        // let valuesToAddToCache = new Array();

        // for (let i = 0; i < rawRunnersList.length; i++) {
        //     //console.log('here');

        //     // First name
        //     // currentPrefixFirstName = rawRunnersList[i].toString().substring(0, SearchService.minimumLength).toLowerCase();

        //     // if (!previousPrefixFirstName) {
        //     //     previousPrefixFirstName = currentPrefixFirstName;
        //     //     valuesToAddToCache.push(rawRunnersList[i]);
        //     // } else {
        //     //     if (currentPrefixFirstName === previousPrefixFirstName) {
        //     //         valuesToAddToCache.push(rawRunnersList[i]);
        //     //     }
    
        //     //     if (rawRunnersList[i + 1]) {
        //     //         const nextPrefix = rawRunnersList[i + 1].toString().substring(0, SearchService.minimumLength).toLowerCase();
    
        //     //         if (currentPrefixFirstName !== nextPrefix) {
        //     //             const cacheKey = currentPrefixFirstName + SearchService.runnersNamesCacheKey;
        //     //             this.cacheService.set(cacheKey, valuesToAddToCache, SearchService.oneDayCacheTime);
        //     //             valuesToAddToCache = new Array();
        //     //         }
        //     //     }
    
        //     //     previousPrefixFirstName = currentPrefixFirstName;
        //     // }

        //     // Surname
        //     const names = rawRunnersList[i].toString().split(' ');

        //     if (names.length > 1) {
        //         currentPrefixSurname = names[1].toString().substring(0, SearchService.minimumLength).toLowerCase();

        //         if (!previousPrefixSurname) {
        //             previousPrefixSurname = currentPrefixSurname;
        //             //console.log('names', names[1]);
        //             valuesToAddToCache.push(rawRunnersList[i]);
        //             continue;
        //         }
    
        //         if (currentPrefixSurname === previousPrefixSurname) {
        //             console.log(names[1]);
        //             valuesToAddToCache.push(rawRunnersList[i]);
        //         }
    
        //         if (rawRunnersList[i + 1]) {
        //             const nextSurnamePrefix = rawRunnersList[i + 1].toString().substring(0, SearchService.minimumLength).toLowerCase();
    
        //             if (currentPrefixSurname !== nextSurnamePrefix) {
        //                 const cacheKey = currentPrefixSurname + SearchService.runnersNamesCacheKey;
        //                 this.cacheService.set(cacheKey, valuesToAddToCache, SearchService.oneDayCacheTime);
        //                 valuesToAddToCache = new Array();
        //             }
        //         }
    
        //         previousPrefixSurname = currentPrefixSurname;
        //     }
        // }

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

                let surname;

                if (name.toString().includes(',')) {
                    const names = name.toString().split(',');
                    names.reverse();
                    surname = names[0];
                } else {
                    const names = name.toString().split(' ');

                    if (names.length === 2) {
                        surname = names[1];
                    } else if (names.length === 3) {
                        surname = names[2];
                    } else {
                        surname = names[0];
                    }
                }

                return {
                    display: displayName,
                    original: name,
                    surname: surname.toLowerCase(),
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
        console.log(partialRunnerName);

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
                    const surname = listOfRunners[i].surname;

                    if (surname.startsWith(partialRunnerName.toLowerCase())) {
                        runnersNamesFound.push(listOfRunners[i]);
                    }

                    // if (runnersNamesFound.length === 20) {
                    //     break;
                    // }
                }
            }
        }

        if (runnersNamesFound) {
            runnersNamesFound = runnersNamesFound.sort((a: any, b: any) => b.display - a.display);
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
        runnersWithClubAndCount.sort(function(a, b) { return a.display == b.display ? 0 : + (a.display > b.display) || -1; });

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
