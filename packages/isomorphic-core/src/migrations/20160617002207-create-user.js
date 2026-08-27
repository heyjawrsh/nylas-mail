/* eslint no-unused-vars: 0 */

export default {
	up: function up(queryInterface, Sequelize) {
		return queryInterface.createTable("Users", {
			id: {
				allowNull: false,
				autoIncrement: true,
				primaryKey: true,
				type: Sequelize.INTEGER,
			},
			first_name: {
				type: Sequelize.STRING,
			},
			last_name: {
				type: Sequelize.STRING,
			},
			bio: {
				type: Sequelize.TEXT,
			},
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE,
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE,
			},
		});
	},
	down: function down(queryInterface, _Sequelize) {
		return queryInterface.dropTable("Users");
	},
};
