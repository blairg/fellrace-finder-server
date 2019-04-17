import { Race } from '../models/race';
import { CacheServiceInterface } from './cacheService';
import { RaceRepositoryInterface } from '../repositories/raceRepository';
import { RaceSearch } from '../models/raceSearch';
import { compareTwoStrings } from 'string-similarity';
import { CategoryRecord } from '../models/categoryRecord';
import { Record } from '../models/record';

export interface RaceServiceInterface {
  getRacesByNamesAndDates(namesAndDates: RaceSearch[]): Promise<Race[]>;
  getRaceInfoByNames(names: string): Promise<any>;
  getRaceNames(): Promise<any>;
}

export class RaceService implements RaceServiceInterface {
  static cacheKeyPrefix = 'raceService.getrace';

  cacheService: CacheServiceInterface;
  raceRepository: RaceRepositoryInterface;

  constructor(
    cacheService: CacheServiceInterface,
    raceRepository: RaceRepositoryInterface,
  ) {
    this.cacheService = cacheService;
    this.raceRepository = raceRepository;
  }

  public async getRacesByNamesAndDates(namesAndDates: RaceSearch[]): Promise<Race[]> {
    const cacheKey = `${RaceService.cacheKeyPrefix}${this.buildCacheKey(
      namesAndDates,
    )}`;
    const cachedValue = this.cacheService.get(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }

    const raceNames = namesAndDates.map(
      (eachRace: RaceSearch) => eachRace.name,
    );
    const raceDates = namesAndDates.map(
      (eachRace: RaceSearch) => eachRace.date,
    );
    const dbObject = await this.raceRepository.getRacesByNamesAndDates(raceNames, raceDates);

    if (!dbObject && dbObject.length < 1) {
      return dbObject;
    }

    let races = new Array();

    for (let i = 0; i < dbObject.length; i++) {
      races.push(this.buildRace(dbObject[i]));
    }

    this.cacheService.set(cacheKey, races, 1800000);

    return races;
  }

  public async getRaceInfoByNames(names: string): Promise<any> {
    const cacheKey = `${RaceService.cacheKeyPrefix}getRaceInfoByNames${names}`;
    const cachedValue = this.cacheService.get(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }

    const namesList = names.split('|');
    const results = await this.raceRepository.getResultsByRaceNames(namesList);
    const dbObject = await this.raceRepository.getRacesByNames(namesList);

    if (!dbObject && dbObject.length < 1) {
      return dbObject;
    }

    dbObject.sort((raceA: any, raceB: any) => {
      const dateA = new Date(raceA.date.substring(6, 10), raceA.date.substring(3, 5), raceA.date.substring(0, 2));
      const dateB = new Date(raceB.date.substring(6, 10), raceB.date.substring(3, 5), raceB.date.substring(0, 2));

      return dateB > dateA;
    });

    let races = new Array();
    let raceProperties = {};

    for (let i = 0; i < dbObject.length; i++) {
      const builtRace = this.buildRace(dbObject[i]);
      const result = results.filter((eachResult: any) => eachResult.date === builtRace.date);
      const runnersFound = (result && result[0] && result[0].runners);
      raceProperties = this.buildRaceProperties(builtRace, raceProperties);

      const race = {
        id: builtRace.id,
        name: builtRace.name,
        date: builtRace.date,
        year: builtRace.year,
        numberOfRunners: (result && result[0] && result[0].numberofrunners) ? result[0].numberofrunners : 0,
        numberOfFinishers: (runnersFound) ? this.calculateNumberOfRaceFinishers(result[0].runners) : 0,
        performance: !runnersFound ? 0 : this.calculateRacePerformance(result[0].runners, builtRace.recordMaleTime),
        categories: new Array<CategoryRecord>(),
      };

      if (runnersFound) {
        const categories = new Array<CategoryRecord>(); 

        result[0].runners.map((each: any) => {
          const categoryExists = categories.some((eachCategory: CategoryRecord) => {
            return eachCategory.name === this.tidyCategoryName(each.category);
          });

          if (categoryExists) {
            const categoryIndex = categories.findIndex(((eachCategory: CategoryRecord) => {
              return eachCategory.name === this.tidyCategoryName(each.category); 
            }));

            const categoryCount = categories[categoryIndex].records.length;

            if (categoryCount < 5) {
              const newRecord = this.buildRecord(each, builtRace);
              categories[categoryIndex].records.push(newRecord);
            }
          } else {
            const newCategory = new CategoryRecord();
            newCategory.name = this.tidyCategoryName(each.category);

            const newRecord = this.buildRecord(each, builtRace);
            newCategory.records = new Array<Record>();
            newCategory.records.push(newRecord);

            categories.push(newCategory);
          }
        });

        race.categories = categories;
      }

      races.push(race);
    }

    const raceInfo = {
      raceInfo: this.buildRace(dbObject[0]),
      properties: raceProperties,
      races: races,
      categoryRecords: this.buildCategoryRecords(results),
    }

    this.cacheService.set(cacheKey, raceInfo, 1800000);

    return raceInfo;
  }

