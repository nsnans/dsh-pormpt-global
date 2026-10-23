window.__ModuleLoader__.load({
  id: "dsh-pormpt-global",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    let jsxRuntime = require("react/jsx-runtime");
    let jsx = jsxRuntime.jsx;
    let jsxs = jsxRuntime.jsxs;

    const NS = "pormpt-global";

    function createStore(init) {
      let state = init;
      const listeners = new Set();
      return {
        getSnapshot() { return state; },
        subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
        set(next) { state = next; listeners.forEach((fn) => fn()); }
      };
    }

    const FIELDS = [
      { key: "enabled", type: "bool" },
      { key: "prompts", type: "list" }
    ];

    function parseFieldValue(field, raw) {
      if (field.type === "list") {
        if (!Array.isArray(raw)) return { invalid: true };
        const cleaned = raw
          .map((p) => ({
            id: String((p && p.id) || ""),
            title: String((p && p.title) || ""),
            text: String((p && p.text) || ""),
            enabled: !(p && p.enabled === false)
          }));
        return { value: cleaned };
      }
      return { value: raw === true };
    }

    function PIForm(scope) {
      this.scope = scope;
      this.staged = new Map();
      this.listeners = new Set();
      this.saving = false;
      this.failed = false;
      this.store = createStore(this.projection());
      this.listeners.add(() => { this.store.set(this.projection()); });
    }
    PIForm.prototype.publish = function () { this.listeners.forEach((fn) => fn()); };
    PIForm.prototype.snapshotOf = function () { return this.scope.getSnapshot(); };
    PIForm.prototype.sectionValue = function (key) {
      const v = this.snapshotOf().value;
      return v === undefined || v === null ? undefined : v[key];
    };
    PIForm.prototype.userLayer = function () { return this.snapshotOf().user; };
    PIForm.prototype.spec = function (key) { return FIELDS.find((f) => f.key === key); };
    PIForm.prototype.field = function (key) {
      const field = this.spec(key);
      const staged = this.staged.get(key);
      if (staged === undefined) {
        const value = this.sectionValue(key);
        if (field.type === "list") {
          return { stagedList: value === undefined || value === null ? [] : value };
        }
        return { stagedBool: value === true };
      }
      if (field.type === "list") {
        return { stagedList: Array.isArray(staged.value) ? staged.value : [] };
      }
      return { stagedBool: staged.value === true };
    };
    PIForm.prototype.plan = function () {
      const plan = [];
      this.staged.forEach((staged, key) => {
        const field = this.spec(key);
        if (staged.invalid) {
          plan.push({ key, run: undefined });
          return;
        }
        if (field.type === "bool") {
          if (this.sectionValue(key) === staged.value) return;
          plan.push({ key, run: () => this.scope.set(key, staged.value).then(() => {
            const user = this.userLayer();
            return user !== undefined && user !== null && user[key] === staged.value;
          }) });
          return;
        }
        if (field.type === "list") {
          const section = this.sectionValue(key);
          const a = section === undefined || section === null ? [] : section;
          if (JSON.stringify(a) === JSON.stringify(staged.value)) return;
          plan.push({ key, run: () => this.scope.set(key, staged.value).then(() => {
            const user = this.userLayer();
            return user !== undefined && user !== null && JSON.stringify((user[key] === undefined ? [] : user[key])) === JSON.stringify(staged.value);
          }) });
          return;
        }
      });
      return plan;
    };
    PIForm.prototype.shell = function () {
      const snapshot = this.snapshotOf();
      const plan = this.plan();
      return {
        writable: snapshot.writable === true,
        dirty: plan.length > 0,
        invalid: plan.some((item) => item.run === undefined),
        saving: this.saving,
        failed: this.failed
      };
    };
    PIForm.prototype.projection = function () {
      const shell = this.shell();
      const result = { shell };
      FIELDS.forEach((f) => { result[f.key] = this.field(f.key); });
      return result;
    };
    PIForm.prototype.actions = function () {
      const self = this;
      return {
        edit: (key, raw) => {
          self.staged.set(key, parseFieldValue(self.spec(key), raw));
          self.failed = false;
          self.publish();
        },
        toggle: (key, checked) => {
          self.staged.set(key, { value: checked === true });
          self.failed = false;
          self.publish();
        },
        save: async () => {
          const plan = self.plan();
          const runs = [];
          plan.forEach((item) => { if (item.run !== undefined) runs.push(item.run); });
          if (plan.length === 0) {
            if (self.saving) return;
            self.staged.clear();
            self.failed = false;
            self.publish();
            return;
          }
          if (self.saving || runs.length !== plan.length) return;
          self.saving = true;
          self.failed = false;
          self.publish();
          const planned = [];
          plan.forEach((item) => {
            const ref = self.staged.get(item.key);
            if (ref !== undefined) planned.push([item.key, ref]);
          });
          let landed = true;
          for (let i = 0; i < runs.length; i += 1) {
            const okRun = await runs[i]();
            if (!okRun) landed = false;
          }
          if (landed) {
            for (const [key, ref] of planned) {
              if (self.staged.get(key) === ref) self.staged.delete(key);
            }
          }
          self.saving = false;
          self.failed = !landed;
          self.publish();
        },
        discard: () => {
          if (self.staged.size === 0 && !self.failed) return;
          self.staged.clear();
          self.failed = false;
          self.publish();
        }
      };
    };

    const zh = {
      "card.title": "全局提示词",
      "card.description": "维护一组全局提示词，在初始时会自动注入",
      "unsaved": "未保存",
      "save": "保存",
      "saving": "保存中…",
      "discard": "放弃",
      "saveFailed": "保存未生效，请检查输入",
      "readOnly": "当前会话只读",
      "group.general": "基本设置",
      "field.enabled": "启用注入",
      "hint.enabled": "总开关。关闭后每轮不再注入任何提示词。",
      "group.prompts": "注入的提示词",
      "prompt.enabled": "启用此行",
      "prompt.add": "＋ 添加提示词",
      "prompt.delete": "删除",
      "prompt.titlePlaceholder": "标题",
      "prompt.emptyBodyWarn": "正文为空，此行保存后不会注入。"
    };
    const en = Object.assign({}, zh, {
      "card.title": "Context injection (generic prompts)",
      "card.description": "Maintain a set of global prompts; they are injected automatically at the start of a session.",
      "unsaved": "Unsaved",
      "save": "Save",
      "saving": "Saving…",
      "discard": "Discard",
      "saveFailed": "Save did not land; check your input",
      "readOnly": "Read-only in this session",
      "group.general": "General",
      "field.enabled": "Enable injection",
      "hint.enabled": "Master switch. When off, no prompts are injected.",
      "group.prompts": "Prompts to inject",
      "prompt.enabled": "Enable this row",
      "prompt.add": "＋ Add prompt",
      "prompt.delete": "Delete",
      "prompt.titlePlaceholder": "Title",
      "prompt.emptyBodyWarn": "Empty body — this row will not be injected."
    });

    const GROUPS = [
      { titleKey: "group.general", keys: ["enabled"] },
      { titleKey: "group.prompts", keys: ["prompts"] }
    ];

    function FieldRow(props) {
      const t = props.t;
      const head = jsxs("div", { className: "PInj_head", children: [
        jsx("label", { className: "PInj_label", htmlFor: props.id, children: jsxs("span", { className: "PInj_labelText", children: [
          jsx("span", { key: "label", children: t(props.labelKey) }),
          jsx("span", { key: "hint", className: "PInj_labelHint", children: "（" + t(props.hintKey) + "）" })
        ] }) })
      ] });
      const control = jsx("input", { type: "checkbox", className: "PInj_check", id: props.id, checked: props.value === true, onChange: (e) => props.toggle(props.fieldName, e.target.checked), disabled: !props.writable });
      return jsxs("div", { className: "PInj_field", children: [
        head,
        control
      ] });
    }

    function PromptsEditor(props) {
      const t = props.t;
      const list = props.list || [];
      const writable = props.writable !== false;
      const cycle = (i, patch) => {
        const next = list.map((p, j) => (j === i ? Object.assign({}, p, patch) : p));
        props.edit("prompts", next);
      };
      const remove = (i) => {
        const next = list.filter((p, j) => j !== i);
        props.edit("prompts", next);
      };
      const append = () => {
        const id = (globalThis.crypto && globalThis.crypto.randomUUID) ? globalThis.crypto.randomUUID() : ("pi-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10));
        const next = list.concat([{ id, title: "", text: "", enabled: true }]);
        props.edit("prompts", next);
      };
      const rows = list.map((p, i) => {
        const key = String(p.id || ("row-" + i));
        return jsxs("div", { className: "PInj_row", key: key, children: [
          jsxs("div", { className: "PInj_rowHead", children: [
            jsx("input", { className: "PInj_input", value: p.title || "", placeholder: t("prompt.titlePlaceholder"), disabled: !writable, onChange: (e) => cycle(i, { title: e.target.value }) }),
            jsxs("label", { className: "PInj_rowToggle", children: [
              jsx("input", { type: "checkbox", className: "PInj_check", checked: p.enabled !== false, disabled: !writable, onChange: (e) => cycle(i, { enabled: e.target.checked }) }),
              t("prompt.enabled")
            ] }),
            jsx("button", { className: "PInj_del", disabled: !writable, onClick: () => remove(i), title: t("prompt.delete"), "aria-label": t("prompt.delete"), children: "✕" })
          ] }),
          jsx("textarea", { className: "PInj_text", value: p.text || "", rows: 8, placeholder: t("prompt.emptyBodyWarn"), disabled: !writable, onChange: (e) => cycle(i, { text: e.target.value }) })
        ] });
      });
      return jsxs("div", { className: "PInj_prompts", children: [
        rows,
        jsx("button", { className: "PInj_add", type: "button", disabled: !writable, onClick: append, children: t("prompt.add") })
      ] });
    }

    function PromptInjectorCard(props) {
      const t = props.t;
      const state = props.usePromptInjector((s) => s);
      const shell = state.shell;
      if (props.view === "summary") return t("card.description");
      const blocked = !shell.dirty || shell.invalid || shell.saving;
      const body = jsxs("div", { className: "PInj_body", children: [
        !shell.writable ? jsx("p", { className: "PInj_readOnly", children: t("readOnly") }) : null,
        GROUPS.map((group) => jsxs("div", { className: "PInj_group", children: [
          jsx("p", { className: "PInj_groupTitle", children: t(group.titleKey) }),
          group.keys.map((key) => {
            const field = FIELDS.find((f) => f.key === key);
            const fv = state[key];
            if (field.type === "list") {
              return jsxs("div", { className: "PInj_field", children: [
                jsx(PromptsEditor, { t: t, edit: props.edit, list: fv.stagedList, writable: shell.writable })
              ] });
            }
            return jsx(FieldRow, {
              key: key,
              t: t,
              id: key,
              fieldName: key,
              labelKey: "field." + key,
              hintKey: "hint." + key,
              value: fv.stagedBool,
              writable: shell.writable,
              toggle: props.toggle
            });
          })
        ] })),
        jsxs("div", { className: "PInj_footer", children: [
          shell.dirty ? jsx("span", { className: "PInj_pending", children: t("unsaved") }) : null,
          shell.failed ? jsx("p", { className: "PInj_failed", children: t("saveFailed") }) : null,
          jsx("button", { className: "PInj_discard", type: "button", disabled: (!shell.dirty && !shell.failed) || shell.saving, onClick: () => props.discard(), children: t("discard") }),
          jsx("button", { className: "PInj_save", type: "button", disabled: blocked, onClick: () => props.save(), children: shell.saving ? t("saving") : t("save") })
        ] })
      ] });
      return jsxs("div", { className: "PInj_page", children: [
        body
      ] });
    }

    const css = ".PInj_page{flex-direction:column;display:flex;gap:2px;padding:0}.PInj_pending{white-space:nowrap;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-radius:999px;flex:none;padding:1px 8px;font-size:11px;font-weight:500;line-height:17px}.PInj_body{margin:0;padding-bottom:8px}.PInj_prompts{display:flex;flex-direction:column;gap:0}.PInj_readOnly{color:var(--dsw-alias-label-tertiary);margin:12px 0 0;font-size:12px;line-height:1.5}.PInj_footer{border-top:1px solid var(--dsw-alias-border-l2);justify-content:flex-end;align-items:center;gap:8px;padding:12px 0 4px;display:flex}.PInj_footer .PInj_pending{margin-right:auto}.PInj_failed{min-width:0;color:var(--dsw-alias-label-error);text-overflow:ellipsis;white-space:nowrap;flex:1;margin:0;font-size:12px;line-height:1.5;overflow:hidden}.PInj_discard,.PInj_save,.PInj_add,.PInj_del{appearance:none;font:inherit;cursor:pointer;border:1px solid #0000;border-radius:8px;padding:5px 14px;font-size:13px;line-height:1.5}.PInj_discard{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);background:0 0}.PInj_discard:hover:not(:disabled){color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-dimmed)}.PInj_save{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}.PInj_discard:disabled,.PInj_save:disabled{opacity:.4;cursor:default}.PInj_add{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l2);margin-top:8px}.PInj_del{background:0 0;color:var(--dsw-alias-label-error);border-color:var(--dsw-alias-border-l2);padding:0;font-size:14px;line-height:1;width:26px;height:26px;flex:none;display:inline-flex;align-items:center;justify-content:center}.PInj_del:hover:not(:disabled){background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-alias-label-error)}.PInj_field{flex-direction:column;gap:6px;padding:12px 0;display:flex}.PInj_field+.PInj_field{border-top:1px solid var(--dsw-alias-border-l2)}.PInj_group{padding-top:8px}.PInj_groupTitle{color:var(--dsw-alias-label-secondary);margin:12px 0 4px;font-size:16px;font-weight:600;line-height:1.5;}.PInj_head{align-items:center;gap:8px;display:flex}.PInj_label{min-width:0;color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:500;line-height:1.5}.PInj_labelText{display:inline}.PInj_labelHint{color:var(--dsw-alias-label-tertiary);font-weight:400}.PInj_input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);height:34px;font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:0 12px;font-size:13px;line-height:1.5;width:100%;box-sizing:border-box}.PInj_input:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.PInj_text{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:8px 12px;font-size:13px;line-height:1.5;width:100%;box-sizing:border-box;resize:vertical}.PInj_text:focus-visible{border-color:var(--dsw-alias-brand-primary);outline:none}.PInj_row{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;gap:8px;padding:10px 12px;flex-direction:column;display:flex;margin-bottom:8px}.PInj_rowHead{align-items:center;gap:10px;display:flex}.PInj_rowHead .PInj_input{flex:1;min-width:0}.PInj_rowToggle{white-space:nowrap;color:var(--dsw-alias-label-secondary);align-items:center;gap:6px;display:inline-flex;font-size:12px}.PInj_check{width:16px;height:16px;accent-color:var(--dsw-alias-brand-primary);cursor:pointer}.PInj_groupTitle+.PInj_row{border-top:1px solid var(--dsw-alias-border-l2)}@media (prefers-reduced-motion:reduce){.PInj_discard,.PInj_save{transition:none}}";
    const tagId = "dsh-pormpt-global/settings.css";
    if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-pormpt-global";
      tag.dataset.pluginCss = tagId;
      tag.textContent = css;
      document.head.appendChild(tag);
    }

    const injectServices = ["slots", "locale", "configForms"];

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-pormpt-global: dictionaries");
      const form = new PIForm(ctx.configForms.get(NS));
      const t = ctx.locale.bind(NS);
      ctx.effect(() => form.scope.subscribe(() => form.publish()), "dsh-pormpt-global: scope-follow");
      ctx.effect(
        () => ctx.configForms.whileServed([NS], () => ctx.slots.inject("plugins.item",
          () => ctx.slots.register({
            name: "plugins.item",
            id: NS,
            order: 30,
            label: () => t("card.title"),
            locale: NS,
            inject: () => ({
              hooks: { promptInjector: form.store },
              ...form.actions()
            })
          }, PromptInjectorCard)
        )),
        "dsh-pormpt-global: card registration"
      );
    }

    exports.apply = apply;
    exports.inject = injectServices;
    return module.exports;
  }
});