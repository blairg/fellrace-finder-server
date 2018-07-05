/**
 * Koa 2 routes
 */

declare var process: {
  env: {
      MONGO_URL: string,
  }
};

import * as Router from 'koa-router';
import {Request} from 'koa';
import * as chalk from 'chalk';

import { CacheService } from './services/cacheService';
import { RaceService } from './services/raceService';
import { RaceRepository } from './repositories/raceRepository';

const router = new Router();

// @TODO: Use an IOC container here
const mongoUrl = process.env.MONGO_URL;
const cacheService = new CacheService();
const raceRepository = new RaceRepository(mongoUrl);
const raceService = new RaceService(cacheService, raceRepository);

/**
 * Index page. Currently doesn't do anything. ¯\_(ツ)_/¯
 */
router.get('/', async (ctx, next) => {
  await next();
  ctx.body = '(This page intentionally left blank)';
  ctx.status = 200;
});

/**
 * Races by runner name.
 */
router.get('/runner/:name', async (ctx, next) => {
  await next();
  ctx.body = await raceService.searchRunner(ctx.params.name);
  ctx.status = 200;
});

/**
 * Runner names.
 */
router.get('/autocomplete/runner/:partialName', async (ctx, next) => {
  await next();
  ctx.body = await raceService.getRunnerNames(ctx.params.partialName);
  ctx.status = 200;
});

/**
 * Get all runners.
 */
router.get('/allrunners', async (ctx, next) => {
  await next();
  ctx.body = await raceService.getAllRunnerNames();
  ctx.status = 200;
});


export default router;

interface IKoaRequestWithBody extends Router.IRouterContext {
  request: IKoaBodyParserRequest;
}

interface IKoaBodyParserRequest extends Request {
  body: any;
}
