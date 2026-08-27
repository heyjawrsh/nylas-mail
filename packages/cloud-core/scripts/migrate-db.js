import path from 'node:path'
import Umzug from 'umzug'
import {DatabaseConnector} from '..'

/**
 * Minimal Umzug v3 storage backed by the shared sequelize instance.
 * Keeps the historical `migrations` table layout (column `name`).
 */
function sequelizeStorage(sequelize) {
  const tableName = 'migrations'
  const columnName = 'name'
  return {
    async logMigration({name}) {
      await sequelize.queryInterface.createTable(tableName, {
        [columnName]: {type: sequelize.Sequelize.STRING},
      }).catch(() => {}) // exists
      await sequelize.query(`INSERT INTO ${tableName} (${columnName}) VALUES ('${name}')`)
    },
    async unlogMigration({name}) {
      await sequelize.query(`DELETE FROM ${tableName} WHERE ${columnName} = '${name}'`)
    },
    async executed() {
      try {
        const [rows] = await sequelize.query(`SELECT ${columnName} AS name FROM ${tableName}`)
        return rows.map((r) => r.name)
      } catch (_) {
        return []
      }
    },
  }
}

async function activate() {
  // Perform migrations before starting sync
  const db = await DatabaseConnector.forShared();

  const umzug = new Umzug({
    storage: sequelizeStorage(db.sequelize),
    migrations: {
      glob: [path.join(__dirname, '..', 'migrations', '*.js').replace(/\\/g, '/')],
    },
    context: db.sequelize.getQueryInterface(),
    logger: console,
  });

  return umzug;
}

async function upgrade() {
  const umzug = await activate();
  const pending = await umzug.pending();
  if (pending.length > 0) {
    console.log(`Running ${pending.length} migration(s).`)
  } else {
    console.log(`No new migrations to run.`)
  }

  return umzug.up() // run all pending migrations
}

async function downgrade() {
  const umzug = await activate();
  console.log(`Running 1 down migration.`)

  return umzug.down()
}

async function main() {
  if (process.argv.length !== 3) {
    console.log("usage: migrate-db up|down")
  } else if (process.argv[2] === 'up') {
    await upgrade();
  } else if (process.argv[2] === 'down') {
    await downgrade();
  }
}

main();
