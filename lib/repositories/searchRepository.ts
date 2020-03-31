import { MongoRepository } from './mongoRepository';

export interface SearchRepositoryInterface {
  getAllRaces(): Promise<any[]>;
  getAllRunnerNames(): Promise<string[]>;
  getRunnersClubs(names: Array<string>): Promise<any>;
}

export class SearchRepository extends MongoRepository
  implements SearchRepositoryInterface {
  constructor(mongoUrl: string) {
    super(mongoUrl);
  }

  public async getAllRaces(): Promise<any> {
    let races: any[] = [];
    const client = await this.connect();

    try {
      const racesCursor = await client
        .db(this.databaseName)
        .collection(this.raceInfoCollectionName)
        .find(
          { },
          { fields: { 'id': 1, 'name': 1, 'date': 1, 'time': 1 } },
        ).sort({'name': 1});

      for (
        let doc = await racesCursor.next();
        doc != null;
        doc = await racesCursor.next()
      ) {
          if (!races.some(each => each.name === doc.name)) {
            races.push({
            ...doc,
            });
          } else {
            let race = races.find(each => each.name === doc.name);
            const raceYear = race.date.toString().split('/')[2];
            const docRaceYear = doc.date.toString().split('/')[2];

            if (docRaceYear > raceYear) {
              race.date = doc.date;
              race.time = doc.time;
            }
          }
    };
    } catch (exception) {
      console.log('Error with mongo query:', exception);
    } finally {
      client.close();
    }

    return races;
  }

  public async getAllRunnerNames(): Promise<string[]> {
    let runners: string[] = [];
    const client = await this.connect();

    try {
      let runnersFromQuery = await client
        .db(this.databaseName)
        .collection(this.raceCollectionName)
        .distinct('runners.name',  {} );
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
