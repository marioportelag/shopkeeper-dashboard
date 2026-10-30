import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { create } from 'express-handlebars';
import helmet from 'helmet';
import { buildDashboardModel, fetchListingStats, InvalidRangeError, parseMonthRange } from './listings.js';
import { serializeForScript } from './safe-json.js';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_MODULES = path.join(ROOT_DIR, 'node_modules');

/** Front-end libraries served from installed npm packages (no third-party CDNs). */
const VENDOR_FILES = new Map([
  ['chart.umd.min.js', 'chart.js/dist/chart.umd.min.js'],
  ['dataTables.min.js', 'datatables.net/js/dataTables.min.js'],
  ['dataTables.dataTables.min.css', 'datatables.net-dt/css/dataTables.dataTables.min.css'],
]);

/**
 * @param {object} deps
 * @param {{ query: Function }} deps.db  PostgreSQL pool (or any object with a compatible `query`).
 * @param {{ error: Function }} [deps.logger]
 */
export function createApp({ db, logger = console }) {
  const app = express();

  const hbs = create({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(ROOT_DIR, 'views/layouts'),
    helpers: {
      // Emits JSON for a non-executable <script type="application/json"> data block.
      jsonScript: (value) => new hbs.handlebars.SafeString(serializeForScript(value)),
    },
  });

  app.engine('hbs', hbs.engine);
  app.set('view engine', 'hbs');
  app.set('views', path.join(ROOT_DIR, 'views'));
  app.disable('x-powered-by');

  // Helmet's default CSP allows scripts only from this origin: no inline or CDN scripts.
  app.use(helmet());
  app.use(express.static(path.join(ROOT_DIR, 'public'), { index: false }));

  app.get('/vendor/:file', (req, res, next) => {
    const relativePath = VENDOR_FILES.get(req.params.file);
    if (!relativePath) {
      next();
      return;
    }
    res.sendFile(path.join(NODE_MODULES, relativePath), { maxAge: '1d' });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/', async (req, res) => {
    let range;
    try {
      range = parseMonthRange(req.query);
    } catch (error) {
      if (!(error instanceof InvalidRangeError)) throw error;
      res.status(400).render('error', { title: 'Invalid reporting period', message: error.message });
      return;
    }

    let rows;
    try {
      rows = await fetchListingStats(db, range);
    } catch (error) {
      logger.error('Failed to load listing statistics:', error);
      res.status(503).render('error', {
        title: 'Data temporarily unavailable',
        message: 'The dashboard could not load its data. Please try again later.',
      });
      return;
    }

    res.render('index', buildDashboardModel(rows, range));
  });

  app.use((_req, res) => {
    res
      .status(404)
      .render('error', { title: 'Page not found', message: 'The requested page does not exist.' });
  });

  // Express identifies error handlers by their four-argument signature.
  app.use((error, _req, res, _next) => {
    logger.error('Unhandled error:', error);
    res
      .status(500)
      .render('error', { title: 'Something went wrong', message: 'An unexpected error occurred.' });
  });

  return app;
}
