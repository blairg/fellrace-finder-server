import { Race } from './race';
import { CategoryRecord } from './categoryRecord';

export class RaceInfo extends Race { 
    private _numberOfRunners: number;
    private _numberOfFinishers: number;
    private _performancePercentage: number;
    private _categoryRecords: Array<CategoryRecord>;

    get numberOfRunners(): number {
        return this._numberOfRunners;
    }
    
    set numberOfRunners(newValue: number) {
        this._numberOfRunners = newValue;
    }

    get numberOfFinishers(): number {
        return this._numberOfFinishers;
    }
    
    set numberOfFinishers(newValue: number) {
        this._numberOfFinishers = newValue;
    }

    get performancePercentage(): number {
        return this._performancePercentage;
    }
    
    set performancePercentage(newValue: number) {
        this._performancePercentage = newValue;
    }

    get categoryRecords(): Array<CategoryRecord> {
        return this._categoryRecords;
    }
    
    set categoryRecords(newValue: Array<CategoryRecord>) {
        this._categoryRecords = newValue;
    }
}