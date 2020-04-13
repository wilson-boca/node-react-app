import 'dotenv/config';
import express from 'express';
import path from 'path';
import Youch from 'youch';
import 'express-async-errors';
import routes from './routes';
import sentryConfig from './config/sentry';
import './database';

const Sentry = require('@sentry/node');

class App {
  constructor() {
    this.server = express();
    Sentry.init(sentryConfig);
    this.middlewares();
    this.routes();
    this.server.use(async function onError(err, req, res, next) {
      if (process.env.NODE_ENV === 'development') {
        const errors = await new Youch(err, req).toJSON();
        res.status(500).json(errors);
      } else {
        res.status(500).json({ error: 'Internal server error' });
        res.end();
      }
    });
  }

  middlewares() {
    this.server.use(Sentry.Handlers.requestHandler());
    this.server.use(express.json());
    this.server.use(
      '/files',
      express.static(path.resolve(__dirname, '..', 'temp', 'uploads'))
    );
  }

  routes() {
    this.server.use(routes);
    this.server.use(Sentry.Handlers.errorHandler());
  }
}

export default new App().server;
