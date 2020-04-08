import { Router } from 'express';

const routes = new Router();

routes.get('/', (req, res) => res.json({ hello: 'Cool Brother' }));

export default routes;
