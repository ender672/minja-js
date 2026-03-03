/*
    Copyright 2024 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
*/
// SPDX-License-Identifier: MIT

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { ChatTemplate } from '../src/chat-template.js';

// ── Template strings ──────────────────────────────────────────────────

const TEMPLATE_CHATML =
  "{%- for message in messages -%}\n" +
  "  {{- '<|im_start|>' + message.role + '\\n' + message.content + '<|im_end|>\\n' -}}\n" +
  "{%- endfor -%}\n" +
  "{%- if add_generation_prompt -%}\n" +
  "  {{- '<|im_start|>assistant\\n' -}}\n" +
  "{%- endif -%}";

const TEMPLATE_CHATML_NO_SYSTEM =
  "{%- for message in messages -%}\n" +
  "  {%- if message.role == 'system' -%}\n" +
  "    {{- raise_exception('System role not supported') -}}\n" +
  "  {%- endif -%}\n" +
  "  {{- '<|im_start|>' + message.role + '\\n' + message.content + '<|im_end|>\\n' -}}\n" +
  "{%- endfor -%}\n" +
  "{%- if add_generation_prompt -%}\n" +
  "  {{- '<|im_start|>assistant\\n' -}}\n" +
  "{%- endif -%}";

const TEMPLATE_DUMMY =
  "{%- for tool in tools -%}\n" +
  "  {{- 'tool: ' + (tool | tojson(indent=2)) + '\\n'  -}}\n" +
  "{%- endfor -%}\n" +
  "{%- for message in messages -%}\n" +
  "  {{- 'message: ' + (message | tojson(indent=2)) + '\\n' -}}\n" +
  "{%- endfor -%}\n" +
  "{%- if add_generation_prompt -%}\n" +
  "  {{- 'message: ' -}}\n" +
  "{%- endif -%}";

// ── Test data ─────────────────────────────────────────────────────────

const messageUserText = {
  role: 'user',
  content: 'I need help',
};

const messageAssistantText = {
  role: 'assistant',
  content: 'Hello, world!',
};

const messageSystem = {
  role: 'system',
  content: 'I am The System!',
};

const messageAssistantCall = {
  role: 'assistant',
  content: null,
  tool_calls: [
    {
      type: 'function',
      function: {
        name: 'special_function',
        arguments: '{"arg1": 1}',
      },
    },
  ],
};

const messageAssistantCallId = {
  role: 'assistant',
  content: null,
  tool_calls: [
    {
      type: 'function',
      function: {
        name: 'special_function',
        arguments: '{"arg1": 1}',
      },
      id: '123456789',
    },
  ],
};

const messageAssistantCallIdx = {
  role: 'assistant',
  content: null,
  tool_plan: "I'm not so sure",
  tool_calls: [
    {
      type: 'function',
      function: {
        name: 'special_function',
        arguments: '{"arg1": 1}',
      },
      id: '0',
    },
  ],
};

const messageTool = {
  role: 'tool',
  content: { result: 123 },
  tool_call_id: '123456789',
};

