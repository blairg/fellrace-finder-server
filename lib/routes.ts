declare var process: {
  env: {
    MONGO_URL: string;
  };
};

import * as chalk from 'chalk';
import * as Router from 'koa-router';
import { Request } from 'koa';

import { CacheService } from './services/cacheService';
import { RaceService } from './services/raceService';
import { ResultService } from './services/resultService';
import { RaceRepository } from './repositories/raceRepository';
import { ResultRepository } from './repositories/resultRepository';
import { SearchRepository } from './repositories/searchRepository';
import { CalendarRepository } from './repositories/calendarRepository';
import { CalendarService } from './services/calendarService';
import { SearchService } from './services/searchService';

const router = new Router();

// @TODO: Use an IOC container here
const cacheAge = 'public, max-age=1000, s-maxage=1000';
const mongoUrl = process.env.MONGO_URL;
const resultRepository = new ResultRepository(mongoUrl);
const raceRepository = new RaceRepository(mongoUrl);
const searchRepository = new SearchRepository(mongoUrl);
const calendarRepository = new CalendarRepository(mongoUrl);
const cacheService = new CacheService();
const raceService = new RaceService(cacheService, raceRepository);
const searchService = new SearchService(cacheService, raceService, searchRepository);
const resultService = new ResultService(
  cacheService,
  raceService,
  searchService,
  resultRepository,
);
const calendarService = new CalendarService(cacheService, calendarRepository);

/**
 * Index page. Currently doesn't do anything. ¯\_(ツ)_/¯
 */
router.get('/', async (ctx, next) => {
  await next();
  ctx.set('Cache-Control', cacheAge);
  ctx.body = '(This page intentionally left blank)';
  ctx.status = 200;
});

/**
 * Races by runners names.
 */
router.get('/runner/:names/:startIndex/:endIndex', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await resultService.searchRunner(
    ctx.params.names,
    ctx.params.startIndex,
    ctx.params.endIndex,
  );
  ctx.status = 200;
});

/**
 * Races by runners names and race names.
 */
router.get('/runnerByRace/:names/:raceNames', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await resultService.searchRunnerByRace(
    ctx.params.names,
    ctx.params.raceNames,
  );
  ctx.status = 200;
});

/**
 * Races by race names.
 */
router.get('/race/byNames/:raceNames', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await raceService.getRaceInfoByNames(
    ctx.params.raceNames,
  );
  ctx.status = 200;
});

/**
 * Runner names partial name search.
 */
router.get('/autocomplete/runner/:partialName', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await searchService.getRunnerNames(
    ctx.params.partialName
  );
  ctx.status = 200;
});

/**
 * Race names partial name search.
 */
router.get('/autocomplete/race/:partialName', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await searchService.getRaceNames(
    ctx.params.partialName
  );
  ctx.status = 200;
});

/**
 * Get all runners names.
 */
router.get('/allrunnersnames', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await searchService.getAllRunnerNames();
  ctx.status = 200;
});

/**
 * Get all races.
 */
router.get('/allraces', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await searchService.getAllRaces();
  ctx.status = 200;
});

/**
 * Get calendar events.
 */
router.get('/calendarEvents', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await calendarService.getEvents();
  ctx.status = 200;
});

/**
 * Get calendar events for Alexa.
 */
router.get('/alexaEvents', async (ctx, next) => {
  await next();

  ctx.set('Cache-Control', cacheAge);
  ctx.body = await calendarService.getAlexaEvents();
  ctx.status = 200;
});


export default router;

interface IKoaRequestWithBody extends Router.IRouterContext {
  request: IKoaBodyParserRequest;
}

interface IKoaBodyParserRequest extends Request {
  body: any;
}
