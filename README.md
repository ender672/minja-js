# @ender672/minja-js

Unofficial JavaScript port of [minja](https://github.com/ochafik/minja), a minimalistic Jinja2 template engine for LLM chat templates.

This is an independent port — not affiliated with or endorsed by the original minja project. The original C++ library is copyright 2024 Google LLC, licensed under MIT.

## Usage

### Low-level: parse and render a template

```js
import { Parser, Context } from '@ender672/minja-js/minja';

const root = Parser.parse('Hello {{ name }}!');
const ctx = Context.make({ name: 'world' });
console.log(root.render(ctx)); // "Hello world!"
```

### High-level: ChatTemplate

```js
import { ChatTemplate } from '@ender672/minja-js/chat-template';

const tmpl = new ChatTemplate(templateSource, bosToken, eosToken);
const output = tmpl.apply({
  messages: [{ role: 'user', content: 'Hi' }],
  addGenerationPrompt: true,
});
```

## Running tests

```sh
npm test
```

## Differential fuzzing against C++ minja

To compare JS output against the C++ implementation:

```sh
npm run build:diff-fuzz   # one-time: clones C++ minja + nlohmann/json, compiles harness
npm run diff-fuzz         # runs 10k iterations comparing C++ vs JS output
```

Requires a C++ compiler with C++17 support, `curl`, and `git`. Dependencies are cached in `.deps/`.
