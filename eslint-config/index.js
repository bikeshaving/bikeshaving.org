import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import acrocase from "eslint-plugin-acrocase";
import crank from "eslint-plugin-crank";
import esfold from "eslint-plugin-esfold";
import stylisticPlugin from "@stylistic/eslint-plugin";

const customized = stylisticPlugin.configs.customize({
	indent: "tab",
	quotes: "double",
	semi: true,
	arrowParens: true,
	commaDangle: "always-multiline",
	braceStyle: "1tbs",
	blockSpacing: false,
	jsx: true,
}).rules;

const stylistic = {
	plugins: {"@stylistic": stylisticPlugin, esfold},
	rules: {
		...customized,

		// A ternary branch leads with its operator and sits one tab in. Every
		// other operator trails.
		"@stylistic/operator-linebreak": [
			"error",
			"after",
			{overrides: {"?": "before", ":": "before"}},
		],
		"@stylistic/indent": [
			"error",
			"tab",
			{...customized["@stylistic/indent"][2], offsetTernaryExpressions: false},
		],

		// Off, because splitting `{count} comments` over three lines is what
		// forces the `{" "}` spacer to exist.
		"@stylistic/jsx-one-expression-per-line": "off",

		// An arrow returning JSX keeps its own closer, so a call wrapping one
		// does not end on two lines of brackets with the comma stranded
		// between them.
		"@stylistic/jsx-wrap-multilines": [
			"error",
			{...customized["@stylistic/jsx-wrap-multilines"][1], arrow: "ignore"},
		],

		"@stylistic/quotes": ["error", "double", {avoidEscape: true}],
		"@stylistic/quote-props": ["error", "as-needed"],
		"@stylistic/object-curly-spacing": ["error", "never"],
		"@stylistic/array-bracket-spacing": ["error", "never"],
		"@stylistic/computed-property-spacing": [
			"error",
			"never",
			{enforceForClassMembers: true},
		],

		"@stylistic/lines-around-comment": [
			"error",
			{
				beforeBlockComment: true,
				beforeLineComment: false,
				allowBlockStart: true,
				allowClassStart: true,
				allowObjectStart: true,
				allowArrayStart: true,
			},
		],
		"@stylistic/multiline-comment-style": [
			"error",
			"separate-lines",
			{checkJSDoc: false},
		],

		"@stylistic/no-multiple-empty-lines": [
			"error",
			{max: 1, maxBOF: 0, maxEOF: 0},
		],

	},
};

// Each ban is its own named rule, so it can be disabled on its own line:
//
//   // eslint-disable-next-line @b9g/no-enums
function selectorRule(selector, message) {
	return {
		meta: {type: "problem", schema: [], messages: {banned: message}},
		create(context) {
			return {
				[selector]: (node) => context.report({node, messageId: "banned"}),
			};
		},
	};
}

const noLeadingTypeOperator = {
	meta: {
		type: "problem",
		schema: [],
		fixable: "code",
		messages: {
			banned:
				"A union or intersection does not start with `{{operator}}`. Write the first member, then the operator at the end of the line.",
		},
	},
	create(context) {
		const source = context.sourceCode;

		function check(node) {
			const operator = source.getFirstToken(node);
			if (operator.value !== "|" && operator.value !== "&") {
				return;
			}

			const first = source.getTokenAfter(operator);

			context.report({
				node,
				loc: operator.loc,
				messageId: "banned",
				data: {operator: operator.value},
				fix(fixer) {
					const previous = source.getTokenBefore(operator);
					if (
						source.getCommentsAfter(previous).length > 0 ||
						source.getCommentsBefore(first).length > 0
					) {
						return null;
					}

					const before = source.text.slice(
						previous.range[1],
						operator.range[0],
					);
					const after = source.text
						.slice(operator.range[1], first.range[0])
						.replace(/^[^\S\n]+/, "");
					return fixer.replaceTextRange(
						[previous.range[1], first.range[0]],
						before + after,
					);
				},
			});
		}

		return {TSUnionType: check, TSIntersectionType: check};
	},
};

