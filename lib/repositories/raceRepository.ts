import { MongoRepository } from './mongoRepository';

export interface RaceRepositoryInterface {
  getRacesByNamesAndDates(names: string[], dates: string[]): Promise<any>;
  getRacesByNames(names: string[]): Promise<any>;
  getRacesByDate(date: string): Promise<any>;
  getResultsByRaceNames(names: Array<string>): Promise<any>;
  getRaceNames(): Promise<any>;
}

export class RaceRepository extends MongoRepository
  implements RaceRepositoryInterface {
  constructor(mongoUrl: string) {
    super(mongoUrl);
  }

  public async getRacesByNamesAndDates(names: string[], dates: string[]): Promise<any> {
    let races = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceInfoCollectionName)
        .find({ name: { $in: names }, date: { $in: dates } });
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

  public async getRacesByDate(date: string): Promise<any> {
    let races = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceInfoCollectionName)
        .find({ date: date });
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

  public async getRacesByNames(names: string[]): Promise<any> {
    let races = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceInfoCollectionName)
        .find({ name: { $in: names } });
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


  public async getResultsByRaceNames(names: string[]): Promise<any> {
    let raceResults = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceCollectionName)
        .find({ 'race': { $in: names } });
      let i = 0;

      // Do something with the result of the query
      for (
        let doc = await racesCursor.next();
        doc != null;
        doc = await racesCursor.next()
      ) {
        raceResults[i] = doc;
        i++;
      }
    } catch (exception) {
      console.log('Error with mongo query:', exception);
    } finally {
      client.close();
    }

    console.log(names);

    return raceResults;
  }

  public async getRaceNames(): Promise<any> {
    let races: string[] = [];
    const client = await this.connect();

    try {
      let racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceInfoCollectionName)
        .find(
          { },
          { fields: { 'name': 1, 'distance.kilometers': 1 } },
        ).sort({ 'name': 1 });

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
