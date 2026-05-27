import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
	emacsStyleKeymap,
} from "@codemirror/commands";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import { json } from "@codemirror/lang-json";
import { StreamLanguage } from "@codemirror/language";
import { go } from "@codemirror/legacy-modes/mode/go";
import { jinja2 } from "@codemirror/legacy-modes/mode/jinja2";
import { oneDark } from "@codemirror/theme-one-dark";
import { vim } from "@replit/codemirror-vim";

const VALID_LANGUAGES = [
	"Javascript",
	"JS",
	"Python",
	"Py",
	"PythonExpression",
	"HTML",
	"CSS",
	"Markdown",
	"SCSS",
	"JSON",
	"Golang",
	"Go",
	"Jinja",
	"SQL",
];

frappe.ui.form.ControlCode = class ControlCode extends frappe.ui.form.ControlText {
	make_input() {
		if (this.editor) return;
		this.make_code_editor();
	}

	// backward-compat alias: markdown_editor.js overrides this
	make_ace_editor() {
		this.make_code_editor();
	}

	refresh() {
		super.refresh();
		if (this.df.fieldtype === "Code") {
			this.setup_copy_button();
		}
	}

	setup_copy_button() {
		if (this.get_status() === "Write") {
			this.copy_button?.remove();
			this.copy_button = null;
			return;
		}
		if (this.copy_button) return;
		this.copy_button = $(
			`<button
				class="btn icon-btn"
				style="position: absolute; top: 32px; right: 5px;"
				onmouseover="this.classList.add('btn-default')"
				onmouseout="this.classList.remove('btn-default')"
				title="${__("Copy to Clipboard")}"
			>
				<svg class="es-icon es-line  icon-sm" style="" aria-hidden="true">
					<use class="" href="#es-line-copy-light"></use>
				</svg>
			</button>`
		);
		this.copy_button.on("click", () => {
			frappe.utils.copy_to_clipboard(this.get_model_value() || this.get_value());
		});
		this.copy_button.appendTo(this.$wrapper);
	}

	make_code_editor() {
		if (this.editor) return;

		this.editor_target = $('<div class="cm-editor-target border rounded"></div>').appendTo(
			this.input_area
		);
		// keep old name as alias so subclasses that reference ace_editor_target still work
		this.ace_editor_target = this.editor_target;

		this.editor_target.css("height", 300);
		if (this.df.max_height) {
			this.editor_target.css("max-height", this.df.max_height);
		}

		this._language = new Compartment();
		this._mode = new Compartment();
		this._autocomplete = new Compartment();
		this._extra_keymap = new Compartment();
		this._setting_content = false;

		const on_change = frappe.utils.debounce(() => {
			this.parse_validate_and_set_in_model(this.get_input_value());
		}, 300);

		const base_extensions = [
			this._language.of([]),
			this._mode.of(this._get_mode_extension()),
			this._autocomplete.of([]),
			this._extra_keymap.of([]),
			EditorState.readOnly.of(!!this.disabled),
			history(),
			keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab, ...completionKeymap]),
			EditorView.updateListener.of((update) => {
				if (update.docChanged && !this._setting_content) on_change();
			}),
			EditorView.theme({
				"&": { height: "100%" },
				".cm-scroller": {
					overflow: "auto",
					fontFamily: "var(--font-stack-mono, 'Fira Code', 'Fira Mono', monospace)",
				},
			}),
			oneDark,
		];

		if (this.df.wrap) {
			base_extensions.push(EditorView.lineWrapping);
		}

		if (this.df.placeholder) {
			base_extensions.push(cmPlaceholder(this.df.placeholder));
		}

		if (this.df.max_lines || this.df.min_lines || this.df.max_height) {
			if (this.df.max_lines) {
				base_extensions.push(
					EditorView.theme({ ".cm-scroller": { maxHeight: `${this.df.max_lines * 1.6}em` } })
				);
			}
			if (this.df.min_lines) {
				base_extensions.push(
					EditorView.theme({ ".cm-scroller": { minHeight: `${this.df.min_lines * 1.6}em` } })
				);
			}
		} else {
			this.expanded = false;
			this.$expand_button = $(
				`<button class="btn btn-xs btn-default mt-2">${this.get_button_label()}</button>`
			)
				.click(() => {
					this.expanded = !this.expanded;
					this.refresh_height();
					this.toggle_label();
				})
				.appendTo(this.$input_wrapper);
		}

		this.editor = new EditorView({
			state: EditorState.create({ doc: "", extensions: base_extensions }),
			parent: this.editor_target.get(0),
		});

		this.set_language();

		Object.defineProperty(this.df, "autocompletions", {
			configurable: true,
			get() {
				return this._autocompletions || [];
			},
			set: (value) => {
				let getter = typeof value === "function" ? value : () => value;
				if (!this._autocompletions) this._autocompletions = [];
				if (value.length > 0) {
					this._autocompletions.push(getter);
					this.setup_autocompletion();
				} else {
					this.editor?.dispatch({
						effects: this._autocomplete?.reconfigure([]),
					});
				}
			},
		});
	}

	_get_mode_extension() {
		const editor_type = frappe.boot?.user?.code_editor_type || "vscode";
		if (editor_type === "vim") return vim();
		if (editor_type === "emacs") return keymap.of(emacsStyleKeymap);
		return [];
	}

	_get_language_extension(language) {
		switch (language) {
			case "Javascript":
			case "JS":
				return javascript();
			case "Python":
			case "Py":
			case "PythonExpression":
				return python();
			case "HTML":
				return html();
			case "CSS":
			case "SCSS":
				// @codemirror/lang-css handles SCSS syntax in v6+
				return css();
			case "Markdown":
				return markdown();
			case "SQL":
				return sql();
			case "JSON":
				return json();
			case "Golang":
			case "Go":
				return StreamLanguage.define(go);
			case "Jinja":
				return StreamLanguage.define(jinja2);
			default:
				return [];
		}
	}

	set_language() {
		const language = this.df.options;
		if (language && !VALID_LANGUAGES.includes(language)) {
			console.warn(
				`Invalid language option for field "${this.df.label}". Valid options: ${VALID_LANGUAGES.join(", ")}.`
			);
		}
		this.editor?.dispatch({
			effects: this._language?.reconfigure(this._get_language_extension(language)),
		});
	}

	set_wrap(enabled) {
		// toggling line-wrapping requires recreating extensions — simplest to track via CSS
		this.editor_target?.css("white-space", enabled ? "" : "");
		if (enabled && this.editor) {
			// add wrapping by dispatching a compartment change
			// EditorView.lineWrapping is a static extension, apply it at init or via Compartment
			const view = this.editor;
			const state = view.state;
			// wrap via editor DOM class as a fallback
			view.dom.classList.add("cm-wrap");
		}
	}

	setup_autocompletion() {
		const completer = (context) => {
			const word = context.matchBefore(/\w*/);
			if (!word || (word.from === word.to && !context.explicit)) return null;

			const completions = (this._autocompletions || []).flatMap((getter) =>
				getter({ context })
			);
			if (!completions.length) return null;

			return {
				from: word.from,
				options: completions.map((a) => {
					if (typeof a === "string") a = { value: a };
					return {
						label: a.caption || a.value || "",
						detail: a.meta,
						boost: a.score,
						apply: a.value,
					};
				}),
			};
		};

		this.editor?.dispatch({
			effects: this._autocomplete?.reconfigure(autocompletion({ override: [completer] })),
		});
	}

	// Insert text at the current cursor position
	insert_at_cursor(text) {
		if (!this.editor) return;
		const from = this.editor.state.selection.main.from;
		this.editor.dispatch({ changes: { from, insert: text } });
	}

	// Remove vim/emacs bindings (e.g. for the system console)
	clear_mode_extension() {
		this.editor?.dispatch({ effects: this._mode?.reconfigure([]) });
	}

	// Add a custom keyboard shortcut: { win: "Ctrl-Enter", mac: "Cmd-Enter", run: fn }
	add_keymap(binding) {
		if (!this.editor) return;
		const current = this._extra_keymaps || [];
		this._extra_keymaps = [...current, binding];
		this.editor.dispatch({
			effects: this._extra_keymap?.reconfigure(keymap.of(this._extra_keymaps)),
		});
	}

	refresh_height() {
		this.editor_target?.css("height", this.expanded ? 600 : 300);
	}

	toggle_label() {
		this.$expand_button?.text(this.get_button_label());
	}

	get_button_label() {
		return this.expanded
			? __("Collapse", null, "Shrink code field.")
			: __("Expand", null, "Enlarge code field.");
	}

	parse(value) {
		return value ?? "";
	}

	set_formatted_input(value) {
		if (!this.editor) return Promise.resolve();
		if (!value) value = "";
		if (value === this.get_input_value()) return Promise.resolve();
		this._setting_content = true;
		this.editor.dispatch({
			changes: { from: 0, to: this.editor.state.doc.length, insert: value },
		});
		this._setting_content = false;
		return Promise.resolve();
	}

	get_input_value() {
		return this.editor ? this.editor.state.doc.toString() : "";
	}

	set_focus() {
		this.editor?.focus();
	}

	// kept for backward compatibility — no-op since CodeMirror is bundled
	load_lib() {
		return Promise.resolve();
	}
};
