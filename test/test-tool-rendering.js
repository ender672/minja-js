/*
    Copyright 2024 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
*/
// SPDX-License-Identifier: MIT

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ChatTemplate } from '../src/chat-template.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', 'test-templates');

function readTemplate(filename) {
  return readFileSync(join(TEMPLATES_DIR, filename), 'utf-8');
}

// ── Shared test data (same as test-polyfills.js) ─────────────────────

const messageTool = {
  role: 'tool',
  content: { result: 123 },
  tool_call_id: '123456789',
};

describe('ToolTest', () => {
  test('DeepSeekR1', () => {
    const tmpl = new ChatTemplate(
      readTemplate('deepseek-ai-DeepSeek-R1-Distill-Llama-70B.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      "<｜tool▁outputs▁begin｜><｜tool▁output▁begin｜>{'result': 123}<｜tool▁output▁end｜><｜tool▁outputs▁end｜>"
    );
  });

  test('CommandR7b', () => {
    const tmpl = new ChatTemplate(
      readTemplate('CohereForAI-c4ai-command-r7b-12-2024-tool_use.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|># System Preamble\n' +
      'You are in contextual safety mode. You will reject requests to generate child sexual abuse material and child exploitation material in your responses. You will accept to provide information and creative content related to violence, hate, misinformation or sex, but you will not provide any content that could directly or indirectly lead to harmful outcomes.\n' +
      '\n' +
      'Your information cutoff date is June 2024.\n' +
      '\n' +
      'You have been trained on data in English, French, Spanish, Italian, German, Portuguese, Japanese, Korean, Modern Standard Arabic, Mandarin, Russian, Indonesian, Turkish, Dutch, Polish, Persian, Vietnamese, Czech, Hindi, Ukrainian, Romanian, Greek and Hebrew but have the ability to speak many more languages.\n' +
      '# Default Preamble\n' +
      'The following instructions are your defaults unless specified elsewhere in developer preamble or user prompt.\n' +
      '- Your name is Command.\n' +
      '- You are a large language model built by Cohere.\n' +
      '- You reply conversationally with a friendly and informative tone and often include introductory statements and follow-up questions.\n' +
      '- If the input is ambiguous, ask clarifying follow-up questions.\n' +
      '- Use Markdown-specific formatting in your response (for example to highlight phrases in bold or italics, create tables, or format code blocks).\n' +
      '- Use LaTeX to generate mathematical notation for complex equations.\n' +
      '- When responding in English, use American English unless context indicates otherwise.\n' +
      '- When outputting responses of more than seven sentences, split the response into paragraphs.\n' +
      '- Prefer the active voice.\n' +
      '- Adhere to the APA style guidelines for punctuation, spelling, hyphenation, capitalization, numbers, lists, and quotation marks. Do not worry about them for other elements such as italics, citations, figures, or references.\n' +
      '- Use gender-neutral pronouns for unspecified persons.\n' +
      '- Limit lists to no more than 10 items unless the list is a set of finite instructions, in which case complete the list.\n' +
      '- Use the third person when asked to write a summary.\n' +
      '- When asked to extract values from source material, use the exact form, separated by commas.\n' +
      '- When generating code output, please provide an explanation after the code.\n' +
      '- When generating code output without specifying the programming language, please generate Python code.\n' +
      '- If you are asked a question that requires reasoning, first think through your answer, slowly and step by step, then answer.<|END_OF_TURN_TOKEN|><|START_OF_TURN_TOKEN|><|SYSTEM_TOKEN|><|START_TOOL_RESULT|>[\n' +
      '    {\n' +
      '        "tool_call_id": "",\n' +
      '        "results": {\n' +
      '            "0": {"result": 123}\n' +
      '        },\n' +
      '        "is_error": null\n' +
      '    }\n' +
      ']<|END_TOOL_RESULT|><|END_OF_TURN_TOKEN|><|START_OF_TURN_TOKEN|><|CHATBOT_TOKEN|>'
    );
  });

  test('MistralNemo', () => {
    const tmpl = new ChatTemplate(
      readTemplate('mistralai-Mistral-Nemo-Instruct-2407.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      "[TOOL_RESULTS]{\"content\": {'result': 123}, \"call_id\": \"123456789\"}[/TOOL_RESULTS]"
    );
  });

  test('NousResearchHermes3', () => {
    const tmpl = new ChatTemplate(
      readTemplate('NousResearch-Hermes-3-Llama-3.1-70B-tool_use.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|im_start|>system\n' +
      'You are a function calling AI model. You are provided with function signatures within <tools></tools> XML tags. You may call one or more functions to assist with the user query. Don\'t make assumptions about what values to plug into functions. Here are the available tools: <tools>  </tools>' +
      'Use the following pydantic model json schema for each tool call you will make: {"properties": {"name": {"title": "Name", "type": "string"}, "arguments": {"title": "Arguments", "type": "object"}}, "required": ["name", "arguments"], "title": "FunctionCall", "type": "object"}}\n' +
      'For each function call return a json object with function name and arguments within <tool_call></tool_call> XML tags as follows:\n' +
      '<tool_call>\n' +
      '{"name": <function-name>, "arguments": <args-dict>}\n' +
      '</tool_call><|im_end|>\n' +
      '<tool_response>\n' +
      "{'result': 123}\n" +
      '</tool_response><|im_end|><|im_start|>assistant\n'
    );
  });

  test('NousResearchHermes2', () => {
    const tmpl = new ChatTemplate(
      readTemplate('NousResearch-Hermes-3-Llama-3.1-70B-tool_use.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|im_start|>system\n' +
      'You are a function calling AI model. You are provided with function signatures within <tools></tools> XML tags. You may call one or more functions to assist with the user query. Don\'t make assumptions about what values to plug into functions. Here are the available tools: <tools>  </tools>' +
      'Use the following pydantic model json schema for each tool call you will make: {"properties": {"name": {"title": "Name", "type": "string"}, "arguments": {"title": "Arguments", "type": "object"}}, "required": ["name", "arguments"], "title": "FunctionCall", "type": "object"}}\n' +
      'For each function call return a json object with function name and arguments within <tool_call></tool_call> XML tags as follows:\n' +
      '<tool_call>\n' +
      '{"name": <function-name>, "arguments": <args-dict>}\n' +
      '</tool_call><|im_end|>\n' +
      '<tool_response>\n' +
      "{'result': 123}\n" +
      '</tool_response><|im_end|><|im_start|>assistant\n'
    );
  });

  test('Llama3_3', () => {
    const tmpl = new ChatTemplate(
      readTemplate('meta-llama-Llama-3.1-8B-Instruct.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|start_header_id|>system<|end_header_id|>\n' +
      '\n' +
      'Cutting Knowledge Date: December 2023\n' +
      'Today Date: 26 Jul 2024\n' +
      '\n' +
      '<|eot_id|><|start_header_id|>ipython<|end_header_id|>\n' +
      '\n' +
      '{"result": 123}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n' +
      '\n'
    );
  });

  test('MeetkaiFunctionary3_1', () => {
    const tmpl = new ChatTemplate(
      readTemplate('meetkai-functionary-medium-v3.1.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|start_header_id|>system<|end_header_id|>\n' +
      '\n' +
      '\n' +
      'Cutting Knowledge Date: December 2023\n' +
      '\n' +
      "<|eot_id|><|start_header_id|>ipython<|end_header_id|>\n" +
      '\n' +
      "{'result': 123}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n" +
      '\n'
    );
  });

  test('MeetkaiFunctionary3_2', () => {
    const tmpl = new ChatTemplate(
      readTemplate('meetkai-functionary-medium-v3.2.jinja'), '', ''
    );

    const inputs = { messages: [messageTool] };

    assert.strictEqual(
      tmpl.apply(inputs),
      '<|start_header_id|>system<|end_header_id|>\n' +
      '\n' +
      'You are capable of executing available function(s) if required.\n' +
      'Only execute function(s) when absolutely necessary.\n' +
      'Ask for the required input to:recipient==all\n' +
      'Use JSON for function arguments.\n' +
      'Respond in this format:\n' +
      '>>>${recipient}\n' +
      '${content}\n' +
      'Available functions:\n' +
      '// Supported function definitions that should be called when necessary.\n' +
      'namespace functions {\n' +
      '\n' +
      '} // namespace functions<|eot_id|><|start_header_id|>tool<|end_header_id|>\n' +
      '\n' +
      "{'result': 123}<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n" +
      '\n' +
      '>>>'
    );
  });
});
