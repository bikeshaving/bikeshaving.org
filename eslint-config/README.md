# @b9g/eslint-config

The Bike Shaving house rules for JavaScript and TypeScript, as a flat ESLint
config.

## Install

```sh
npm install --save-dev @b9g/eslint-config eslint @eslint/js \
  @stylistic/eslint-plugin @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser eslint-plugin-acrocase eslint-plugin-crank \
  eslint-plugin-esfold
```

The plugins are peer dependencies. This keeps one copy of each plugin in your
tree, and it lets you set the versions.

## Use

`eslint.config.js`:

```js
import config from "@b9g/eslint-config";

export default config;
```

To change a rule, put your own block after it:

```js
import config from "@b9g/eslint-config";

export default [
	...config,
	{
		files: ["examples/**"],
		rules: {"no-console": "off"},
	},
];
```

## Style Rules

`@stylistic` generates 65 rules from these values:

| decision | value |
| --- | --- |
| indent | tab |
| quotes | double, but single to avoid an escape |
| semicolons | yes |
| arrow parens | always |
| trailing comma | on multiline |
| brace style | 1tbs (1 true brace style) |
| brace spacing | none |
| operator line break | after |

## License

MIT