const paddingAroundDeclarations = {
	meta: {
		type: "layout",
		schema: [],
		fixable: "whitespace",
		messages: {
			padding: "A function or class declaration stands on its own. Put a blank line here.",
		},
	},
	create(context) {
		const source = context.sourceCode;

		function unwrap(node) {
			if (
				node.type === "ExportNamedDeclaration" ||
				node.type === "ExportDefaultDeclaration"
			) {
				return node.declaration;
			}

			return node;
		}

		function isDeclaration(node) {
			const inner = unwrap(node);
			return (
				inner != null &&
				(inner.type === "FunctionDeclaration" ||
					inner.type === "ClassDeclaration" ||
					inner.type === "TSDeclareFunction")
			);
		}

		function isOverloadPair(previous, next) {
			const a = unwrap(previous);
			const b = unwrap(next);
			return (
				a != null &&
				b != null &&
				a.type === "TSDeclareFunction" &&
				(b.type === "TSDeclareFunction" || b.type === "FunctionDeclaration") &&
				a.id != null &&
				b.id != null &&
				a.id.name === b.id.name
			);
		}

		function startsLine(node) {
			const lineStart = source.getIndexFromLoc({
				line: node.loc.start.line,
				column: 0,
			});
			return source.text.slice(lineStart, node.range[0]).trim() === "";
		}

		function head(node) {
			let first = node;
			const comments = source.getCommentsBefore(node);
			for (let i = comments.length - 1; i >= 0; i--) {
				const comment = comments[i];
				if (
					!startsLine(comment) ||
					first.loc.start.line - comment.loc.end.line > 1
				) {
					break;
				}

				first = comment;
			}

			return first;
		}

		function walk(body) {
			for (let i = 1; i < body.length; i++) {
				const previous = body[i - 1];
				const next = body[i];
				if (
					(!isDeclaration(previous) && !isDeclaration(next)) ||
					isOverloadPair(previous, next)
				) {
					continue;
				}

				const first = head(next);
				if (first.loc.start.line - previous.loc.end.line >= 2) {
					continue;
				}

				const lineStart = source.getIndexFromLoc({
					line: first.loc.start.line,
					column: 0,
				});
				context.report({
					node: next,
					loc: first.loc.start,
					messageId: "padding",
					fix: (fixer) =>
						fixer.insertTextBeforeRange([lineStart, lineStart], "\n"),
				});
			}
		}

		return {
			Program: (node) => walk(node.body),
			BlockStatement: (node) => walk(node.body),
			StaticBlock: (node) => walk(node.body),
			TSModuleBlock: (node) => walk(node.body),
			SwitchCase: (node) => walk(node.consequent),
		};
	},
};

