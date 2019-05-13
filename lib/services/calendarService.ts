import { CalendarRepositoryInterface } from '../repositories/calendarRepository';
import * as moment from 'moment';
export interface CalendarServiceInterface {
  getEvents(): any;
}

export class CalendarService implements CalendarServiceInterface {
    calendarRepository: CalendarRepositoryInterface;

    constructor(
        calendarRepository: CalendarRepositoryInterface,
    ) {
        this.calendarRepository = calendarRepository;
    }

    public async getEvents() {
        // @TODO: Add caching

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

            if (parseInt(year) !== new Date().getFullYear()) {
                continue;
            }

            if (races[i].name == "Coiners") {
                console.log(races[i].date, races[i].time);
                console.log(moment(`${day}/${month}/${year} ${hours}:${minutes}`, ["DD/MM/YYYY HH:mm"]).toDate());
            }

            if (races[i].name == "Coiners") {
                console.log(year, month, day);
            }

            if (!hours || hours === 0) {
                console.log(races[i].name, races[i].time);
                hours = '09';
            }

            if (isNaN(hours)) {
                console.log(races[i].name, races[i].time);
            }

            if (!minutes) {
                minutes = '00';
            }

            if (timeParts.length === 2) {
                try {
                    const startDate = moment(`${day}/${month}/${year} ${hours}:${minutes}`, ["DD/MM/YYYY HH:mm"]).toDate();
                    const endDate = moment(`${day}/${month}/${year} ${parseInt(hours) + 1}:${minutes}`, ["DD/MM/YYYY HH:mm"]).toDate();
                    const kilometers = races[i].distance.kilometers;

                    if (races[i].name == "Coiners") {
                        console.log(startDate);
                    }

                    if (!events.some((event: any) => event.title === races[i].name && event.start === startDate)) {
                        events.push({
                            id: i,
                            title: races[i].name,
                            start: startDate,
                            end:  endDate,
                            short: kilometers < 10,
                            medium: kilometers >= 10 && kilometers < 20,
                            long: kilometers >= 20,
                        });
                    }
                } catch (error) {
                    console.log('failing validation in catch', error);
                }
            }
        }

        return events;
    }
}
