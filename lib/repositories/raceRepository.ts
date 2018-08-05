import { MongoClient } from 'mongodb';

export interface RaceRepositoryInterface {
  getRaces(names: Array<string>): Promise<any>;
  getRunnerNames(): Promise<any>;
  getRunnersClubs(names: Array<string>): Promise<any>;
}

export class RaceRepository implements RaceRepositoryInterface {
  mongoUrl: string;

  constructor(mongoUrl: string) {
    this.mongoUrl = mongoUrl;
  }

  public async getRaces(names: Array<string>): Promise<any> {
    let raceResults = [];
    const client = await MongoClient.connect(
      this.mongoUrl,
      { useNewUrlParser: true },
    );

    try {
      const racesCursor = await client
        .db('fellraces')
        .collection('races')
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
    const client = await MongoClient.connect(
      this.mongoUrl,
      { useNewUrlParser: true },
    );

    try {
      let runnersFromQuery = await client
        .db('fellraces')
        .collection('races')
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
    const client = await MongoClient.connect(
      this.mongoUrl,
      { useNewUrlParser: true },
    );

    try {
      const runnersCursor = await client
        .db('fellraces')
        .collection('races')
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
