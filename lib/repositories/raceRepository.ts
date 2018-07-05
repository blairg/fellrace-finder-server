import { MongoClient } from 'mongodb';

export interface RaceRepositoryInterface {
  getRaces(name: string): Promise<any>;
  getRunnerNames(): Promise<any>;
}

export class RaceRepository implements RaceRepositoryInterface {
    mongoUrl: string;

    constructor(mongoUrl: string) {
        this.mongoUrl = mongoUrl;
    }

    public async getRaces(name: string): Promise<any> {
        let raceResults = [];
        const client = await MongoClient.connect(this.mongoUrl);

        try {
            const racesCursor = 
                await client.db("fellraces")
                    .collection("races")
                    .find({'runners.name': name});
            let i = 0;

            // Do something with the result of the query
            for (let doc = await racesCursor.next(); doc != null; doc = await racesCursor.next()) {
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

    public async getRunnerNames(): Promise<any> {
        let runners: any[] = [];
        const client = await MongoClient.connect(this.mongoUrl);

        try {
            let runnersFromQuery = await client.db("fellraces").collection('races').distinct('runners.name', {});
            runnersFromQuery = runnersFromQuery.sort();

            return runnersFromQuery;
        } catch (exception) {
            console.log('Error with mongo query:', exception);
        } finally {
            client.close();
        }

        return runners;
    }
}