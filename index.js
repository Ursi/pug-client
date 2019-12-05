const pug = require(`pug`);
module.exports = function(pugs, dir, options = {}) {
	const
		{
			name = `pug`,
			module = false,
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
				pugObj.script = pugObj.pug.slice(scriptMatch.index)
					.replace(/--\s*(\(.*?\))/s, `async function$1 {`) // --(...)
					.replace(/--.*/, `async function(){`) + // --
					`}`;
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

					for (let child of frag.children)
						child.dataset.template = name;

					new MutationObserver(records => {
						if (!records[0].target.children.length && name in scripts)
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
