// deno-lint-ignore-file
import { jsonBlock, Project, blockBlock, varBlock } from "./jsontypes.ts";
import definitions, { Input } from "./blocks.ts";
import decompress from "decompress";
await decompress('domestique client.sb3', 'TestProject', {})
const projectJson: Project = JSON.parse(Deno.readTextFileSync('TestProject/project.json'));

type definition = [Input[], string] | [Input[], 'branch', string[]]

enum InputTypes {
	math_number = 4,
	math_positive_number = 5,
	math_whole_number = 6,
	math_integer = 7,
	math_angle = 8,
	colour_picker = 9,
	text = 10,
	event_broadcast_menu = 11,
	data_variable = 12,
	data_listcontents = 13
}

class Cast {
	string(text: string) {
		return [InputTypes.text, text]
	}
	number(number: number) {
		return [InputTypes.math_number, number]
	}
}

let blockDefinitions = definitions;

function indent(level: number, code: string): string {
	const indentation = '\t'.repeat(level);
	return indentation + code.split('\n').join('\n' + indentation)
}

//@ts-ignore
globalThis.window = {
	addEventListener: () => {}
}

interface CustomBlock {
	name: string,
	arguments: string[]
}

class Scope {
	// proccode to name
	customBlocks: Record<string, CustomBlock> = {};
	// id to name
	vars: Record<string, string> = {};
	// id to name,
	customBlockArgs: Record<string, string> = {}
	spriteVariables: {
		[k: string]:
		| []
		| [string]
		| [string, (string | number) | boolean, ...true[]]
	} = {}
}

function fromScope(scope: Scope): Scope {
	const newScope = new Scope();
	newScope.customBlocks = Object.assign({}, scope.customBlocks)
	newScope.vars = Object.assign({}, scope.vars)
	return newScope
}

const _class = new (class { })()
type Class = typeof _class

async function importExtension(url: string) {
	// console.log('importing', url)
	const nop = () => { };
	// deno-lint-ignore no-explicit-any
	let ext: any = null;
	//@ts-ignore:
	const Scratch = globalThis.Scratch = {
		translate: (a: string) => a,
		extensions: {
			unsandboxed: true,
			register: (e: Class) => { ext = e }
		},
		vm: {
			runtime: {
				on: nop,
				targets: [],
				ioDevices: {
					userData: {}
				}
			},
			renderer: {
				on: nop,
			},
			exports: {
				RenderedTarget: class RenderedTarget {
					constructor() {}
					blocks = {}
				}
			},
			on: nop
		},
		BlockType: {
			BOOLEAN: "Boolean",
			BUTTON: "button",
			LABEL: "label",
			COMMAND: "command",
			CONDITIONAL: "conditional",
			EVENT: "event",
			HAT: "hat",
			LOOP: "loop",
			REPORTER: "reporter",
			XML: "xml"
		},
		TargetType: {
			SPRITE: "sprite",
			STAGE: "stage"
		},
		Cast,
		ArgumentType: {
			ANGLE: "angle",
			BOOLEAN: "Boolean",
			COLOR: "color",
			NUMBER: "number",
			STRING: "string",
			MATRIX: "matrix",
			NOTE: "note",
			IMAGE: "image",
			COSTUME: "costume",
			SOUND: "sound"
		}
	}
	//@ts-ignore:
	Scratch.translate.setup = nop
	try {
		await import(url);
	} catch (error) {
		console.error(`error while importing ${url}`)
		throw error
	}
	// console.log('j', ext, Object.getOwnPropertyNames(ext ?? {}))
	if (ext == null || !ext?.getInfo) throw "Extension didnt load properly";
	try {
		ext.getInfo();
	} catch (error) {
		console.error(`error while importing`, ext)
		throw error
	}
	const { blocks, id: extid } = ext.getInfo();
	// sprite.extensions.push([url, extid]);
	blockDefinitions = {
		...blockDefinitions,
		...Object.fromEntries(
			// deno-lint-ignore no-explicit-any
			blocks.map((block: any) => {
				if (typeof block !== 'object' || !block.opcode)
					return [];
				return [extid + '_' + block.opcode, [Object.entries(block.arguments ?? {}).map(a => {
					return {
						name: a[0],
						type: 1
					} as Input
				}), block.blockType == Scratch.BlockType.EVENT ? 'hat' : 'reporter']]
			})
		)
	}
}

