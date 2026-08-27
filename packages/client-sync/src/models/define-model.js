module.exports = function defineModel(sequelize, name, attributes, options = {}) {
  const {statics, prototype, ...sequelizeOptions} = options
  const Model = sequelize.define(name, attributes, sequelizeOptions)
  Object.assign(Model, statics)
  Object.assign(Model.prototype, prototype)
  return Model
}
