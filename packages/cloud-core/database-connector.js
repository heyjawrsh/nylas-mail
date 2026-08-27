import Sequelize from 'sequelize';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {loadModels, HookIncrementVersionOnSave, HookTransactionLog} from 'isomorphic-core'
import PubsubConnector from './pubsub-connector';

import './database-extensions'; // Extends Sequelize on require

// If we're running locally, create the sqlite directory if
// it's not present.
let STORAGE_DIR;
if (!process.env.DB_HOSTNAME) {
  STORAGE_DIR = path.join(os.homedir(), '.nylas-cloud-storage');
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR);
    }
  } catch (err) {
    global.Logger.error(err, 'Error creating storage directory')
  }
}

class DatabaseConnector {
  constructor() {
    this._cache = {};
  }

  _sequelizePoolForDatabase(dbname, {test} = {}) {
    if (!test && process.env.DB_HOSTNAME) {
      return new Sequelize(dbname, process.env.DB_USERNAME, process.env.DB_PASSWORD, {
        host: process.env.DB_HOSTNAME,
        dialect: "mysql",
        dialectOptions: {
          charset: 'utf8mb4',
        },
        logging: false,
        pool: {
          min: 1,
          max: 15,
          idle: 5000,
        },
      });
    }

    const storage = test ? ':memory:' : path.join(STORAGE_DIR, `${dbname}.sqlite`)
    return new Sequelize(dbname, '', '', {
      storage: storage,
      dialect: "sqlite",
      logging: false,
    })
  }

  async _sequelizeForShared(options) {
    const sequelize = this._sequelizePoolForDatabase(process.env.DB_NAME, options);
    const db = loadModels(Sequelize, sequelize, {
      modelDirs: [path.join(__dirname, 'models')],
    })

    HookTransactionLog(db, sequelize, {
      only: ['metadata'],
      onCreatedTransaction: (transaction) => {
        PubsubConnector.notifyDelta(transaction.accountId, transaction.toJSON());
      },
    });
    HookIncrementVersionOnSave(db, sequelize);

    db.sequelize = sequelize;
    db.Sequelize = Sequelize;

    await sequelize.authenticate();
    await sequelize.sync();
    return db;
  }

  async forShared() {
    this._cache.shared = this._cache.shared || this._sequelizeForShared();
    return this._cache.shared;
  }
}

module.exports = new DatabaseConnector()
