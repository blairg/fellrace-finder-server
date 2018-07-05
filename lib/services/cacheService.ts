import { Cache } from 'memory-cache';

const cache = new Cache();

export interface CacheServiceInterface {
    get(key: string): any;

    set(key: string, value: any, time?: number): any;
}

export class CacheService implements CacheServiceInterface {
    get(key: string) {
        return cache.get(key);
    }

    set(key: string, value: any, time: number = 86400000) {
        cache.put(key, value, time);
    }
}
