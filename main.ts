// deno-lint-ignore-file
import { jsonBlock, Project, blockBlock, varBlock } from "./jsontypes.ts";
import definitions, { Input } from "./blocks.ts";
import decompress from "decompress";
import fs from "node:fs"
import { stringify } from "jsr:@std/yaml";
await decompress('TeamCrateBoxTWO.pmp', 'TestProject', {})
const projectJson: Project = JSON.parse(Deno.readTextFileSync('TestProject/project.json'));

const vmDir = 'pm-vm'

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
	stage: boolean = false
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
	globalThis.MutationObserver = class {
		observe() {}
	}
	//@ts-ignore:
	const Scratch = globalThis.Scratch = {
		translate: (a: string) => a,
		fetch,
		extensions: {
			unsandboxed: true,
			register: (e: Class) => { ext = e }
		},
		vm: {
			runtime: {
				on: nop,
				targets: [],
				ioDevices: {
					userData: {},
					mouse: {
						bindToCamera: nop
					}
				},
				frameLoop: {
					framerate: 0
				},
				exports: {},
				setRuntimeOptions: nop
			},
			renderer: {
				on: nop,
				exports: {
					Skin: class {}
				},
				canvas: {},
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
		renderer: {
			canvas: {},
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

async function importDefaultExtension(id: string) {
	const nop = () => { };
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
				frameLoop: {
					framerate: 0
				},
				ioDevices: {
					userData: {},
					mouse: {
						bindToCamera: nop
					}
				},
				registerCompiledExtensionBlocks: nop,
				setRuntimeOptions: nop
			}
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
	globalThis.vm = Scratch.vm;
	//@ts-ignore:
	globalThis.module = {}
	const _ArgumentType = await import(`./${vmDir}/src/extension-support/argument-type.js`);
	//@ts-ignore
	const ArgumentType = _ArgumentType ?? module.exports;
	const _BlockType = await import(`./${vmDir}/src/extension-support/block-type.js`);
	//@ts-ignore
	const BlockType = _BlockType ?? module.exports;
	const _TargetType = await import(`./${vmDir}/src/extension-support/target-type.js`);
	//@ts-ignore
	const TargetType = _TargetType ?? module.exports;
	//@ts-ignore:
	Scratch.translate.setup = nop
	//@ts-ignore:
	globalThis.require = (moduleName) => {
		if (moduleName == 'format-message')
			return (message: {default: string}) => message.default;
		switch (moduleName) {
			case '../../extension-support/argument-type':
				return ArgumentType;
			case '../../extension-support/block-type':
				return BlockType
			case '../../extension-support/target-type':
				return TargetType;
			case '../../extension-support/tw-l10n':
				return ()=>Scratch.translate;
		}
		return class {}
	}
	const dir = id == 'lmsTempVars2' ? 'lily_tempVars2' : id;
	// console.log(dir, dir.match(/^jg[A-Z]/), dir.replace(/^jg([A-Z])/,(_,l)=>'jg_'+l.toLowerCase()),
	// 	dir.replace(/^jg([A-Z])/,(_,l)=>'jg_'+l))
	let path = fs.existsSync(`./${vmDir}/src/extensions/${dir}/index.js`) ?
		`./${vmDir}/src/extensions/${dir}/index.js` :
		fs.existsSync(`./${vmDir}/src/extensions/scratch3_${dir}/index.js`) ?
		`./${vmDir}/src/extensions/scratch3_${dir}/index.js` :
		dir.match(/^jw[A-Z]/) && 
		fs.existsSync(`./${vmDir}/src/extensions/${
			dir.replace(/^jw([A-Z])/,(_,l)=>'jw_'+l.toLowerCase())}/index.js`) ?
		`./${vmDir}/src/extensions/${
			dir.replace(/^jw([A-Z])/,(_,l)=>'jw_'+l.toLowerCase())
		}/index.js` :
		dir.match(/^pm[A-Z]/) && 
		fs.existsSync(`./${vmDir}/src/extensions/${
			dir.replace(/^pm([A-Z])/,(_,l)=>'pm_'+l.toLowerCase())}/index.js`) ?
		`./${vmDir}/src/extensions/${
			dir.replace(/^pm([A-Z])/,(_,l)=>'pm_'+l.toLowerCase())
		}/index.js` :
		dir.match(/^jg[A-Z]/) && 
		fs.existsSync(`./${vmDir}/src/extensions/${
			dir.replace(/^jg([A-Z])/,(_,l)=>'jg_'+l).toLowerCase()}/index.js`) ?
		`./${vmDir}/src/extensions/${
			dir.replace(/^jg([A-Z])/,(_,l)=>'jg_'+l).toLowerCase()
		}/index.js` :
		dir.match(/^jg[A-Z]/) && 
		fs.existsSync(`./${vmDir}/src/extensions/${
			dir.replace(/^jg([A-Z])/,(_,l)=>'jg_'+l.toLowerCase())}/index.js`) ?
		`./${vmDir}/src/extensions/${
			dir.replace(/^jg([A-Z])/,(_,l)=>'jg_'+l.toLowerCase())
		}/index.js` :
		`./${vmDir}/src/extensions/${dir}/index.js`;
	try {
		await import(path);
	} catch (error) {
		console.error('couldnt load', path);
		throw error
	}
	//@ts-ignore
	ext = new globalThis.module.exports(Scratch.vm.runtime);
	
	if (ext == null || !ext?.getInfo) throw "Extension didnt load properly";
	const { blocks, id: extid } = ext.getInfo();

	blockDefinitions = {
		...blockDefinitions,
		...Object.fromEntries(
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

function sanitizeVar(varname: string) {
	return varname.replaceAll(' ', '_').replaceAll('(', '_').replaceAll(')', '_').replaceAll('\n', '_').replaceAll('"', '_').replaceAll('.', '_')
}

function stringifyInputs(scope: Scope, block: blockBlock, definition: definition, blockse: Record<string, jsonBlock>): string {
	// console.log(`strInputs ${block.opcode}`)
	const result: string[] = []
	for (const input of definition[0]) {
		// console.log(input.name, block.inputs[input.name])
		if (!block.inputs[input.name] && !block.fields[input.name])
			continue;
		const inputData = block.inputs[input.name];
		if (!inputData && block.fields[input.name]) {
			result.push(`"${String(block.fields[input.name][0]).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
			continue;
		}
		const inputInput: [number, string] | string = inputData[1];
		if (typeof inputInput == 'string') {
			const iBlock = blockse[inputInput] as jsonBlock as blockBlock;
			result.push(getReporterBlock(scope, iBlock, blockDefinitions[iBlock.opcode], blockse, 0));
			continue;
		}
		if (inputInput[0] == InputTypes.math_number ||
			inputInput[0] == InputTypes.math_positive_number ||
			inputInput[0] == InputTypes.math_whole_number ||
			inputInput[0] == InputTypes.math_integer ||
			inputInput[0] == InputTypes.math_angle
		) {
			result.push(String(inputInput[1]))
			continue;
		}
		if (inputInput[0] == InputTypes.text ||
			inputInput[0] == InputTypes.colour_picker) {
			result.push(`"${String(inputInput[1]).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
			continue;
		}
		if (inputInput[0] == InputTypes.data_variable) {
			result.push(`${sanitizeVar(inputInput[1])}`)
			continue;
		}
		if (inputInput[0] == InputTypes.event_broadcast_menu) {
			result.push(`"${inputInput[1].replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
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
		case 'operator_notequal':
			return doNext(`${stringifyInputs(scope, block, [
				[
					{name:'OPERAND1',type:1},
					{name:'OPERAND2',type:1}
				],'reporter'
			], blockse).replace(', ', ' !=')}`)
		case 'procedures_return':
			return doNext(`return ${stringifyInputs(scope, block, [[{name:'return',type:1}],'reporter'], blockse)}`)
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
			const definedAlready = scope.vars[block.fields.VARIABLE[1]] !== undefined;
			const pre = definedAlready ? '' : `${!scope.stage ? '' : 'global '}var `;
			if (!definedAlready)
				scope.vars[block.fields.VARIABLE[1]] = block.fields.VARIABLE[0];
			if (block.fields.VARIABLE[0] === undefined){
				console.log(block.fields, block)
			}
			return doNext(`${pre}${sanitizeVar(block.fields.VARIABLE[0])} = ${stringifyInputs(scope, block, [[{name: 'VALUE', type: 1}], 'reporter'], blockse)}`)
	}
	if (block.opcode.includes("_menu_"))
		return doNext(`"${(Object.values(block.fields) as [string, ...any[]][])[0][0].replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`)
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

function preprocessFnDecl(scope: Scope, block: blockBlock, blockse: Record<string, jsonBlock>): Scope {
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
	// console.log('!!', prototype.mutation.proccode, scope.customBlocks[prototype.mutation.proccode])
	return scope;
}

function getFnDecl(scope: Scope, block: blockBlock, blockse: Record<string, jsonBlock>, level: number = 0): string {
	if (!block.inputs.custom_block || typeof block.inputs.custom_block[1] != 'string')
		throw 'what the shit where the fuck did you get this sb3 from';
	const prototype: blockBlock = blockse[block.inputs.custom_block[1]] as blockBlock;
	if (!prototype.mutation || !prototype.mutation.proccode || typeof prototype.mutation.proccode != 'string' || !prototype.mutation.argumentnames)
		throw 'what the shit where the fuck did you get this sb3 from'
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

for (const extId of projectJson.extensions ?? []) {
	if ((projectJson.extensionURLs ?? {})[extId])
		continue;
	await importDefaultExtension(extId)
}

fs.rmSync('out', {
	recursive: true,
})

fs.mkdirSync('out')
fs.mkdirSync('out/src')
fs.mkdirSync('out/assets')

type TSound = any // TODO: finish this
type TCostume = {
    format: 'svg' | string
    path: string
}
type TSprite = {
    stage?: boolean
    name: string
    costumes: Record<string, TCostume>
    sounds: Record<string, TSound>
    code: null | string
}
type TProject = {
    sprites: Record<string, TSprite>
}

const projectConfig: TProject = {
	sprites: {}
};

let i = 0
let scope = new Scope()
for (const target of projectJson.targets) {
	try {
		Deno.writeTextFileSync(`targets/${i}.json`, JSON.stringify(target.blocks))
		scope.stage = target.isStage
		scope.spriteVariables = target.variables
		let code = `#include <"blocks/js" "base.js">`;
		console.debug(scope.stage)
		for (const id of Object.keys(target.variables)) {
			const variable = target.variables[id];
			// console.debug('making fake block for initializaiton of variable', id, variable)
			const value = variable[1] ?? 0;
			code += '\n'+getReporterBlock(
				scope,
				{
					fields: {
						VARIABLE: [variable[0], id]
					},
					inputs: {
						VALUE: [1,[
							typeof value == 'number' ?
								InputTypes.math_number :
								InputTypes.text,
							value
						]]
					},
					next: null,
					topLevel: true,
					opcode: 'data_setvariableto',
					parent: null,
					shadow: false,
				},
				blockDefinitions['data_setvariableto'],
				target.blocks as Record<string, jsonBlock>,
				0
			)
		}
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
			if (block.opcode != 'procedures_definition' &&
				block.opcode !== 'procedures_definition_return') //<--
				continue;
			// console.log('uh yea')
			scope = preprocessFnDecl(scope, block as jsonBlock as blockBlock, target.blocks as Record<string, jsonBlock>)
		}
		// console.log('oh were doingthis now ok')
		for (const [_id, block] of topLevelBlocks) {
			if (Array.isArray(block))
				continue;
			if (block.opcode == 'argument_reporter_boolean' ||
				block.opcode == 'argument_reporter_string_number')
				continue;
			if (block.opcode == 'procedures_definition' ||
				block.opcode == 'procedures_definition_return') {
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
		Deno.writeTextFileSync(`out/src/${target.name.replaceAll('/','_')}.bsl`, code)
		projectConfig.sprites[i.toString()] = {
			code: `src/${target.name.replaceAll('/','_')}.bsl`,
			costumes: Object.fromEntries(
				Object.entries(target.costumes)
					.map<[string, TCostume]>( ([n, c]) => {
						fs.cpSync(
							`./TestProject/${c.assetId}.${c.dataFormat}`,
							`out/assets/${target.name.replaceAll('/','_')}/costumes/${c.name.replaceAll('/','_')}.${c.dataFormat}`
						)
						return [c.name, {
							format: c.dataFormat,
							path: `assets/${target.name.replaceAll('/','_')}/costumes/${c.name.replaceAll('/','_')}.${c.dataFormat}`
						}]
					})
			),
			name: target.name,
			sounds: {}, //TODO - finish this when i finish sounds in backslash
			stage: target.isStage
		}
	} catch (error) {
		console.error('error while processing target', i)
		throw error
	}
	i++
}

Deno.writeTextFileSync('out/project.prj.yaml', stringify(projectConfig))
