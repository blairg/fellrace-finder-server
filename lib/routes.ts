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

const router = new Router();

// @TODO: Use an IOC container here
const mongoUrl = process.env.MONGO_URL;
const resultRepository = new ResultRepository(mongoUrl);
const raceRepository = new RaceRepository(mongoUrl);
const cacheService = new CacheService();
const raceService = new RaceService(cacheService, raceRepository);
const resultService = new ResultService(
  cacheService,
  raceService,
  resultRepository,
);

/**
 * Index page. Currently doesn't do anything. ¯\_(ツ)_/¯
 */
router.get('/', async (ctx, next) => {
  await next();
  ctx.body = '(This page intentionally left blank)';
  ctx.status = 200;
});

/**
 * Races by runners names.
 */
router.get('/runner/:names/:startIndex/:endIndex', async (ctx, next) => {
  await next();
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
  ctx.body = await resultService.searchRunnerByRace(
    ctx.params.names,
    ctx.params.raceNames,
  );
  ctx.status = 200;
});

/**
 * Runner names partial name search.
 */
router.get('/autocomplete/runner/:partialName', async (ctx, next) => {
  await next();
  ctx.body = await resultService.getRunnerNames(ctx.params.partialName);
  ctx.status = 200;
});

/**
 * Get all runners.
 */
router.get('/allrunners', async (ctx, next) => {
  await next();
  ctx.body = await resultService.getAllRunnerNames();
  ctx.status = 200;
});

export default router;

interface IKoaRequestWithBody extends Router.IRouterContext {
  request: IKoaBodyParserRequest;
}

interface IKoaBodyParserRequest extends Request {
  body: any;
}
