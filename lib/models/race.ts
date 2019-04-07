export class Race {
  private _id: number;
  private _name: string;
  private _date: string;
  private _time: string;
  private _distanceKilometers: number;
  private _distanceMiles: number;
  private _climbMeters: number;
  private _climbFeet: number;
  private _recordMaleName: string;
  private _recordMaleTime: string;
  private _recordMaleYear: number;
  private _recordFemaleName: string;
  private _recordFemaleTime: string;
  private _recordFemaleYear: number;
  private _venue: string;
  private _longitude: number;
  private _latitude: number;
  private _mapUrl: string;
  private _type: string;

  get id(): number {
    return this._id;
  }

  set id(newValue: number) {
    this._id = newValue;
  }

  get name(): string {
    return this._name;
  }

  set name(newValue: string) {
    this._name = newValue;
  }

  get date(): string {
    return this._date;
  }

  set date(newValue: string) {
    this._date = newValue;
  }

  get time(): string {
    return this._time;
  }

  set time(newValue: string) {
    this._time = newValue;
  }

  get distanceKilometers(): number {
    return this._distanceKilometers;
  }

  set distanceKilometers(newValue: number) {
    this._distanceKilometers = newValue;
  }

  get distanceMiles(): number {
    return this._distanceMiles;
  }

  set distanceMiles(newValue: number) {
    this._distanceMiles = newValue;
  }

  get climbMeters(): number {
    return this._climbMeters;
  }

  set climbMeters(newValue: number) {
    this._climbMeters = newValue;
  }

  get climbFeet(): number {
    return this._climbFeet;
  }

  set climbFeet(newValue: number) {
    this._climbFeet = newValue;
  }

  get recordMaleName(): string {
    return this._recordMaleName;
  }

  set recordMaleName(newValue: string) {
    this._recordMaleName = newValue;
  }

  get recordMaleTime(): string {
    return this._recordMaleTime;
  }

  set recordMaleTime(newValue: string) {
    this._recordMaleTime = newValue;
  }

  get recordMaleYear(): number {
    return this._recordMaleYear;
  }

  set recordMaleYear(newValue: number) {
    this._recordMaleYear = newValue;
  }

  get recordFemaleName(): string {
    return this._recordFemaleName;
  }

  set recordFemaleName(newValue: string) {
    this._recordFemaleName = newValue;
  }

  get recordFemaleTime(): string {
    return this._recordFemaleTime;
  }

  set recordFemaleTime(newValue: string) {
    this._recordFemaleTime = newValue;
  }

  get recordFemaleYear(): number {
    return this._recordFemaleYear;
  }

  set recordFemaleYear(newValue: number) {
    this._recordFemaleYear = newValue;
  }

  get venue(): string {
    return this._venue;
  }

  set venue(newValue: string) {
    this._venue = newValue;
  }

  get longitude(): number {
    return this._longitude;
  }

  set longitude(newValue: number) {
    this._longitude = newValue;
  }

  get latitude(): number {
    return this._latitude;
  }

  set latitude(newValue: number) {
    this._latitude = newValue;
  }

  get mapUrl(): string {
    return this._mapUrl;
  }

  set mapUrl(newValue: string) {
    this._mapUrl = newValue;
  }

  get type(): string {
    return this._type;
  }

  set type(newValue: string) {
    this._type = newValue;
  }
}