  public async getRaces(namesAndDates: RaceSearch[]): Promise<Race[]> {
    const cacheKey = `${RaceService.cacheKeyPrefix}${this.buildCacheKey(
      namesAndDates,
    )}`;
    const cachedValue = this.cacheService.get(cacheKey);

    if (cachedValue) {
      return cachedValue;
    }

    const raceNames = namesAndDates.map(
      (eachRace: RaceSearch) => eachRace.name,
    );
    const raceDates = namesAndDates.map(
      (eachRace: RaceSearch) => eachRace.date,
    );
    const dbObject = await this.raceRepository.getRacesByNamesAndDates(raceNames, raceDates);

    if (!dbObject && dbObject.length < 1) {
      return dbObject;
    }

    let races = new Array();

    for (let i = 0; i < dbObject.length; i++) {
      races.push(this.buildRace(dbObject[i]));
    }

    this.cacheService.set(cacheKey, races, 1800000);

    return races;
  }

  // @TODO: Test me
  public async getRaceNames(): Promise<any> { 
    const cacheKey = `${RaceService.cacheKeyPrefix}-getRaceNames`;
    const cachedValue = this.cacheService.get(cacheKey);
    const namePercentageDifference = 0.72;

    if (cachedValue) {
      return cachedValue;
    }

    const raceNames = await this.raceRepository.getRaceNames();
    const raceAndDistance = raceNames.map((race: any) => {
      return {name: race.name, distance: race.distance.kilometers}
    });
    let uniqueRaceNames = new Array();
    uniqueRaceNames.push({display: this.tidyDisplay(raceAndDistance[0].name).trim(), original: raceAndDistance[0].name, distance: raceAndDistance[0].distance});
    
    for (let i = 1; i < raceAndDistance.length -1; i++) {
      const raceName = raceAndDistance[i].name;

      if (this.checkNameBlacklist(raceName)) {
        const raceIndex = uniqueRaceNames.findIndex(race => (compareTwoStrings(race.display, raceName) > namePercentageDifference));

        if (raceIndex === -1) {
          uniqueRaceNames.push({display: this.tidyDisplay(raceName).trim(), original: raceName, distance: raceAndDistance[i].distance});
        } else {
          const raceToUpdate = uniqueRaceNames[raceIndex];
          const nameAlreadyAdded = raceToUpdate.original.includes(raceName);
          const nameComparisonScore = compareTwoStrings(raceToUpdate.display, raceName);
          const distancePercentDifference = raceToUpdate.distance > raceAndDistance[i].distance 
                                            ? raceAndDistance[i].distance / raceToUpdate.distance 
                                            : raceToUpdate.distance / raceAndDistance[i].distance;

          if (!nameAlreadyAdded && nameComparisonScore > namePercentageDifference && distancePercentDifference >= 0.85) {
              uniqueRaceNames[raceIndex].original += `|${raceName}`;
          } 
        }
      }
    }

    this.cacheService.set(cacheKey, uniqueRaceNames, 1800000);

    return uniqueRaceNames;
  }

