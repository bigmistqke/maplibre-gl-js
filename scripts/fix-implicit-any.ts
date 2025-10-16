#!/usr/bin/env tsx
/**
 * Automatically fix TS7005/TS7006 implicit any errors by inferring types
 * from the TypeScript compiler.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import {execSync} from 'child_process';

interface ImplicitAnyError {
    file: string;
    line: number;
    column: number;
    code: number;
    message: string;
}

// Parse tsc output to find implicit any errors
function parseTypeCheckErrors(): ImplicitAnyError[] {
    let output: string;
    try {
        output = execSync('pnpm typecheck 2>&1', {encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024});
    } catch (error: any) {
        // typecheck exits with error code when there are errors, but we still get stdout
        output = error.stdout || '';
    }

    const errors: ImplicitAnyError[] = [];
    const lines = output.split('\n');

    for (const line of lines) {
        // Match: src/file.ts(10,5): error TS7006: Parameter 'x' implicitly has an 'any' type.
        const match = line.match(/^(.+)\((\d+),(\d+)\): error (TS700[56]): (.+)$/);
        if (match) {
            errors.push({
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
                code: parseInt(match[4].substring(2)),
                message: match[5]
            });
        }
    }

    return errors;
}

// Create a TypeScript program to analyze files
function createProgram(files: string[]): ts.Program {
    const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
    if (!configPath) {
        throw new Error('Could not find tsconfig.json');
    }

    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    const parsedConfig = ts.parseJsonConfigFileContent(
        configFile.config,
        ts.sys,
        path.dirname(configPath)
    );

    return ts.createProgram(files, parsedConfig.options);
}

// Get the inferred type for a node
function getInferredType(node: ts.Node, typeChecker: ts.TypeChecker): string | null {
    try {
        const type = typeChecker.getTypeAtLocation(node);
        const typeString = typeChecker.typeToString(type, node, ts.TypeFormatFlags.NoTruncation);

        // Don't use 'any' as inferred type
        if (typeString === 'any') return null;

        return typeString;
    } catch (e) {
        return null;
    }
}

// Find the node at a specific position
function findNodeAtPosition(sourceFile: ts.SourceFile, line: number, column: number): ts.Node | null {
    const position = sourceFile.getPositionOfLineAndCharacter(line - 1, column - 1);

    function find(node: ts.Node): ts.Node | null {
        if (node.pos <= position && position < node.end) {
            return ts.forEachChild(node, find) || node;
        }
        return null;
    }

    return find(sourceFile);
}

// Fix implicit any in a single file
function fixFile(filePath: string, errors: ImplicitAnyError[], program: ts.Program): boolean {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
        console.log(`  Could not load source file: ${filePath}`);
        return false;
    }

    const typeChecker = program.getTypeChecker();
    const fixes: Array<{pos: number, end: number, replacement: string}> = [];

    for (const error of errors) {
        const node = findNodeAtPosition(sourceFile, error.line, error.column);
        if (!node) continue;

        let fixApplied = false;

        // TS7006: Parameter 'x' implicitly has an 'any' type
        if (error.code === 7006 && ts.isParameter(node)) {
            const inferredType = getInferredType(node, typeChecker);
            if (inferredType && inferredType !== 'any') {
                const name = node.name.getText(sourceFile);
                const replacement = `${name}: ${inferredType}`;
                fixes.push({
                    pos: node.name.pos,
                    end: node.name.end,
                    replacement
                });
                fixApplied = true;
                console.log(`  ${error.line}:${error.column} - Added type to parameter: ${replacement}`);
            }
        }

        // TS7005: Variable 'x' implicitly has an 'any' type
        if (error.code === 7005 && ts.isVariableDeclaration(node)) {
            const inferredType = getInferredType(node, typeChecker);
            if (inferredType && inferredType !== 'any') {
                const name = node.name.getText(sourceFile);
                const replacement = `${name}: ${inferredType}`;
                fixes.push({
                    pos: node.name.pos,
                    end: node.name.end,
                    replacement
                });
                fixApplied = true;
                console.log(`  ${error.line}:${error.column} - Added type to variable: ${replacement}`);
            }
        }

        if (!fixApplied) {
            console.log(`  ${error.line}:${error.column} - Could not infer type`);
        }
    }

    if (fixes.length === 0) {
        return false;
    }

    // Apply fixes from end to start to maintain positions
    fixes.sort((a, b) => b.pos - a.pos);

    let text = sourceFile.getFullText();
    for (const fix of fixes) {
        text = text.substring(0, fix.pos) + fix.replacement + text.substring(fix.end);
    }

    fs.writeFileSync(filePath, text, 'utf-8');
    return true;
}

// Main execution
function main() {
    console.log('Parsing TypeScript errors...');
    const allErrors = parseTypeCheckErrors();

    const implicitAnyErrors = allErrors.filter(e => e.code === 7005 || e.code === 7006);

    // Only fix source files, skip test files for now
    const sourceErrors = implicitAnyErrors.filter(e =>
        e.file.startsWith('src/') && !e.file.includes('.test.ts')
    );

    console.log(`Found ${implicitAnyErrors.length} implicit any errors`);
    console.log(`  ${sourceErrors.length} in source files (fixing these)`);
    console.log(`  ${implicitAnyErrors.length - sourceErrors.length} in test files (skipping)`);

    if (sourceErrors.length === 0) {
        console.log('No source file errors to fix!');
        return;
    }

    // Group errors by file
    const errorsByFile = new Map<string, ImplicitAnyError[]>();
    for (const error of sourceErrors) {
        if (!errorsByFile.has(error.file)) {
            errorsByFile.set(error.file, []);
        }
        errorsByFile.get(error.file)!.push(error);
    }

    console.log(`\nProcessing ${errorsByFile.size} files...\n`);

    // Create TypeScript program with all files
    const files = Array.from(errorsByFile.keys());
    const program = createProgram(files);

    let filesFixed = 0;
    let errorsFixed = 0;

    for (const [file, errors] of errorsByFile) {
        console.log(`${file} (${errors.length} errors):`);
        const fixed = fixFile(file, errors, program);
        if (fixed) {
            filesFixed++;
            errorsFixed += errors.length;
        }
    }

    console.log(`\nFixed ${errorsFixed} errors in ${filesFixed} files`);
    console.log('Run "pnpm typecheck" to verify fixes');
}

main();
