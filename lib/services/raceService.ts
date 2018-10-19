import { Race } from '../models/race';
import { CacheServiceInterface } from './cacheService';
import { RaceRepositoryInterface } from '../repositories/raceRepository';
import { RaceSearch } from '../models/raceSearch';

export interface RaceServiceInterface {
  getRaces(namesAndDates: RaceSearch[]): Promise<Race[]>;
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
    race.distanceKilometers = parseFloat(parseFloat(raceDbObject.distance.kilometers).toFixed(1));
    race.distanceMiles = parseFloat(parseFloat(raceDbObject.distance.miles).toFixed(1));
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
