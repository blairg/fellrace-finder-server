import { Record } from './record';

export class CategoryRecord {
    private _name: string;
    private _records: Array<Record>;

    get name(): string {
        return this._name;
    }
    
    set name(newValue: string) {
        this._name = newValue;
    }

    get records(): Array<Record> {
        return this._records;
    }

    set records(newValue: Array<Record>) {
        this._records = newValue;
    }
}