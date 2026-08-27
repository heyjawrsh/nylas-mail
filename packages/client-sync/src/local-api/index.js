/* eslint import/no-dynamic-require: 0 */
/* eslint global-require: 0 */
import Hapi from 'hapi';
import HapiSwagger from 'hapi-swagger';
import HapiBoom from 'hapi-boom-decorators';
import HapiBasicAuth from 'hapi-auth-basic';
import Inert from 'inert';
import Vision from 'vision';
import Package from '../../package.js';
import fs from 'fs';
import path from 'path';
import LocalDatabaseConnector from '../shared/local-database-connector.js';

const server = new Hapi.Server({
  connections: {
    router: {
      stripTrailingSlash: true,
    },
  },
});

let port = 2578;
if (NylasEnv.inDevMode()) port = 1337;
server.connection({port});

const plugins = [Inert, Vision, HapiBasicAuth, HapiBoom, {
  register: HapiSwagger,
  options: {
    info: {
      title: 'Nylas API Documentation',
      version: Package.version,
    },
  },
}];

let sharedDb = null;

const validate = (request, username, password, callback) => {
  let getSharedDb = null;
  if (sharedDb) {
    getSharedDb = Promise.resolve(sharedDb)
  } else {
    getSharedDb = LocalDatabaseConnector.forShared()
  }

  getSharedDb.then((db) => {
    sharedDb = db;
    const {AccountToken} = db;

    AccountToken.findOne({
      where: {
        value: username,
      },
    }).then((token) => {
      if (!token) {
        callback(null, false, {});
        return
      }
      token.getAccount().then((account) => {
        if (!account) {
          callback(null, false, {});
          return;
        }
        request.logger = request.logger.forAccount(account)
        callback(null, true, account);
      });
    });
  });
};

const attach = (directory) => {
  const routesDir = path.join(__dirname, directory)
  for (const filename of fs.readdirSync(routesDir)) {
    if (filename.endsWith('.js')) {
      const routeFactory = (await import(`file://${path.join(routesDir, filename)}`)).default;
      routeFactory(server);
    }
  });
}

server.register(plugins, (err) => {
  if (err) { throw err; }

  attach('./routes')
  attach('./decorators')

  server.auth.strategy('api-consumer', 'basic', { validateFunc: validate });
  server.auth.default('api-consumer');

  server.start((startErr) => {
    if (startErr) { throw startErr; }
    global.Logger.log('API running', {url: server.info.uri});
  });
});
