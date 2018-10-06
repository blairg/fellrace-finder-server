export class RaceSearch {
  private _name: string;
  private _date: string;

  public constructor(name: string, date: string) {
    this._name = name;
    this._date = date;
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
}