  private calculateRacePerformance(runners: Array<any>, record: string): number {
    const firstTime = runners[0].time;

    if (firstTime === record) {
      return 1;
    }

    const firstTimeSplit = firstTime.split(':');
    const firstHour = parseInt(firstTimeSplit[0]);
    const firstMinute = parseInt(firstTimeSplit[1]);
    const firstSecond = parseInt(firstTimeSplit[2]);
    const recordTimeSplit = record.split(':');
    const recordHour = parseInt(recordTimeSplit[0]);
    const recordMinute = parseInt(recordTimeSplit[1]);
    const recordSecond = parseInt(recordTimeSplit[2]);
    let recordWeighting;

    if (firstHour === recordHour) {
      if (firstMinute === recordMinute) {
        recordWeighting = recordSecond / firstSecond;
      } else {
        recordWeighting = recordMinute / firstMinute;
      }
    } else {
      recordWeighting = (recordHour / firstHour) + (recordMinute / firstMinute) / 2;
    }

    return recordWeighting;
  }

  private tidyCategoryName(categoryName: string) {
    const isNumeric = (name: any) => isNaN(name);
    const maleCategories = ['S', 'N', 'MS', 'SM', 'SEN', 'SEN MALE', 'SENIOR', 'MALE', 'SENIOR MEN',
      'MALE SENIOR', 'M SEN', 'MSEN', 'SEN M', 'SEN MAN', 'MSENIOR', 'MOPEN', 'MO', 'MALE OPEN'];
    const femaleCategories = ['W', 'L', 'LS', 'SL', 'FS', 'WS', 'FEMALE', 'SENIOR LADIES', 'SENIOR FEMALE',
      'FEMALE SENIOR', 'FEMALE SENIOR', 'FSEN', 'WSEN', 'W SEN', 'SEN L', 'SEN LADY', 'SEN FEMALE', 
      'LSENIOR', 'FSENIOR', 'FO', 'FEMALE OPEN', 'FOPEN'];

    categoryName = categoryName.replace('*', '');

    if (categoryName === '' || !isNumeric(categoryName) ||
        maleCategories.includes(categoryName.toUpperCase())) {
      return 'M';
    }
    
    if (femaleCategories.includes(categoryName.toUpperCase())) {
      return 'F';
    }

    if (categoryName === 'JM' || 
        categoryName === 'JUN' || 
        categoryName === 'Junior Male' ||
        categoryName.toUpperCase() === 'JNR' ||
        categoryName === 'JUN MAN') {
      return 'MJ';
    }

    if (categoryName === 'JF' ||
        categoryName === 'FJ' ||
        categoryName === 'JUN LADY') {
      return 'FJ';
    }

    // Male Vets
    if (categoryName.match(/[0-9]{2} (Male Vet)/g)) {
      return `MV${categoryName.substring(0, 2)}`;
    }

    if (categoryName.toUpperCase().match(/V[0-9]{2} (MALE)/g)) {
      return `MV${categoryName.substring(1, 3)}`;
    }

    if (categoryName.toUpperCase().match(/MV [0-9]{2}/g)) {
      return `MV${categoryName.substring(3, 5)}`;
    }

    // Female Vets
    if (categoryName.match(/[0-9]{2} (Female Vet)/g)) {
      return `FV${categoryName.substring(0, 2)}`;
    }

    if (categoryName.toUpperCase().match(/V[0-9]{2} (FEMALE)/g)) {
      return `FV${categoryName.substring(1, 3)}`;
    }

    if (categoryName.toUpperCase().match(/FV [0-9]{2}/g)) {
      return `FV${categoryName.substring(3, 5)}`;
    }

    // Check first part of category name
    let firstPart = categoryName.split(' ')[0];

    if (firstPart.length === 2 && firstPart.match(/(F|L|W|M)[0-9]{1}/g)) {
      firstPart = `${firstPart}0`;
    }

    if (firstPart.toUpperCase() === 'SENIOR' ||  
        firstPart.toUpperCase() === 'MALE') {
      return 'M';
    }

    // Female Juniors
    if (firstPart.match(/F(16|17|18|19|20|21|23)/g) || 
        firstPart.match(/W(16|17|18|19|20|21|23)/g) || 
        firstPart.match(/L(16|17|18|19|20|21|23)/g)) {

      return `FU${firstPart.substring(1)}`;
    }

    // Male Juniors
    if (firstPart.match(/M(16|17|18|19|20|21|23)/g)) {
      return `MU${firstPart.substring(1)}`;
    }

    if (firstPart.match(/F[0-9]{2}/g) || 
    firstPart.match(/W[0-9]{2}/g) || 
    firstPart.match(/L[0-9]{2}/g)) {

      return `FV${firstPart.substring(1)}`;
    }

    if (firstPart.match(/WV[0-9]{2}/g) || 
    firstPart.match(/LV[0-9]{2}/g)) {

      const tidyName = firstPart.replace('W', '')
                                   .replace('L', '');
      return `FV${tidyName.substring(1)}`;
    }

    if (firstPart.match(/V[0-9]{2}/g)) {
      const tidyName = firstPart.replace('F', '')
                                   .replace('M', '')
                                   .replace('W', '')
                                   .replace('L', '');

      return `MV${tidyName.substring(1)}`;
    }

    if (firstPart.match(/M[0-9]{2}/g)) {
      return `MV${firstPart.substring(1)}`;
    }

    return firstPart.toUpperCase().replace('*', '')
                                     .replace('WV', 'FV')
                                     .replace('LV', 'FV')
                                     .replace('WU', 'FU')
                                     .replace('LU', 'FU');
  }

