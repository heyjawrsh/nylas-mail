module.exports = (sequelize, Sequelize) => {
	const PendingAuthResponse = sequelize.define("pendingAuthResponse", {
		response: Sequelize.TEXT("long"),
		pendingAuthKey: Sequelize.STRING,
	});

	PendingAuthResponse.associate = () => {};

	return PendingAuthResponse;
};
