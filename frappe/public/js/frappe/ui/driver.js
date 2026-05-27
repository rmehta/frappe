// driver.js is loaded on demand — only when a guided tour is started
let _driver_promise = null;

frappe.get_driver = async function () {
	if (!_driver_promise) {
		_driver_promise = import("driver.js").then((m) => m.default);
	}
	return _driver_promise;
};
