/**
 * Extract Algebra - extracts structured metadata from AST
 *
 * Demonstrates:
 * - Non-numeric algebra (complex data structures)
 * - Flattening (collecting results from children)
 * - Selective extraction (ignore irrelevant nodes)
 */

import type { CodeAlg } from '../catamorphism.js';
import { flatten, monoidAlg } from '../catamorphism.js';

/**
 * Metadata for a class
 */
export type ClassMeta = {
    type: 'class';
    name: string;
    extends: string[];
    implements: string[];
    methods: string[];
    properties: string[];
    typeParams: string[];
};

/**
 * Metadata for an interface
 */
export type InterfaceMeta = {
    type: 'interface';
    name: string;
    extends: string[];
    methods: string[];
    properties: string[];
    typeParams: string[];
};

/**
 * Metadata for a function
 */
export type FunctionMeta = {
    type: 'function';
    name: string | null;
    params: number;
    hasBody: boolean;
};

/**
 * Import/export metadata
 */
export type ImportMeta = {
    type: 'import';
    from: string;
    named: string[];
    default: string | null;
};

export type ExportMeta = {
    type: 'export';
    to: string | null;
    named: string[];
};

/**
 * Combined metadata
 */
export type Metadata = {
    classes: ClassMeta[];
    interfaces: InterfaceMeta[];
    functions: FunctionMeta[];
    imports: ImportMeta[];
    exports: ExportMeta[];
    typeNames: string[];  // All type references encountered
};

/**
 * Empty metadata - monoid identity
 */
const emptyMetadata: Metadata = {
    classes: [],
    interfaces: [],
    functions: [],
    imports: [],
    exports: [],
    typeNames: [],
};

/**
 * Combine metadata - monoid operation
 */
const combineMetadata = (a: Metadata, b: Metadata): Metadata => ({
    classes: [...a.classes, ...b.classes],
    interfaces: [...a.interfaces, ...b.interfaces],
    functions: [...a.functions, ...b.functions],
    imports: [...a.imports, ...b.imports],
    exports: [...a.exports, ...b.exports],
    typeNames: [...a.typeNames, ...b.typeNames],
});

/**
 * Extract algebra - builds metadata from AST
 */
