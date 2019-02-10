declare var process: {
  env: {
    MONGO_URL: string;
  };
};

import * as chalk from 'chalk';
import * as Router from 'koa-router';
import { Request, ParameterizedContext } from 'koa';
import * as Prometheus from 'prom-client';

import { CacheService } from './services/cacheService';
import { RaceService } from './services/raceService';
import { ResultService } from './services/resultService';
import { RaceRepository } from './repositories/raceRepository';
import { ResultRepository } from './repositories/resultRepository';
import { SearchRepository } from './repositories/searchRepository';
import { SearchService } from './services/searchService';

// Prometheus HTTP request duration
const httpRequestDurationMicroseconds = new Prometheus.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['route'],
  // buckets for response time from 0.1ms to 500ms
  buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]
});

// Prometheus Gauges
const raceByRunnerNameGauge = new Prometheus.Gauge(
  { name: 'race_by_runner_name', help: 'Number of request for race by runner name' }
);

const raceByRunnerNamesAndRaceNamesGauge = new Prometheus.Gauge(
  { name: 'race_by_runner_names_race_names', help: 'Number of requests for races by runners name and race names' }
);

const runnersByPartialSearchGauge = new Prometheus.Gauge(
  { name: 'runners_by_partial_search_name', help: 'Number of requests for runners by partial search name' }
);

const allRunnersGauge = new Prometheus.Gauge(
  { name: 'all_runners', help: 'Number of requests for all runners' }
);


const router = new Router();

// @TODO: Use an IOC container here
const mongoUrl = process.env.MONGO_URL;
const resultRepository = new ResultRepository(mongoUrl);
const raceRepository = new RaceRepository(mongoUrl);
const searchRepository = new SearchRepository(mongoUrl);
const cacheService = new CacheService();
const raceService = new RaceService(cacheService, raceRepository);
const searchService = new SearchService(cacheService, searchRepository);
const resultService = new ResultService(
  cacheService,
  raceService,
  searchService,
  resultRepository,
);

const recordMetric = (startTime: Date, ctx: ParameterizedContext<any, Router.IRouterParamContext<any, {}>>) => {
  const endTime = new Date();
  const difference = endTime.getUTCMilliseconds() - startTime.getUTCMilliseconds();

  httpRequestDurationMicroseconds
  .labels(ctx.path)
  .observe(difference);
};

/**
 * Index page. Currently doesn't do anything. ¯\_(ツ)_/¯
 */
router.get('/', async (ctx, next) => {
  const startTime = new Date();
  await next();

  ctx.body = '(This page intentionally left blank)';
  ctx.status = 200;

  recordMetric(startTime, ctx);
});

/**
 * Prometheus Metrics.
 */
router.get('/metrics', async (ctx, next) => {
  await next();

  ctx.set('Content-Type', Prometheus.register.contentType);
  Prometheus.register.metrics();
  ctx.body = Prometheus.register.metrics();
  ctx.status = 200;
})

/**
 * Races by runners names.
 */
router.get('/runner/:names/:startIndex/:endIndex', async (ctx, next) => {
  const startTime = new Date();
  await next();

  ctx.body = await resultService.searchRunner(
    ctx.params.names,
    ctx.params.startIndex,
    ctx.params.endIndex,
  );
  ctx.status = 200;

  recordMetric(startTime, ctx);
  raceByRunnerNameGauge.inc();
});

/**
 * Races by runners names and race names.
 */
router.get('/runnerByRace/:names/:raceNames', async (ctx, next) => {
  const startTime = new Date();
  await next();

  ctx.body = await resultService.searchRunnerByRace(
    ctx.params.names,
    ctx.params.raceNames,
  );
  ctx.status = 200;

  recordMetric(startTime, ctx);
  raceByRunnerNamesAndRaceNamesGauge.inc();
});

/**
 * Runner names partial name search.
 */
router.get('/autocomplete/runner/:partialName', async (ctx, next) => {
  const startTime = new Date();
  await next();

  ctx.body = await searchService.getRunnerNames(ctx.params.partialName);
  ctx.status = 200;

  recordMetric(startTime, ctx);
  runnersByPartialSearchGauge.inc();
});

/**
 * Get all runners.
 */
router.get('/allrunners', async (ctx, next) => {
  const startTime = new Date();
  await next();

  ctx.body = await searchService.getAllRunnerNames();
  ctx.status = 200;

  recordMetric(startTime, ctx);
  allRunnersGauge.inc();
});

export default router;

interface IKoaRequestWithBody extends Router.IRouterContext {
  request: IKoaBodyParserRequest;
}

interface IKoaBodyParserRequest extends Request {
  body: any;
}
