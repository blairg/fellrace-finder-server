/**
 * Koa 2 TypeScript Boilerplate
 */

declare var process: {
  env: {
    NODE_ENV: string;
    PORT: string;
  };
};

// Save your local vars in .env for testing. DO NOT VERSION CONTROL `.env`!.
if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development')
  require('dotenv').config();

import * as Koa from 'koa';
import * as bodyParser from 'koa-bodyparser';
import * as chalk from 'chalk';
import * as http from 'http';
const cors = require('@koa/cors');

import router from './routes';

const corsOptions = {
  origin: '*',
};

const app = new Koa();
const port = process.env.PORT || 5555;

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .use(cors(corsOptions));

app.listen(port, () =>
  console.log(chalk.black.bgGreen.bold(`Listening on port ${port}`)),
);

export default app;