  private buildCategoryRecords(results: Array<any>): Array<CategoryRecord> {
    const categories = new Array<CategoryRecord>(); 

    for (let i = 0; i < results.length; i++) {
      results[i].runners.map((each: any) => {
        const categoryExists = categories.some((eachCategory: CategoryRecord) => {
          return eachCategory.name === this.tidyCategoryName(each.category);
        });

        const race = { date: results[i].date };

        if (categoryExists) {
          const categoryIndex = categories.findIndex(((eachCategory: CategoryRecord) => {
            return eachCategory.name === this.tidyCategoryName(each.category); 
          }));

          const newRecord = this.buildRecord(each, race);
          categories[categoryIndex].records.push(newRecord);
        } else {
          const newCategory = new CategoryRecord();
          newCategory.name = this.tidyCategoryName(each.category);

          const newRecord = this.buildRecord(each, race);
          newCategory.records = new Array<Record>();
          newCategory.records.push(newRecord);

          categories.push(newCategory);
        }
      });
    }

    for (let i = 0; i < categories.length; i++) { 
      categories[i].records = categories[i].records.sort((recordA: Record, recordB: Record) => {
        if (recordA.time < recordB.time) {
          return -1;
        }

        if (recordA.time > recordB.time) {
          return 1;
        }

        return 0;
      }).slice(0, 10);
    }

    return categories;
  }

  private buildRecord(runner: any, race: any) {
    const newRecord = new Record();
    newRecord.club =  runner.club;
    newRecord.date = race.date;
    newRecord.runnerName = runner.name;
    newRecord.time = runner.time;
    newRecord.year = race.date.substring(6, 10);

    return newRecord;
  }

  private buildRaceProperties(race: any, properties: any): any {
    if (!properties.time) {
      properties.time = race.time;
    }

    if (!properties.distanceKilometers) {
      properties.distanceKilometers = race.distanceKilometers;
    }

    if (!properties.distanceMiles) {
      properties.distanceMiles = race.distanceMiles;
    }

    if (!properties.climbFeet) {
      properties.climbFeet = race.climbFeet;
    }

    if (!properties.climbMeters) {
      properties.climbMeters = race.climbMeters;
    }

    if (!properties.type) {
      properties.type = race.type;
    }

    if (!properties.recordFemaleName) {
      properties.recordFemaleName = race.recordFemaleName;
    }

    if (!properties.recordFemaleTime) {
      properties.recordFemaleTime = race.recordFemaleTime;
    }

    if (!properties.recordFemaleYear) {
      properties.recordFemaleYear = race.recordFemaleYear;
    }

    if (!properties.recordMaleName) {
      properties.recordMaleName = race.recordMaleName;
    }

    if (!properties.recordMaleTime) {
      properties.recordMaleTime = race.recordMaleTime;
    }

    if (!properties.recordMaleYear) {
      properties.recordMaleYear = race.recordMaleYear;
    }

    if (!properties.venue) {
      properties.venue = race.venue;
    }

    if (!properties.longitude) {
      properties.longitude = race.longitude;
    }

    if (!properties.latitude) {
      properties.latitude = race.latitude;
    }

    if (!properties.mapUrl) {
      properties.mapUrl = race.mapUrl;
    }

    return properties;
  }

