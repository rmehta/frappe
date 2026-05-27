frappe.ui.form.ControlJSON = class ControlCode extends frappe.ui.form.ControlCode {
	set_language() {
		this.df.options = "JSON";
		super.set_language();
	}
};
