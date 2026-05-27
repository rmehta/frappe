export class DropdownConsole {
	constructor() {
		this.dialog = new frappe.ui.Dialog({
			title: __("System Console"),
			minimizable: true,
			static: true,
			no_cancel_flag: true, // hack: global escape handler kills the dialog
			size: "large",
			fields: [
				{
					description: `
					${frappe.utils.icon("solid-warning", "xs")}
					WARNING: Executing random untested code here is dangerous, use with extreme caution. <br>
					Usage: To execute press ctrl/cmd+enter.
					To minimize this window press Escape.
					Press shift+t to bring the window back.
					`,
					fieldname: "console",
					fieldtype: "Code",
					label: "Console",
					options: "Python",
					min_lines: 20,
					max_lines: 20,
					wrap: true,
				},
				{
					fieldname: "output",
					fieldtype: "Code",
					label: "Output",
					read_only: 1,
				},
			],
		});
		this.dialog.get_close_btn().show(); // framework hides it on static dialogs
		this.field = null;

		let me = this;
		this.dialog.$wrapper.on("keydown", function (e) {
			if (e.key === "Escape") {
				e.preventDefault();
				if (!me.dialog.is_minimized) {
					me.dialog.toggle_minimize();
				}
				return false;
			}
		});
	}

	sleep(duration) {
		return new Promise((r) => setTimeout(r, duration));
	}

	async wait_for_editor() {
		let retry_count = 0;
		while (retry_count++ < 10 && !this.field) {
			await this.sleep(25);
			const f = this.dialog.get_field("console");
			if (f?.editor) this.field = f;
		}
		if (!this.field) throw Error("Code editor not found");
	}

	async show() {
		this.dialog.show();
		await this.wait_for_editor();
		this.bind_executer();
		this.load_completions();
		this.load_contextual_boilerplate();
	}

	async load_contextual_boilerplate() {
		let default_code;
		if (cur_frm && !cur_frm.is_new()) {
			default_code = `doc = frappe.get_doc("${cur_frm.doc.doctype}", "${cur_frm.doc.name}")\n`;
		} else if (cur_list && frappe.get_route()[0] == "List") {
			let args = cur_list.get_args();
			default_code = `docs = frappe.get_all("${args.doctype}",
				fields="*",
				order_by="${args.order_by}",
				limit=${args.page_length},
				filters=${JSON.stringify(args.filters)},
			)\n`;
		}

		let current_code = this.dialog.get_value("console");
		if (!current_code && default_code) {
			this.field?.insert_at_cursor(default_code);
		}
	}

	async bind_executer() {
		let me = this;
		// remove vim/emacs so Ctrl-Enter always works
		this.field.clear_mode_extension();
		this.field.add_keymap({
			key: "Mod-Enter",
			run() {
				me.execute_code();
				return true;
			},
		});
	}

	async execute_code() {
		this.dialog.set_value("output", "");
		const output_field = this.dialog.get_field("output");
		output_field.set_description("");
		const start = frappe.datetime.now_datetime(true);
		let { output } = await frappe.xcall(
			"frappe.desk.doctype.system_console.system_console.execute_code",
			{
				doc: {
					console: this.dialog.get_value("console"),
					doctype: "System Console",
					type: "Python",
				},
			},
			"POST",
			{
				freeze: true,
				freeze_message: __("Executing Code"),
			}
		);
		const end = frappe.datetime.now_datetime(true);
		this.dialog.set_value("output", output);
		const time_taken = moment(end).diff(start, "milliseconds");
		output_field.set_description(`Executed in ${time_taken} milliseconds.
			<a target="_blank" href="/desk/console-log?owner=${frappe.session.user}" >View Logs</a>`);
	}

	async load_completions() {
		let me = this;
		let items = await frappe.xcall(
			"frappe.core.doctype.server_script.server_script.get_autocompletion_items",
			null,
			"GET",
			{ cache: true }
		);
		const field = me.dialog.get_field("console");
		const custom_completions = [];
		if (cur_frm && !cur_frm.is_new()) {
			frappe.meta
				.get_fieldnames(cur_frm.doc.doctype, cur_frm.doc.parent, {
					fieldtype: ["not in", frappe.model.no_value_type],
				})
				.forEach((fieldname) => {
					custom_completions.push(`doc.${fieldname}`);
				});
		}

		field.df.autocompletions = [...items, ...custom_completions];
	}
}
