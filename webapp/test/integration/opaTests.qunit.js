/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["zzbankpayable/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
