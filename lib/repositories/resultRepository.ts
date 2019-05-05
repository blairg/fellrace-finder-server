import { MongoRepository } from './mongoRepository';

export interface ResultRepositoryInterface {
  getRaces(names: Array<string>): Promise<any>;
}

export class ResultRepository extends MongoRepository
  implements ResultRepositoryInterface {

  constructor(mongoUrl: string) {
    super(mongoUrl);
  }

  public async getRaces(names: Array<string>): Promise<any> {
    let raceResults = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceCollectionName)
        .find({ 'runners.name': { $in: names } });
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

    return raceResults;
  }
}