const DIRECTIVE =
	/^\s*(?:eslint\b|eslint-|globals?\b|exported\b|@ts-|prettier-ignore|istanbul\b|[cv]8\b|#)/;

const CHANGELOG = new RegExp(
	"^(?:" +
	"(?:added|removed|deleted|renamed|moved|replaced|refactored|updated" +
	"|changed|simplified|extracted|introduced|switched|converted|migrated)" +
	"\\s+(?:the|a|an|this|these|those|it|them|back|to|from|out|into" +
	"|all|old|new|unused|duplicate|redundant|legacy)\\b" +
	"|(?:previously|formerly|originally|used to|no longer|instead of" +
	"|we now|this now)\\b" +
	")",
	"i",
);

const noChangelogComments = {
	meta: {
		type: "problem",
		schema: [],
		messages: {
			changelog:
				"A comment describes the code that is here, not how it got here. Say what it does in the present tense, or delete it.",
		},
	},
	create(context) {
		const source = context.sourceCode;
		return {
			Program() {
				let last = null;
				for (const comment of source.getAllComments()) {
					const continued =
						last != null &&
						last.type === comment.type &&
						comment.loc.start.line - last.loc.end.line === 1;
					last = comment;
					if (continued || DIRECTIVE.test(comment.value)) {
						continue;
					}

					const first = comment.value
						.split("\n")
						.map((line) => line.replace(/^\s*\*?\s*/, ""))
						.find((line) => line !== "");
					if (first != null && CHANGELOG.test(first)) {
						context.report({node: comment, messageId: "changelog"});
					}
				}
			},
		};
	},
};

const noExportedSymbols = {
	meta: {
		type: "problem",
		schema: [],
		messages: {
			exported:
				"An exported `Symbol()` is not private. Keep the key in its module and export a function that does the work, or use `Symbol.for()` if the key is meant to be public.",
		},
	},
	create(context) {
		const source = context.sourceCode;

		function unwrap(node) {
			let current = node;
			while (
				current?.type === "TSAsExpression" ||
				current?.type === "TSSatisfiesExpression" ||
				current?.type === "TSNonNullExpression"
			) {
				current = current.expression;
			}
			return current;
		}

		function isPrivateSymbol(node) {
			const value = unwrap(node);
			return (
				value?.type === "CallExpression" &&
				value.callee.type === "Identifier" &&
				value.callee.name === "Symbol"
			);
		}

		function declaresPrivateSymbol(name, scope) {
			const variable = scope.set.get(name);
			for (const def of variable?.defs ?? []) {
				if (
					def.node.type === "VariableDeclarator" &&
					isPrivateSymbol(def.node.init)
				) {
					return true;
				}
			}
			return false;
		}

		return {
			"ExportNamedDeclaration > VariableDeclaration > VariableDeclarator"(
				node,
			) {
				if (isPrivateSymbol(node.init)) {
					context.report({node: node.id, messageId: "exported"});
				}
			},

			"ExportNamedDeclaration[declaration=null] > ExportSpecifier"(node) {
				if (
					node.local.type === "Identifier" &&
					declaresPrivateSymbol(node.local.name, source.getScope(node.parent))
				) {
					context.report({node, messageId: "exported"});
				}
			},

			ExportDefaultDeclaration(node) {
				const value = unwrap(node.declaration);
				if (
					isPrivateSymbol(value) ||
					(value?.type === "Identifier" &&
						declaresPrivateSymbol(value.name, source.getScope(node)))
				) {
					context.report({node, messageId: "exported"});
				}
			},
		};
	},
};

const b9g = {
	rules: {
		"padding-around-declarations": paddingAroundDeclarations,
		"no-changelog-comments": noChangelogComments,
		"no-exported-symbols": noExportedSymbols,

		"no-leading-type-operator": noLeadingTypeOperator,

		"no-parameter-properties": selectorRule(
			"TSParameterProperty",
			"Parameter properties are banned. Declare the field and assign it in the constructor.",
		),

		"no-access-modifiers": selectorRule(
			":matches(PropertyDefinition, MethodDefinition, TSAbstractPropertyDefinition, TSAbstractMethodDefinition)[accessibility]",
			"TypeScript access modifiers are banned. Omit the modifier, and keep internals behind a module-local symbol.",
		),

		"no-field-initializers": selectorRule(
			"PropertyDefinition[value][static=false]",
			"Instance field initializers are banned. Assign it in the constructor, where the whole shape is in one place.",
		),

		"no-private-fields": selectorRule(
			":matches(PropertyDefinition, MethodDefinition, TSAbstractPropertyDefinition, TSAbstractMethodDefinition, AccessorProperty)[key.type='PrivateIdentifier']",
			"Private fields and methods are banned. Use a module-local symbol for state, or a module-local function for behavior.",
		),

		"no-empty-catch-binding": selectorRule(
			"CatchClause[param=null]",
			"Empty catch binding is banned. Bind the error and handle it.",
		),

		"no-enums": selectorRule(
			"TSEnumDeclaration",
			"Enums do not erase. Use a discriminated union or an `as const` object.",
		),

		"no-namespaces": selectorRule(
			"TSModuleDeclaration[kind='namespace'][declare!=true]:not(TSModuleDeclaration[declare=true] *):has(:matches(VariableDeclaration, FunctionDeclaration[body], ClassDeclaration, TSEnumDeclaration))",
			"This namespace holds values, so it emits an IIFE and does not erase. Use ES modules.",
		),
		"no-import-equals": selectorRule(
			"TSImportEqualsDeclaration",
			"`import =` does not erase. Use an ES module import.",
		),
		"no-export-equals": selectorRule(
			"TSExportAssignment",
			"`export =` does not erase. Use an ES module export.",
		),

		"no-decorators": selectorRule(
			"Decorator",
			"Decorators are banned. Their meaning lives in an imported function you cannot see at the use site. Use a higher-order function.",
		),
		"no-auto-accessors": selectorRule(
			"AccessorProperty",
			"Auto-accessors ride decorators. Write a getter and a setter.",
		),

		"no-exported-let": selectorRule(
			"ExportNamedDeclaration > VariableDeclaration[kind='let']",
			"An exported `let` is a mutable global in disguise. Export a function that returns the value.",
		),

		"capitalize-namespace-imports": selectorRule(
			"ImportNamespaceSpecifier[local.name=/^[a-z]/]",
			'Capitalize a namespace import. `import * as Path from "node:path"` keeps `path` free as a variable name.',
		),

		"prefer-function-declarations": selectorRule(
			":matches(Program, ExportNamedDeclaration, ExportDefaultDeclaration) > VariableDeclaration > VariableDeclarator > :matches(ArrowFunctionExpression, FunctionExpression)[body.body.length>0]",
			"A top-level function with a body should be a `function` declaration, not a const-assigned expression. An empty body or a single expression is fine.",
		),

		"explicit-declaration-return-type": selectorRule(
			"FunctionDeclaration:not([returnType])[id.name!=/^[A-Z]/], :matches(MethodDefinition, TSAbstractMethodDefinition)[kind=/^(method|get)$/] > :matches(FunctionExpression, TSEmptyBodyFunctionExpression):not([returnType])",
			"A function declaration, method, or getter must state its return type.",
		),

		"no-deep-optional-chaining": selectorRule(
			":matches(MemberExpression, CallExpression)[optional=true] :matches(MemberExpression, CallExpression)[optional=true]",
			"More than one `?.` in a chain. One optional link at a trust boundary is fine. A chain of them is a broken data model.",
		),
		"no-accumulator-spread": selectorRule(
			"CallExpression[callee.property.name='reduce'] > ArrowFunctionExpression > :matches(ObjectExpression, ArrayExpression) > SpreadElement",
			"Spreading the accumulator makes this O(n^2). Use for...of and mutate a local.",
		),
	},
};

const b9gRules = Object.fromEntries(
	Object.keys(b9g.rules).map((name) => [`@b9g/${name}`, "error"]),
);

// The TypeScript set is the same one typescript-eslint's own preset matches,
// so the block that disables the core rules and the block that supplies the
// parser always agree on which files are TypeScript.
const TS = "**/*.{ts,tsx,mts,cts}";
const JS = "**/*.{js,jsx,mjs,cjs}";
const COMMONJS = "**/*.{cjs,cts}";

export default [
	{
		ignores: [
			"node_modules/**",
			"**/node_modules/**",
			"**/dist/**",
			"**/build/**",
			"**/coverage/**",
			"**/*.min.js",
		],
	},

	{
		linterOptions: {
			reportUnusedDisableDirectives: "error",
			reportUnusedInlineConfigs: "error",
		},
	},
	js.configs.recommended,
	typescript.configs["flat/eslint-recommended"],
	{
		files: [JS, TS],
		languageOptions: {
			parser: typescriptParser,
			parserOptions: {sourceType: "module"},
			globals: {
				console: "readonly",
				process: "readonly",
				Buffer: "readonly",
				globalThis: "readonly",
			},
		},
		plugins: {
			"@typescript-eslint": typescript,
			acrocase,
			crank,
			"@b9g": b9g,
			...stylistic.plugins,
		},
		rules: {
			...crank.configs.recommended.rules,

			"acrocase/acrocase": "error",
			"esfold/breaks": "error",

			// TypeScript resolves names better than a globals list does.
			"no-undef": "off",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					varsIgnorePattern: "^_",
					argsIgnorePattern: "^_",
					caughtErrors: "none",
				},
			],

			"@typescript-eslint/no-dupe-class-members": "warn",

			"@typescript-eslint/explicit-module-boundary-types": [
				"error",
				{allowArgumentsExplicitlyTypedAsAny: true},
			],
			curly: ["error", "all"],
			"prefer-const": "error",

			"no-useless-catch": "error",
			"no-empty": ["error", {allowEmptyCatch: false}],
			"no-throw-literal": "error",
			"prefer-promise-reject-errors": "error",
			"no-extend-native": "error",
			"no-restricted-properties": [
				"error",
				{
					object: "Promise",
					property: "allSettled",
					message:
						"Promise.allSettled turns a rejection into data. Use Promise.all(xs.map((x) => x.catch(recover))).",
				},
				{
					object: "Promise",
					property: "any",
					message:
						"Promise.any flattens rejections into an AggregateError. Handle each rejection where it happens.",
				},
			],

			"no-restricted-globals": [
				"error",
				{
					name: "WeakRef",
					message:
						"WeakRef exposes GC timing. Hold the value, or use a WeakMap, where GC is unobservable.",
				},
				{
					name: "FinalizationRegistry",
					message:
						"FinalizationRegistry runs on undeterminable GC timing. Clean up explicitly.",
				},
				{
					name: "Proxy",
					message:
						"Proxies are slow. Write the methods you need.",
				},
			],

			// Hold in general. Adopt for `x == null`, the one blessed use.
			eqeqeq: ["error", "always", {null: "ignore"}],
			"@typescript-eslint/array-type": ["error", {default: "array-simple"}],
			"no-console": ["error", {allow: ["info", "warn", "error"]}],

			"@typescript-eslint/no-misused-new": "error",
			"@typescript-eslint/no-unsafe-declaration-merging": "error",
			"@typescript-eslint/no-unsafe-function-type": "error",
			"@typescript-eslint/no-wrapper-object-types": "error",
			// An empty interface extending one supertype is the extension point
			// other packages merge into.
			"@typescript-eslint/no-empty-object-type": [
				"error",
				{allowInterfaces: "with-single-extends"},
			],
			"@typescript-eslint/no-extra-non-null-assertion": "error",
			"@typescript-eslint/no-non-null-asserted-optional-chain": "error",
			"@typescript-eslint/no-unnecessary-type-constraint": "error",
			"@typescript-eslint/no-array-constructor": "error",
			// A tagged template is a call, and the rule already allows calls.
			"@typescript-eslint/no-unused-expressions": [
				"error",
				{allowTaggedTemplates: true},
			],
			"@typescript-eslint/consistent-type-imports": "error",
			"@typescript-eslint/no-import-type-side-effects": "error",
			"@typescript-eslint/no-require-imports": "error",
			"@typescript-eslint/triple-slash-reference": "error",
			"no-var": "error",
			"prefer-rest-params": "error",
			"prefer-spread": "error",
			"no-sequences": "error",
			"no-void": ["error", {allowAsStatement: true}],
			"object-shorthand": ["error", "always"],
			"no-useless-rename": "error",
			"no-useless-computed-key": "error",
			"symbol-description": "error",
			"@typescript-eslint/prefer-as-const": "error",
			"@typescript-eslint/no-inferrable-types": "error",

			...b9gRules,
			...stylistic.rules,
		},
	},
	{
		files: [JS],
		rules: {
			"@b9g/explicit-declaration-return-type": "off",
			"@typescript-eslint/explicit-module-boundary-types": "off",
		},
	},

	// A .cjs or .cts file exists to be CommonJS, so the three rules that hold
	// the rest of the codebase to ES modules do not apply to it.
	{
		files: [COMMONJS],
		languageOptions: {parserOptions: {sourceType: "commonjs"}},
		rules: {
			"@typescript-eslint/no-require-imports": "off",
			"@b9g/no-import-equals": "off",
			"@b9g/no-export-equals": "off",
		},
	},
];
