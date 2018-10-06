import { MongoRepository } from './mongoRepository';

export interface ResultRepositoryInterface {
  getRaces(names: Array<string>): Promise<any>;
  getRunnerNames(): Promise<any>;
  getRunnersClubs(names: Array<string>): Promise<any>;
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

  public async getRunnerNames(): Promise<any> {
    let runners: any[] = [];
    const client = await this.connect();

    try {
      let runnersFromQuery = await client
        .db(this.databaseName)
        .collection(this.raceCollectionName)
        .distinct('runners.name', {});
      runnersFromQuery = runnersFromQuery.sort();

      return runnersFromQuery;
    } catch (exception) {
      console.log('Error with mongo query:', exception);
    } finally {
      client.close();
    }

    return runners;
  }

  public async getRunnersClubs(names: string[]): Promise<any> {
    let runners: any[] = [];
    const client = await this.connect();

    try {
      const runnersCursor = await client
        .db(this.databaseName)
        .collection(this.raceCollectionName)
        .find(
          { 'runners.name': { $in: names } },
          { fields: { 'runners.name': 1, 'runners.club': 1 } },
        );

      let i = 0;

      for (
        let doc = await runnersCursor.next();
        doc != null;
        doc = await runnersCursor.next()
      ) {
        doc.runners.map((runner: any) => {
          if (runner.club.trim() === '') {
            runner.club = 'Unknown';
          }

          if (
            runner.club.trim().toLowerCase() === 'u/a' ||
            runner.club.trim().toLowerCase() === 'ua'
          ) {
            runner.club = 'Unattached';
          }

          names.map(name => {
            if (runner.name === name) {
              if (
                runners.some(
                  eachRunner =>
                    eachRunner.name === name && eachRunner.club === runner.club,
                )
              ) {
                runners.map(runnerAdded => {
                  if (
                    runner.name === runnerAdded.name &&
                    runner.club === runnerAdded.club
                  ) {
                    runnerAdded.count++;
                  }
                });
              } else {
                runners.push({
                  ...runner,
                  count: 1,
                });
              }
            }
          });
        });
        i++;
      }

      return runners;
    } catch (exception) {
      console.log('Error with mongo query:', exception);
    } finally {
      client.close();
    }

    return runners;
  }
}
