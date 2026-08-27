import crypto from 'crypto';
import defineModel from './define-model.js';

/**
 * NOTE: SQLITE creates an index on the `primaryKey` (the ID) for you.
 * This "Auto Index" is called `sqlite_autoindex_contacts_1`.
 *
 * If you run `EXPLAIN QUERY PLAN SELECT * FROM contacts WHERE id=1` you
 * get:
 *   SEARCH TABLE contacts USING INDEX sqlite_autoindex_contacts_1
 * (id=?)
 */
export default (sequelize, Sequelize) => {
  return defineModel(sequelize, 'contact', {
    id: {type: Sequelize.STRING(65), primaryKey: true},
    accountId: { type: Sequelize.STRING, allowNull: false },
    version: Sequelize.INTEGER,
    name: Sequelize.STRING,
    email: Sequelize.STRING,
  }, {
    statics: {
      hash({email}) {
        return crypto.createHash('sha256').update(email, 'utf8').digest('hex');
      },
    },
    prototype: {
      toJSON() {
        return {
          id: `${this.id}`,
          account_id: this.accountId,
          object: 'contact',
          email: this.email,
          name: this.name,
        }
      },
    },
  })
}
