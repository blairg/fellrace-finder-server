import { MongoRepository } from './mongoRepository';

export interface RaceRepositoryInterface {
  getRaces(names: string[], dates: string[]): Promise<any>;
}

export class RaceRepository extends MongoRepository
  implements RaceRepositoryInterface {
  constructor(mongoUrl: string) {
    super(mongoUrl);
  }

  public async getRaces(names: string[], dates: string[]): Promise<any> {
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
}
