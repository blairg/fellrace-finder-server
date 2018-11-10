export class RunnersClubs {
    private _runners: string[];
    private _clubs: string[];
  
    public constructor(runners: string[], clubs: string[]) {
      this._runners = runners;
      this._clubs = clubs;
    }
  
    get runners(): string[] {
      return this._runners;
    }
  
    set runners(newValue: string[]) {
      this._runners = newValue;
    }
  
    get clubs(): string[] {
      return this._clubs;
    }
  
    set clubs(newValue: string[]) {
      this._clubs = newValue;
    }
  }