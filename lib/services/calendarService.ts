import { CalendarRepositoryInterface } from '../repositories/calendarRepository';
import * as moment from 'moment';
import { CacheServiceInterface } from './cacheService';
import { computeRaceType } from '../utils/raceUtils';
export interface CalendarServiceInterface {
  getEvents(): any;
}

export class CalendarService implements CalendarServiceInterface {
    
    cacheService: CacheServiceInterface;
    calendarRepository: CalendarRepositoryInterface;

    constructor(
        cacheService: CacheServiceInterface,
        calendarRepository: CalendarRepositoryInterface,
    ) {
        this.cacheService = cacheService;
        this.calendarRepository = calendarRepository;
    }

    public async getEvents() {
        const cacheKey = 'CalendarService.getEvents';
        const cachedValue = this.cacheService.get(cacheKey);
    
        if (cachedValue) {
            return cachedValue;
        }

        const races = await this.calendarRepository.getEvents();
        let events = new Array<any>();

        for (let i = 0; i < races.length; i++) {
            if (races[i].date.trim() === '' || races[i].time.trim() === '') {
                continue;
            }

            const year = races[i].date.substring(6, 10);
            const month = races[i].date.substring(3, 5);
            const day = races[i].date.substring(0, 2);
            const timeParts = races[i].time.split(':');
            let hours = timeParts[0];
            let minutes = timeParts[1];

            if (parseInt(year) !== new Date().getFullYear() || parseInt(month) < new Date().getMonth()) {
                continue;
            }

            if (!hours || hours === 0) {
                hours = '09';
            }

            if (!minutes) {
                minutes = '00';
            }

            if (parseInt(hours) < 0 || parseInt(hours) > 23) {
                hours = '09';
            }

            if (parseInt(minutes) < 0 || parseInt(minutes) > 59) {
                minutes = '00';
            }

            if (timeParts.length === 2) {
                try {
                    const startDate = moment(`${day}/${month}/${year} ${hours}:${minutes}`, ["DD/MM/YYYY HH:mm"]).toDate();
                    const endDate = moment(`${day}/${month}/${year} ${parseInt(hours) + 1}:${minutes}`, ["DD/MM/YYYY HH:mm"]).toDate();
                    const kilometers = races[i].distance.kilometers;

                    if (!events.some((event: any) => event.title === races[i].name && event.start === startDate)) {
                        events.push({
                            id: races[i].id,
                            title: `${races[i].name} - ${computeRaceType(races[i].climb, races[i].distance)}`,
                            start: startDate,
                            end:  endDate,
                            short: kilometers < 10,
                            medium: kilometers >= 10 && kilometers < 20,
                            long: kilometers >= 20,
                            url: `https://www.fellrunner.org.uk/races.php?id=${races[i].id}`,
                        });
                    }
                } catch (error) {
                    console.log('failing validation in catch', error);
                }
            }
        }

        this.cacheService.set(cacheKey, events);

        return events;
    }
}
