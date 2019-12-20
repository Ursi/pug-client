const
	pug = require(`pug`),
	undIds = require(`undeclared-identifiers`);

module.exports = function(pugs, dir, options = {}) {
	const
		{
			name = `pug`,
			module = false,
			attribute = true,
		} = options,
		compileClientOptions = Object.assign({
			filename: `Pug`,
			doctype: `html`,
		}, options.options);

	let
		templatesString = `const templates = {`,
		scriptsString = `const scripts = {`;

	const pwd = process.cwd();
	process.chdir(dir);
		for (let pugObj of pugs) {
			const scriptMatch = pugObj.pug.match(/(\r|\n)+--|^--/);
			if (scriptMatch) {
				pugObj.purePug = pugObj.pug.slice(0, scriptMatch.index);
				let script = pugObj.pug.slice(scriptMatch.index + scriptMatch[0].length);
				for (let undId of undIds(script))
					script = `
						if (!('${undId}' in locals || '${undId}' in globalThis))
							throw "'${undId}' has not been passed into '${pugObj.name}'"
						let ${undId} = '${undId}' in locals ? locals.${undId} : globalThis.${undId};
					` + script;

				pugObj.script = `async function(locals = {}) {${script}}`
			} else pugObj.purePug = pugObj.pug;

			templatesString += `
				'${pugObj.name}': function(locals) {
					${pug.compileClient(pugObj.purePug, compileClientOptions)}
					return template(locals);
				},
			`;

			if (scriptMatch) scriptsString += `'${pugObj.name}': ${pugObj.script},`
		}
	process.chdir(pwd);
	return `
		let ${name};
		(()=>{
			${templatesString}
			};

			${scriptsString}
			};

			class MiniDom {
				constructor(frag) {
					Object.assign(this, {
						children: [...frag.children],
						childNodes: [...frag.childNodes],
						id: {},
						class: {},
						firstClass: {},
						tag: {},
						firstTag: {},
					})

					const parse = function f(elemList) {
						function datasetify(str) {
							if (
								str.match(/[^-\\w]/) ||
								str !== str.toLowerCase() ||
								str.match(/^-?\\d/)
							) return str;

							const re = /-(\\w)/g;
							let match;
							while (match = re.exec(str)) {
								str = str.slice(0, match.index) +
									match[1].toUpperCase() +
									str.slice(re.lastIndex);

								re.lastIndex--;
							}

							return str;
						};

						for (let elem of elemList) {
							const
								id = datasetify(elem.id),
								{classList} = elem;

							if (id) this.id[id] = elem;
							if (classList.length)
								for (let className of classList) {
									className = datasetify(className);
									if (!(className in this.firstClass)) {
										this.firstClass[className] = elem;
										this.class[className] = [elem];
									} else
										this.class[className].push(elem);

								}

							const tagName = datasetify(elem.tagName.toLowerCase());
							if (!(tagName in this.firstTag)) {
								this.firstTag[tagName] = elem;
								this.tag[tagName] = [elem];
							} else
								this.tag[tagName].push(elem);

							f.call(this, elem.children);
						}
					}

					parse.call(this, this.children);
				}

				get firstChild() {
					return this.childNodes[0];
				}

				get firstElementChild() {
					return this.children[0];
				}

				get lastChild() {
					return this.childNodes[this.childNodes.length - 1];
				}

				get lastElementChild() {
					return this.children[this.children.length - 1];
				}

				querySelector(str) {
					for (let elem of this.children) {
						if (elem.matches(str)) return elem;
						const possibleMatch = elem.querySelector(str);
						if (possibleMatch) return possibleMatch;
					}

					return null;
				}

				querySelectorAll(str) {
					const elems = [];
					for (let elem of this.children) {
						if (elem.matches(str)) elems.push(elem);
						const possibleMatches = elem.querySelectorAll(str);
						if (possibleMatches.length)
							for (let elem of possibleMatches)
								elems.push(elem);
					}

					return elems;
				}
			}

			${name} = function(name, locals, string = false) {
				if (!(name in templates)) throw \`"\${name}" is not a template\`;
				const html = templates[name](locals);
				if (string) {
					return html;
				} else {
					const template = document.createElement('template');
					template.innerHTML = html;
					const
						frag = template.content,
						miniDom = new MiniDom(frag);

					${
						attribute ?
							`
								for (let child of frag.children)
									child.dataset.template = name;
							` :
							``
					}

					if (name in scripts)
						new MutationObserver(records => {
							if (!records[0].target.children.length)
								scripts[name].call(miniDom, locals);
						}).observe(frag, {childList: true});

					return frag;
				}
			}

			customElements.define('pug-client', class extends HTMLElement {
				connectedCallback() {
					this.before(${name}(
						this.getAttribute('name'),
						JSON.parse(this.getAttribute('locals'))
					));

					this.remove();
				}
			});
		})();

		${module === true ? `export default ${name}` : ``}
	`
}
