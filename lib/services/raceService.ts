import { Race } from '../models/race';
import { CacheServiceInterface } from './cacheService';
import { RaceRepositoryInterface } from '../repositories/raceRepository';
import { RaceSearch } from '../models/raceSearch';
import { compareTwoStrings } from 'string-similarity';

export interface RaceServiceInterface {
  getRaces(namesAndDates: RaceSearch[]): Promise<Race[]>;
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
    const dbObject = await this.raceRepository.getRaces(raceNames, raceDates);

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
        const raceIndex = uniqueRaceNames.findIndex(race => (compareTwoStrings(race.display, raceName) > 0.72));

        if (raceIndex === -1) {
          uniqueRaceNames.push({display: this.tidyDisplay(raceName).trim(), original: raceName, distance: raceAndDistance[i].distance});
        } else {
          const raceToUpdate = uniqueRaceNames[raceIndex];
          const nameAlreadyAdded = raceToUpdate.original.includes(raceName);
          const nameComparisonScore = compareTwoStrings(raceToUpdate.display, raceName);
          const distancePercentDifference = raceToUpdate.distance > raceAndDistance[i].distance 
                                            ? raceAndDistance[i].distance / raceToUpdate.distance 
                                            : raceToUpdate.distance / raceAndDistance[i].distance;

          if (!nameAlreadyAdded && nameComparisonScore > 0.72 && distancePercentDifference >= 0.85) {
              uniqueRaceNames[raceIndex].original += `|${raceName}`;
          } 
        }
      }
    }

    this.cacheService.set(cacheKey, uniqueRaceNames, 1800000);

    return uniqueRaceNames;
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

  private buildRace(raceDbObject: any): Race {
    let race = new Race();

    if (raceDbObject === undefined) {
      return race;
    }

    race.id = raceDbObject.id;
    race.name = raceDbObject.name;
    race.date = raceDbObject.date;
    race.time = raceDbObject.time;
    race.distanceKilometers = parseFloat(
      parseFloat(raceDbObject.distance.kilometers).toFixed(1),
    );
    race.distanceMiles = parseFloat(
      parseFloat(raceDbObject.distance.miles).toFixed(1),
    );
    race.climbFeet = raceDbObject.climb.feet;
    race.climbMeters = raceDbObject.climb.meters;
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