  private calculateNumberOfRaceFinishers(runners: any) {
    return runners.filter((runner: any) => runner.time.toLowerCase() !== 'dnf').length;
  }

  private checkNameBlacklist(name: string): boolean {
    return !name.toLowerCase().includes('cancelled') && 
           !name.toLowerCase().includes('change of date') &&
           !name.toLowerCase().includes('date change');
  }

  private tidyDisplay(name: string): string {
    return name.replace(/[0-9]{1,}(st|rd|nd|th)/g, "");
  }

  private buildCacheKey(namesAndDates: RaceSearch[]): string {
    const replaceCharacters = (value: string) => {
      value = value.replace(/\//g, '');
      value = value.replace(/-/g, '');
      value = value.replace(/ /g, '');
      value = value.replace(/,/g, '');
      value = value.replace(/&/g, '');
      value = value.replace(/'/g, '');

      return value;
    };

    let cacheKey: string = '';

    namesAndDates.map((eachEntry: RaceSearch) => {
      cacheKey = `${cacheKey}${eachEntry.name.substring(
        0,
        5,
      )}${eachEntry.date.substring(3)}`;
    });

    return replaceCharacters(cacheKey);
  }

  private computeRaceCategory(meters: number, kilometers: number): string {
    if (meters / kilometers >= 50) {
      return 'A';
    }

    if (meters / kilometers >= 25) {
      return 'B';
    }

    if (meters / kilometers < 25) {
      return 'C';
    }
  }

  private computeRaceType(climb: any, distance: any): string {
    const category = this.computeRaceCategory(climb.meters, distance.kilometers);
    let length;

    if (!category) {
      return '';
    }

    if (distance.kilometers < 10) {
      length = 'S';
    } 

    if (distance.kilometers > 10 && distance.kilometers < 20) {
      length = 'M';
    } 

    if (distance.kilometers > 20) {
      length = 'L';
    } 

    return `${category}${length}`;
  }

  private buildRace(raceDbObject: any): Race {
    let race = new Race();

    if (raceDbObject === undefined) {
      return race;
    }

    race.id = raceDbObject.id;
    race.name = raceDbObject.name;
    race.date = raceDbObject.date;
    race.year = raceDbObject.date.substring(6, 10);
    race.time = raceDbObject.time;
    race.distanceKilometers = parseFloat(
      parseFloat(raceDbObject.distance.kilometers).toFixed(1),
    );
    race.distanceMiles = parseFloat(
      parseFloat(raceDbObject.distance.miles).toFixed(1),
    );
    race.climbFeet = raceDbObject.climb.feet;
    race.climbMeters = raceDbObject.climb.meters;
    race.type = this.computeRaceType(raceDbObject.climb, raceDbObject.distance);
    race.recordFemaleName = raceDbObject.records.female.name;
    race.recordFemaleTime = raceDbObject.records.female.time;
    race.recordFemaleYear = raceDbObject.records.female.year;
    race.recordMaleName = raceDbObject.records.male.name;
    race.recordMaleTime = raceDbObject.records.male.time;
    race.recordMaleYear = raceDbObject.records.male.year;
    race.venue = raceDbObject.venue;
    race.longitude = raceDbObject.geolocation.longitude;
    race.latitude = raceDbObject.geolocation.latitude;
    race.mapUrl = raceDbObject.gmapimageurl;

    return race;
  }
}
