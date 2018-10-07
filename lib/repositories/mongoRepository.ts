import { MongoClient } from 'mongodb';

export class MongoRepository {
  databaseName: string = 'fellraces';
  raceCollectionName: string = 'races';
  raceInfoCollectionName: string = 'raceinfo';
  mongoUrl: string;

  constructor(mongoUrl: string) {
    this.mongoUrl = mongoUrl;
  }

  protected async connect(): Promise<MongoClient> {
    return await MongoClient.connect(
      this.mongoUrl,
      { useNewUrlParser: true },
    );
  }
}