function stringifyInputs(scope: Scope, block: blockBlock, definition: definition, blockse: Record<string, jsonBlock>): string {
	// console.log(`strInputs ${block.opcode}`)
	const result: string[] = []
	for (const input of definition[0]) {
		// console.log(input.name, block.inputs[input.name])
		if (!block.inputs[input.name])
			continue;
		const inputData = block.inputs[input.name];
		const inputInput: [number, string] | string = inputData[1];
		if (typeof inputInput == 'string') {
			const iBlock = blockse[inputInput] as jsonBlock as blockBlock;
			result.push(getReporterBlock(scope, iBlock, blockDefinitions[iBlock.opcode], blockse, 0));
			continue;
		}
		if (inputInput[0] == 4 ||
			inputInput[0] == 5 ||
			inputInput[0] == 6 ||
			inputInput[0] == 7 ||
			inputInput[0] == 8
		) {
			result.push(String(inputInput[1]))
			continue;
		}
		if (inputInput[0] == 10) {
			result.push(`"${String(inputInput[1]).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
			continue;
		}
		console.error(`INPUT TYPE ${inputInput[0]} NOT IMPLEMENTED`)
	}
	// console.log(result)
	return result.join(', ');
}

function getBranchBlock(scope: Scope, block: blockBlock, definition: [Input[], "branch", string[]], blockse: Record<string, jsonBlock>, level: number): string {
	const head = getReporterBlock(scope, block, definition, blockse, level, true, true);
	const branches: string[] = [];
	for (const branch of definition[2]) {
		const jej = block.inputs[branch];
		if (!jej) {
			branches.push('')
			continue;
		}
		const a = jej[1];
		// console.log(a)
		if (typeof a != 'string')
			continue;
		branches.push(getReporterBlock(scope, blockse[a] as blockBlock, blockDefinitions[(blockse[a] as blockBlock).opcode], blockse, 1))
	}
	return indent(level, `${head} ${branches.map(c => `{\n${c}\n}`).join(' ')}`)
}

function getReporterBlock(scope: Scope, block: blockBlock, definition: definition, blockse: Record<string, jsonBlock>, level: number, ignoreBranch: boolean = false, next = true): string {
	// console.log(`reporterBlock`, block.opcode, level)
	switch (block.opcode) {
		case 'procedures_call':
			// console.log(block.mutation?.proccode)
			if (block.mutation?.proccode == '​​log​​ %s')
				return '';
			if (!scope.customBlocks[block.mutation?.proccode ?? ''])
				console.error(`custom block of proccode "${block.mutation?.proccode ?? ''}" not found`);
			const customBlock = scope.customBlocks[block.mutation?.proccode ?? ''];
			if (!customBlock)
				return doNext(`/* unknown custom block ${block.mutation?.proccode} */`)
			const definition: definition = [
				customBlock.arguments.map<Input>((a) => {
					return {
						name: a,
						type: 1
					}
				}),
				'reporter'
			]
			return doNext(`${customBlock.name}(${stringifyInputs(scope, block, definition, blockse)})`)
		
		case 'argument_reporter_boolean':
		case 'argument_reporter_string_number':
			return doNext(`${block.fields.VALUE[0]}`);
		
		case 'data_setvariableto':
			const definedAlready = scope.vars[block.fields.VARIABLE[0]]
			const pre = definedAlready ? '' : `${scope.spriteVariables[block.fields.VARIABLE[1]] ? '' : 'global '}var `;
			if (!definedAlready)
				scope.vars[block.fields.VARIABLE[1]] = block.fields.VARIABLE[0];
			return doNext(`${pre}${block.fields.VARIABLE[0].replaceAll(' ', '_')} = ${stringifyInputs(scope, block, [[{name: 'VALUE', type: 1}], 'reporter'], blockse)}`)
	}
	if (!definition) {
		console.error(`undefined definition for ${block.opcode}`)
		return doNext(`/* undefined definition for ${block.opcode} */`)
	}
	if (definition[1] == 'branch' && !ignoreBranch) {
		return doNext(getBranchBlock(scope, block, definition as [Input[], "branch", string[]], blockse, level))
	}
	function doNext(code: string) {
		if (!block.next || !next)
			return code;
		return indent(level, `${code}\n${getReporterBlock(scope, blockse[block.next] as blockBlock, blockDefinitions[(blockse[block.next] as blockBlock).opcode], blockse, 0)}`)
	}
	return doNext(`${block.opcode}(${stringifyInputs(scope, block, definition, blockse)})`)
}

function getHatBlock(scope: Scope, block: blockBlock, definition: definition, blockse: Record<string, jsonBlock>, level: number = 0): string {
	// console.log(`hatBlock ${block.opcode}`)
	return `
${block.opcode}(${stringifyInputs(scope, block, definition, blockse)}) {
${block.next ? getReporterBlock(scope, blockse[block.next] as blockBlock, blockDefinitions[(blockse[block.next] as blockBlock).opcode], blockse, level + 1) : ''}
}`
}

function getFnDecl(scope: Scope, block: blockBlock, blockse: Record<string, jsonBlock>, level: number = 0): string {
	if (!block.inputs.custom_block || typeof block.inputs.custom_block[1] != 'string')
		throw 'what the shit where the fuck did you get this sb3 from';
	const prototype: blockBlock = blockse[block.inputs.custom_block[1]] as blockBlock;
	if (!prototype.mutation || !prototype.mutation.proccode || typeof prototype.mutation.proccode != 'string' || !prototype.mutation.argumentnames)
		throw 'what the shit where the fuck did you get this sb3 from'
	let name = (prototype.mutation.proccode.match(/^(.*?) %/) ?? 'UNDEFINED')[1].replaceAll(' ', '_');
	while (Object.values(scope.customBlocks).some(b => b.name == name))
		name += '_';
	scope.customBlocks[prototype.mutation.proccode] = {
		name,
		arguments: JSON.parse(prototype.mutation.argumentids ?? '[]')
	}
	const newScope = fromScope(scope);
	const names = JSON.parse(prototype.mutation.argumentnames ?? '[]')
	newScope.customBlockArgs = Object.fromEntries(
		JSON.parse(prototype.mutation.argumentids ?? '[]')
		.map((id:string, i:number) => [id, names[i]])
	)
	return `
${JSON.parse(String(prototype.mutation.warp ?? 'false')) ? 'warp ' : ''}fn ${name}(${JSON.parse(prototype.mutation.argumentnames).join(', ')}) {
${block.next ? getReporterBlock(scope, blockse[block.next] as blockBlock, blockDefinitions[(blockse[block.next] as blockBlock).opcode], blockse, level + 1) : ''}
}`
}

for (const extId in projectJson.extensionURLs) {
	const url = projectJson.extensionURLs[extId];
	await importExtension(String(url));
}

for (const target of projectJson.targets) {
	const scope = new Scope()
	scope.spriteVariables = target.variables
	let code = '#include <"blocks/js" "base.js">';
	const topLevelBlocks = Object.entries(target.blocks as Record<string, jsonBlock> ?? {})
		.filter(([_, block]: [string, jsonBlock]) => !Array.isArray(block as varBlock) && (block as blockBlock).topLevel)
		.sort(([_, a], [__, b]) => 
			(!Array.isArray(b as varBlock) && (b as blockBlock).opcode == 'procedures_definition' ? 10 : 0) -
			(!Array.isArray(a as varBlock) && (a as blockBlock).opcode == 'procedures_definition' ? 10 : 0)
		);
	for (const extId in projectJson.extensionURLs) {
		const url = projectJson.extensionURLs[extId];
		if (typeof url != 'string')
			continue;
		// console.log(url)
		// code += `\n#include <"extension", "${url.replaceAll('\\','\\\\').replaceAll('"','\\"')}">`
	}
	for (const [_id, block] of topLevelBlocks) {
		if (Array.isArray(block))
			continue;
		if (block.opcode == 'argument_reporter_boolean' ||
			block.opcode == 'argument_reporter_string_number')
			continue;
		if (block.opcode == 'procedures_definition') {
			code += getFnDecl(scope, block as jsonBlock as blockBlock, target.blocks as Record<string, jsonBlock>)
			continue;
		}
		const definition = blockDefinitions[block.opcode];
		if (!definition && block.opcode != 'procedures_call') {
			console.error(`undefined definition for ${block.opcode}`)
			code += `/* undefined definition for ${block.opcode} */`
			continue;
		}
		if (definition && definition[1] == 'hat') {
			code += getHatBlock(scope, block as jsonBlock as blockBlock, definition, target.blocks as Record<string, jsonBlock>)
		}
	}
	Deno.writeTextFileSync(`out/${target.name}.bsl`, code)
}
