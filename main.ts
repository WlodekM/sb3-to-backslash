import { jsonBlock, Project, blockBlock } from "./jsontypes.ts";
import definitions, { Input } from "./blocks.ts";
import decompress from "decompress";
await decompress('TestProject2.sb3', 'TestProject', {})
const projectJson: Project = JSON.parse(Deno.readTextFileSync('TestProject/project.json'));

type definition = [Input[], string] | [Input[], 'branch', string[]]

function indent(level: number, code: string): string {
	const indentation = '\t'.repeat(level);
	return indentation + code.split('\n').join('\n'+indentation)
}

function stringifyInputs(block: blockBlock, definition: definition, blockse: Record<string, jsonBlock>): string {
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
			result.push(getReporterBlock(iBlock, definitions[iBlock.opcode], blockse, 0));
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

function getBranchBlock(block: blockBlock, definition: [Input[], "branch", string[]], blockse: Record<string, jsonBlock>, level: number): string {
	const head = getReporterBlock(block, definition, blockse, level, true);
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
		branches.push(getReporterBlock(blockse[a] as blockBlock, definitions[(blockse[a] as blockBlock).opcode], blockse, 1))
	}
	return indent(level, `${head} ${branches.map(c => `{\n${c}\n}`).join(' ')}`)
}

function getReporterBlock(block: blockBlock, definition: definition, blockse: Record<string, jsonBlock>, level: number, ignoreBranch: boolean = false): string {
	console.log(`reporterBlock`, block.opcode, level)
	if (!definition) {
		console.error(`undefined definition for ${block.opcode}`)
		return doNext(`/* undefined definition for ${block.opcode} */`)
	}
	if (definition[1] == 'branch' && !ignoreBranch) {
		return doNext(getBranchBlock(block, definition as [Input[], "branch", string[]], blockse, level))
	}
	function doNext(code: string) {
		if (!block.next)
			return code;
		return indent(level, `${code}\n${getReporterBlock(blockse[block.next] as blockBlock, definitions[(blockse[block.next] as blockBlock).opcode], blockse, 0)}`)
	}
	return doNext(`${block.opcode}(${stringifyInputs(block, definition, blockse)})`)
}

function getHatBlock(block: blockBlock, definition: definition, blockse: Record<string, jsonBlock>, level: number = 0): string {
	// console.log(`hatBlock ${block.opcode}`)
	return `
${block.opcode}(${stringifyInputs(block, definition, blockse)}) {
${block.next ? getReporterBlock(blockse[block.next] as blockBlock, definitions[(blockse[block.next] as blockBlock).opcode], blockse, level + 1) : ''}
}`
}

for (const target of projectJson.targets) {
	let code = '#include <"blocks/js" "base.js">';
	const topLevelBlocks = Object.entries(target.blocks ?? {})
		.filter(([id, block]: [string, any]) => block.topLevel);
	for (const [id, block] of topLevelBlocks) {
		if (Array.isArray(block))
			continue;
		const definition = definitions[block.opcode];
		if (!definition) {
			console.error(`undefined definition for ${block.opcode}`)
			code += `/* undefined definition for ${block.opcode} */`
			continue;
		}
		if (definition[1] == 'hat') {
			code += getHatBlock(block as jsonBlock as blockBlock, definition, target.blocks as Record<string, jsonBlock>)
		}
	}
	Deno.writeTextFileSync(`out/${target.name}.bsl`, code)
}
