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

	let funcStr = `
			${module === true ? `export default ` : ``}function ${name}(name, locals, string = false) {
				const templates = {
		`;

	const pwd = process.cwd();
	process.chdir(dir);
		for (let pugObj of pugs) {
			funcStr += `
				'${pugObj.name}': function(...args) {
					${pug.compileClient(pugObj.pug, compileClientOptions)}
					return template(...args);
				},
			`;
		}
	process.chdir(pwd);
	return funcStr + `
		};

		const html = templates[name](locals);
		if (string) {
			return html;
		} else {
			const templateElem = document.createElement('template');
			templateElem.innerHTML = html;
			return templateElem.content;
		}
	}
	`
}
