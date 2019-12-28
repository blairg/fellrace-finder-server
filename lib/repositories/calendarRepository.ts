import { MongoRepository } from './mongoRepository';

export interface CalendarRepositoryInterface {
  getEvents(): Promise<any>;
  getAlexaEvents(): Promise<any>;
}

export class CalendarRepository extends MongoRepository
  implements CalendarRepositoryInterface {
  constructor(mongoUrl: string) {
    super(mongoUrl);
  }

  public async getEvents(): Promise<any> {
    let races = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceInfoCollectionName)
        .find(
          { },
          { fields: { 'id': 1, 'name': 1, 'date': 1, 'time': 1, 'distance': 1, 'climb': 1, } },
        ).sort({ 'date': 1 }); // @TODO: Get for current year

      let i = 0;

      for (
        let doc = await racesCursor.next();
        doc != null;
        doc = await racesCursor.next()
      ) {
        races[i] = doc;
        i++;
      }
    } catch (exception) {
      console.log('Error with mongo query:', exception);
    } finally {
      client.close();
    }

    return races;
  }

  public async getAlexaEvents(): Promise<any> {
    let races = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceInfoCollectionName)
        .find({})
        .sort({ 'date': 1 });

      let i = 0;

      for (
        let doc = await racesCursor.next();
        doc != null;
        doc = await racesCursor.next()
      ) {
        races[i] = doc;
        i++;
      }
    } catch (exception) {
      console.log('Error with mongo query:', exception);
    } finally {
      client.close();
    }

    return races;
  }
}
