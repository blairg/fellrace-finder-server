/**
 * Koa 2 TypeScript Boilerplate
 */

declare var process: {
  env: {
    NODE_ENV: string;
    PORT: string;
    YARN_PRODUCTION: string;
  };
};

// Save your local vars in .env for testing. DO NOT VERSION CONTROL `.env`!.
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
  require('dotenv').config();
}

import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as chalk from 'chalk';
import * as http from 'http';
import * as cors from '@koa/cors';

import router from './routes';

const corsOptions = {
  origin: process.env.YARN_PRODUCTION === 'false' ? '*' : 'https://blairg.github.io',
};

const app = new Koa();
// const port = process.env.PORT || 5555;
const port = 5555;

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(cors(corsOptions));

app.listen(port, () =>
  console.log(chalk.black.bgGreen.bold(`Listening on port ${port}`)),
);

export default app;
