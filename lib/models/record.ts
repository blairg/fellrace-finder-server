export class Record {
    private _runnerName: string;
    private _club: string;
    private _time: string;
    private _year: string;
    private _date: string;

    get runnerName(): string {
        return this._runnerName;
    }

    set runnerName(newValue: string) {
        this._runnerName = newValue;
    }

    get club(): string {
        return this._club;
    }

    set club(newValue: string) {
        this._club = newValue;
    }

    get time(): string {
        return this._time;
    }

    set time(newValue: string) {
        this._time = newValue;
    }

    get year(): string {
        return this._year;
    }

    set year(newValue: string) {
        this._year = newValue;
    }

    get date(): string {
        return this._date;
    }

    set date(newValue: string) {
        this._date = newValue;
    }
}