const specialFunctionTool = {
  type: 'function',
  function: {
    name: 'special_function',
    description: "I'm special",
    parameters: {
      type: 'object',
      properties: {
        arg1: {
          type: 'integer',
          description: 'The arg.',
        },
      },
      required: ['arg1'],
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────

function optionsNoPolyfills() {
  return {
    applyPolyfills: false,
    polyfillSystemRole: false,
    polyfillTools: false,
    polyfillToolCallExamples: false,
    polyfillToolCalls: false,
    polyfillToolResponses: false,
    polyfillObjectArguments: false,
    polyfillTypedContent: false,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('PolyfillTest', () => {
  test('NoPolyfill', () => {
    const tmpl = new ChatTemplate(TEMPLATE_CHATML, '', '');

    // With generation prompt (default)
    let inputs = { messages: [messageUserText] };
    assert.strictEqual(
      tmpl.apply(inputs, optionsNoPolyfills()),
      '<|im_start|>user\n' +
      'I need help<|im_end|>\n' +
      '<|im_start|>assistant\n'
    );

    // Without generation prompt
    inputs = { messages: [messageUserText], addGenerationPrompt: false };
    assert.strictEqual(
      tmpl.apply(inputs, optionsNoPolyfills()),
      '<|im_start|>user\n' +
      'I need help<|im_end|>\n'
    );

    // Two messages, no generation prompt
    inputs = { messages: [messageUserText, messageAssistantText], addGenerationPrompt: false };
    assert.strictEqual(
      tmpl.apply(inputs, optionsNoPolyfills()),
      '<|im_start|>user\n' +
      'I need help<|im_end|>\n' +
      '<|im_start|>assistant\n' +
      'Hello, world!<|im_end|>\n'
    );
  });

  test('SystemRoleSupported', () => {
    const chatml = new ChatTemplate(TEMPLATE_CHATML, '', '');
    const dummy = new ChatTemplate(TEMPLATE_DUMMY, '', '');

    const inputs = { messages: [messageSystem, messageUserText] };

    assert.strictEqual(
      chatml.apply(inputs),
      '<|im_start|>system\n' +
      'I am The System!<|im_end|>\n' +
      '<|im_start|>user\n' +
      'I need help<|im_end|>\n' +
      '<|im_start|>assistant\n'
    );

    assert.strictEqual(
      dummy.apply(inputs),
      'message: {\n' +
      '  "role": "system",\n' +
      '  "content": "I am The System!"\n' +
      '}\n' +
      'message: {\n' +
      '  "role": "user",\n' +
      '  "content": "I need help"\n' +
      '}\n' +
      'message: '
    );
  });

  test('SystemRolePolyfill', () => {
    const tmpl = new ChatTemplate(TEMPLATE_CHATML_NO_SYSTEM, '', '');

    const inputs = { messages: [messageSystem, messageUserText] };

    // Without polyfills, should throw
    assert.throws(
      () => tmpl.apply(inputs, optionsNoPolyfills()),
      { message: /System role not supported/ }
    );

    // With polyfills (default), system is merged into first user message
    assert.strictEqual(
      tmpl.apply(inputs),
      '<|im_start|>user\n' +
      'I am The System!\n' +
      'I need help<|im_end|>\n' +
      '<|im_start|>assistant\n'
    );
  });

  test('ToolCallSupported', () => {
    const tmpl = new ChatTemplate(TEMPLATE_DUMMY, '', '');

    const inputs = { messages: [messageUserText, messageAssistantCallId] };

    assert.strictEqual(
      tmpl.apply(inputs),
      'message: {\n' +
      '  "role": "user",\n' +
      '  "content": "I need help"\n' +
      '}\n' +
      'message: {\n' +
      '  "role": "assistant",\n' +
      '  "content": null,\n' +
      '  "tool_calls": [\n' +
      '    {\n' +
      '      "type": "function",\n' +
      '      "function": {\n' +
      '        "name": "special_function",\n' +
      '        "arguments": {\n' +
      '          "arg1": 1\n' +
      '        }\n' +
      '      },\n' +
      '      "id": "123456789"\n' +
      '    }\n' +
      '  ]\n' +
      '}\n' +
      'message: '
    );
  });

  test('ToolCallPolyfill', () => {
    const tmpl = new ChatTemplate(TEMPLATE_CHATML, '', '');

    const inputs = { messages: [messageUserText, messageAssistantCallId] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|im_start|>user\n' +
      'I need help<|im_end|>\n' +
      '<|im_start|>assistant\n' +
      '{\n' +
      '  "tool_calls": [\n' +
      '    {\n' +
      '      "name": "special_function",\n' +
      '      "arguments": {\n' +
      '        "arg1": 1\n' +
      '      },\n' +
      '      "id": "123456789"\n' +
      '    }\n' +
      '  ]\n' +
      '}<|im_end|>\n' +
      '<|im_start|>assistant\n'
    );
  });

  test('ToolsPolyfill', () => {
    const tmpl = new ChatTemplate(TEMPLATE_CHATML, '', '<|im_end|>');

    const inputs = {
      messages: [messageUserText],
      tools: [specialFunctionTool],
    };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|im_start|>system\n' +
      'You can call any of the following tools to satisfy the user\'s requests: [\n' +
      '  {\n' +
      '    "type": "function",\n' +
      '    "function": {\n' +
      '      "name": "special_function",\n' +
      '      "description": "I\'m special",\n' +
      '      "parameters": {\n' +
      '        "type": "object",\n' +
      '        "properties": {\n' +
      '          "arg1": {\n' +
      '            "type": "integer",\n' +
      '            "description": "The arg."\n' +
      '          }\n' +
      '        },\n' +
      '        "required": [\n' +
      '          "arg1"\n' +
      '        ]\n' +
      '      }\n' +
      '    }\n' +
      '  }\n' +
      ']\n' +
      '\n' +
      'Example tool call syntax:\n' +
      '\n' +
      '{\n' +
      '  "tool_calls": [\n' +
      '    {\n' +
      '      "name": "tool_name",\n' +
      '      "arguments": {\n' +
      '        "arg1": "some_value"\n' +
      '      },\n' +
      '      "id": "call_1___"\n' +
      '    }\n' +
      '  ]\n' +
      '}\n\n<|im_end|>\n' +
      '<|im_start|>user\n' +
      'I need help<|im_end|>\n' +
      '<|im_start|>assistant\n'
    );
  });

  test('ToolSupported', () => {
    const tmpl = new ChatTemplate(TEMPLATE_DUMMY, '', '');

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      'message: {\n' +
      '  "role": "tool",\n' +
      '  "content": {\n' +
      '    "result": 123\n' +
      '  },\n' +
      '  "tool_call_id": "123456789"\n' +
      '}\n' +
      'message: '
    );
  });

  test('ToolPolyfill', () => {
    const tmpl = new ChatTemplate(TEMPLATE_CHATML_NO_SYSTEM, '', '');

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|im_start|>user\n{\n' +
      '  "tool_response": {\n' +
      '    "content": {\n' +
      '      "result": 123\n' +
      '    },\n' +
      '    "tool_call_id": "123456789"\n' +
      '  }\n' +
      '}<|im_end|>\n' +
      '<|im_start|>assistant\n'
    );
  });
});
