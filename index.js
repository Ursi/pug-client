const pug = require(`pug`);

function ii(literals, ...args) {
	let str = '';
	for (var i = 0; i < args.length; i++) {
		let literal = literals[i].match(/(?<rest>.*?)(?<tabs>\t*)$/s).groups;
		str += literal.rest;
		str += String(args[i]).split('\n').map(line => literal.tabs + line).join('\n');
	}

	str += literals[i];
	function leadingTabs(str) {
		return str.match(/^\t*/)[0].length;
	}

	let
		lines = str.split('\n'),
		addedIndent = Number(lines[0][0]) || 0,
		baseIndent = leadingTabs(lines[1]);

	return lines.slice(1, -1)
		.map(line => {
			let tabNum = Math.max(leadingTabs(line) - baseIndent + addedIndent, 0);
			return '\t'.repeat(tabNum) + line.replace(/^\t*/, '');
		}).join('\n');
}

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

	let bigPug = `case ${compileClientOptions.self ? `self.` : ``}__pug_template_name\n`;
	for (let pugObj of pugs) {
		bigPug += ii`1
			when '${pugObj.name}'
				${pugObj.pug}\n
		`;
	}

	const pwd = process.cwd();
	process.chdir(dir);
		const pugFunction = pug.compileClient(bigPug, compileClientOptions);
	process.chdir(pwd);
	return ii`
		${module === true ? `export default ` : ``}function ${name}(name, locals, string = false) {
			${pugFunction}

			const __html = template(Object.assign({__pug_template_name: name}, locals));
			if (string) {
				return __html;
			} else {
				const templateElem = document.createElement('template');
				templateElem.innerHTML = __html;
				return templateElem.content;
			}
		}
	`;
}