export const extractAlg: CodeAlg<Metadata> = monoidAlg(
    emptyMetadata,
    combineMetadata,
    {
        ClassDecl: (name, heritage, members, typeParams, isExported, isDefault) => {
            // Combine children's metadata
            const childMeta = [...heritage, ...members, ...typeParams].reduce(
                combineMetadata,
                emptyMetadata
            );

            // Extract extends/implements from type names in heritage
            const extendsNames: string[] = [];
            const implementsNames: string[] = [];
            // Simplified: would need more context to distinguish extends vs implements
            // For now, just collect all type names from heritage
            heritage.forEach(h => {
                extendsNames.push(...h.typeNames);
            });

            // Extract method/property names from members
            const methodNames = childMeta.functions
                .map(f => f.name)
                .filter((n): n is string => n !== null);
            const propertyNames: string[] = []; // Would extract from PropertyDecl

            // Extract type parameter names
            const typeParamNames = typeParams.flatMap(tp => tp.typeNames);

            const classMeta: ClassMeta = {
                type: 'class',
                name,
                extends: extendsNames,
                implements: implementsNames,
                methods: methodNames,
                properties: propertyNames,
                typeParams: typeParamNames,
            };

            // Check if this is a default export
            const exportName = isExported ? (isDefault ? ['default'] : [name]) : [];
            const exports: ExportMeta[] = exportName.length > 0 ? [{
                type: 'export',
                to: null,
                named: exportName,
            }] : [];

            return {
                ...childMeta,
                classes: [classMeta, ...childMeta.classes],
                exports: [...exports, ...childMeta.exports],
            };
        },

        InterfaceDecl: (name, heritage, members, typeParams, isExported) => {
            const childMeta = [...heritage, ...members, ...typeParams].reduce(
                combineMetadata,
                emptyMetadata
            );

            const extendsNames = heritage.flatMap(h => h.typeNames);
            const methodNames = childMeta.functions
                .map(f => f.name)
                .filter((n): n is string => n !== null);
            const propertyNames: string[] = [];
            const typeParamNames = typeParams.flatMap(tp => tp.typeNames);

            const interfaceMeta: InterfaceMeta = {
                type: 'interface',
                name,
                extends: extendsNames,
                methods: methodNames,
                properties: propertyNames,
                typeParams: typeParamNames,
            };

            const exports: ExportMeta[] = isExported ? [{
                type: 'export',
                to: null,
                named: [name],
            }] : [];

            return {
                ...childMeta,
                interfaces: [interfaceMeta, ...childMeta.interfaces],
                exports: [...exports, ...childMeta.exports],
            };
        },

        MethodDecl: (name, params, returnType, body) => {
            const childMeta = [
                ...params,
                ...(returnType ? [returnType] : []),
                ...(body ? [body] : []),
            ].reduce(combineMetadata, emptyMetadata);

            const functionMeta: FunctionMeta = {
                type: 'function',
                name,
                params: params.length,
                hasBody: body !== null,
            };

            return {
                ...childMeta,
                functions: [functionMeta, ...childMeta.functions],
            };
        },

        FunctionDecl: (name, params, returnType, body, isExported, isDefault) => {
            const childMeta = [
                ...params,
                ...(returnType ? [returnType] : []),
                ...(body ? [body] : []),
            ].reduce(combineMetadata, emptyMetadata);

            const functionMeta: FunctionMeta = {
                type: 'function',
                name,
                params: params.length,
                hasBody: body !== null,
            };

            const exportName = (isExported && name) ? (isDefault ? ['default'] : [name]) : [];
            const exports: ExportMeta[] = exportName.length > 0 ? [{
                type: 'export',
                to: null,
                named: exportName,
            }] : [];

            return {
                ...childMeta,
                functions: [functionMeta, ...childMeta.functions],
                exports: [...exports, ...childMeta.exports],
            };
        },

        VariableStmt: (declarations, isExported) => {
            const childMeta = declarations.reduce(combineMetadata, emptyMetadata);
            const varNames = declarations.flatMap(d => d.typeNames || []);

            const exports: ExportMeta[] = (isExported && varNames.length > 0) ? [{
                type: 'export',
                to: null,
                named: varNames,
            }] : [];

            return {
                ...childMeta,
                exports: [...exports, ...childMeta.exports],
            };
        },

        VariableDecl: (names, type, initializer) => {
            const childMeta = [
                ...(type ? [type] : []),
                ...(initializer ? [initializer] : []),
            ].reduce(combineMetadata, emptyMetadata);

            // Just return variable names in typeNames, don't include child typeNames
            return {
                ...childMeta,
                typeNames: names,
            };
        },

        ImportDecl: (from, named, defaultImport) => ({
            ...emptyMetadata,
            imports: [{
                type: 'import',
                from,
                named,
                default: defaultImport,
            }],
        }),

        ExportDecl: (to, named) => ({
            ...emptyMetadata,
            exports: [{
                type: 'export',
                to,
                named,
            }],
        }),

        ExportAssignment: (expression, isExportEquals) => {
            // expression contains metadata from the exported value
            // For `export default value`, we want to capture "default" export
            // For `export = value` (CommonJS), isExportEquals is true
            return {
                ...expression,
                exports: [{
                    type: 'export',
                    to: null,
                    named: isExportEquals ? ['='] : ['default'],
                }, ...expression.exports],
            };
        },

        TypeReference: (name, typeArgs) => {
            const childMeta = typeArgs.reduce(combineMetadata, emptyMetadata);
            return {
                ...childMeta,
                typeNames: [name, ...childMeta.typeNames],
            };
        },
    }
);
