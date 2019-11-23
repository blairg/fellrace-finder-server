import { CalendarRepositoryInterface } from '../repositories/calendarRepository';
import * as moment from 'moment';
import { CacheServiceInterface } from './cacheService';
import { computeRaceType } from '../utils/raceUtils';
export interface CalendarServiceInterface {
  getEvents(): any;
  getAlexaEvents(): Promise<string>;
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

    public async getAlexaEvents(): Promise<string> {
        const cacheKey = 'CalendarService.getAlexaEvents';
        const cachedValue = this.cacheService.get(cacheKey);
    
        if (cachedValue) {
            return cachedValue;
        }

        let racesByDay = new Array();
        let speechText = '';
        let races = await this.calendarRepository.getAlexaEvents();
        races = races.sort((a: any, b: any) => {
            const momentA = this.buildMomentDate(a.date, a.time);
            const momentB = this.buildMomentDate(b.date, b.time);

            return momentA < momentB ? -1 : momentA > momentB ? 1 : 0;
        });

        for (let i = 0; i < races.length; i++) {
            const race = races[i];

            if (race.date.trim() === '' || race.time.trim() === '') {
                continue;
            }

            const year = race.date.substring(6, 10);
            const month = race.date.substring(3, 5);
            const day = race.date.substring(0, 2);
            const timeParts = race.time.split(':');
            let hours = timeParts[0];
            let minutes = timeParts[1];
            let eachSpeechText = '';

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

            minutes = this.calculateRaceMinutes(minutes);

            if (timeParts.length === 2) {
                try {
                    const momentDate = moment(`${day}/${month}/${year} ${hours}:${minutes}`, ["DD/MM/YYYY HH:mm"]);
                    const todaysDate = moment(new Date());

                    if ((momentDate.diff(todaysDate, 'hours') < 0) || 
                        (momentDate.diff(todaysDate, 'days') < 0 || momentDate.diff(todaysDate, 'days') > 7)) {
                        continue;
                    }

                    // if (racesByDay.some((entry: any) => {
                    //     return entry.date === momentDate.format('DDMMYYYY');
                    // })) {
                    //     for (let i = 0; i < racesByDay.length; i++) {
                    //         if (racesByDay[i].date === momentDate.format('DDMMYYYY')) {
                    //             if (!racesByDay[i].races.some((entry: string) => {
                    //                 return entry === race.name;
                    //             })) {
                    //                 racesByDay[i].races.push(race.name);
                    //             }
        
                    //             break;
                    //         }
                    //     }
                    // } else {
                    //     racesByDay.push({day:momentDate.format('dddd'),  date: momentDate.format('DDMMYYYY'), races: [race.name]});
                    // }

                    // console.log(race.name);

                    const formattedDate = momentDate.format("dddd MMMM Do YYYY h:mm:ss a");
                    const kilometreParts = race.distance.kilometers.toString().split('.');
                    const raceType = computeRaceType(race.climb, race.distance);
                    let raceCategoryType = raceType;

                    if (raceType.length === 2) {
                        raceCategoryType = this.getRaceType(raceCategoryType, raceType);
                    }

                    eachSpeechText = `${race.name} <break time="100ms"/> on <break time="300ms"/> ${formattedDate} <break time="300ms"/> and is a ${raceCategoryType} <break time="300ms"/> and is ${kilometreParts[0]} kilometres in distance <break time="300ms"/> and the venue is ${race.venue.replace(/(,)/g, '')}`;
                    speechText = `${speechText !== '' ? `${speechText}` : `${speechText}`}<p>${eachSpeechText}<break time="400ms"/></p>`;
                } catch (error) {
                    console.log('failing validation in catch', error);
                }
            }
        }

        //console.log(racesByDay);

        speechText = `${speechText} <break time="500ms"/> That's all the fell races for the next 7 days`

        this.cacheService.set(cacheKey, speechText);

        return speechText;
    }

    private buildMomentDate(date: string, time: string): any {
        const year = date.substring(6, 10);
        const month = date.substring(3, 5);
        const day = date.substring(0, 2); 
        const timeParts = time.split(':');
        let hours = timeParts[0];
        let minutes = timeParts[1];
        
        return moment(`${day}/${month}/${year} ${hours}:${minutes}`, ["DD/MM/YYYY HH:mm"]);
    }

    private calculateRaceMinutes(minutes: string): string {
        if (parseInt(minutes) < 15 || parseInt(minutes) > 59) {
            return '00';
        }

        if (parseInt(minutes) > 14 && parseInt(minutes) < 30) {
            return '15';
        }

        if (parseInt(minutes) > 29 && parseInt(minutes) < 45) {
            return '30';
        }

        return '45';
    }

    private getRaceType(raceCategoryType: string, raceType: string): string {
        raceCategoryType = `Category ${raceType.substring(0,1)} <break time="200ms"/>`;

        if (raceType.substring(1,2) === 'S') {
            return `${raceCategoryType} Short race`;
        }

        if (raceType.substring(1,2) === 'M') {
            return `${raceCategoryType} Medium race`;
        }

        return `${raceCategoryType} Long race`;
    }
}
