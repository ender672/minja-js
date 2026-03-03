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

function getCaps(filename) {
  const templateStr = readFileSync(join(TEMPLATES_DIR, filename), 'utf-8');
  return new ChatTemplate(templateStr, '', '').originalCaps();
}

describe('CapabilitiesTest', () => {
  test('Gemma7b', () => {
    const caps = getCaps('google-gemma-7b-it.jinja');
    assert.strictEqual(caps.supportsSystemRole, false);
    assert.strictEqual(caps.supportsTools, false);
    assert.strictEqual(caps.supportsToolCalls, false);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, false);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('QwQ32B', () => {
    const caps = getCaps('Qwen-QwQ-32B.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, true);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('Qwen3Coder', () => {
    const caps = getCaps('Qwen-Qwen3-Coder-30B-A3B-Instruct.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('DeepSeekR1Distill', () => {
    const caps = getCaps('deepseek-ai-DeepSeek-R1-Distill-Llama-70B.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, false);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('FunctionaryMediumV3_2', () => {
    const caps = getCaps('meetkai-functionary-medium-v3.2.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('MetaLlama3_1_8BInstruct', () => {
    const caps = getCaps('meta-llama-Llama-3.1-8B-Instruct.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('MetaLlama3_2_3BInstruct', () => {
    const caps = getCaps('meta-llama-Llama-3.2-3B-Instruct.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('MetaLlama3_3_70BInstruct', () => {
    const caps = getCaps('meta-llama-Llama-3.1-8B-Instruct.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('MiniMaxAIText01', () => {
    const caps = getCaps('MiniMaxAI-MiniMax-Text-01.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, false);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, false);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, true);
  });

  test('Mistral7BInstruct', () => {
    const caps = getCaps('mistralai-Mistral-7B-Instruct-v0.1.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, false);
    assert.strictEqual(caps.supportsToolCalls, false);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, false);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('MistralNemoInstruct', () => {
    const caps = getCaps('mistralai-Mistral-Nemo-Instruct-2407.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, true);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('NousResearchHermes3Llama3_1_70BToolUse', () => {
    const caps = getCaps('NousResearch-Hermes-3-Llama-3.1-70B-tool_use.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('NousResearchHermes2ProLlama3_8BToolUse', () => {
    const caps = getCaps('NousResearch-Hermes-3-Llama-3.1-70B-tool_use.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('CommandRPlusDefault', () => {
    const caps = getCaps('CohereForAI-c4ai-command-r-plus-default.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, false);
    assert.strictEqual(caps.supportsToolCalls, false);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, false);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, true);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('CommandRPlusRag', () => {
    const caps = getCaps('CohereForAI-c4ai-command-r-plus-rag.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, false);
    assert.strictEqual(caps.supportsToolCalls, false);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, false);
    assert.strictEqual(caps.supportsParallelToolCalls, false);
    assert.strictEqual(caps.requiresObjectArguments, false);
    assert.strictEqual(caps.requiresNonNullContent, true);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('CommandRPlusToolUse', () => {
    const caps = getCaps('CohereForAI-c4ai-command-r-plus-tool_use.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  test('GLM46', () => {
    const caps = getCaps('zai-org-GLM-4.6.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, true);
    assert.strictEqual(caps.supportsToolCalls, true);
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);
    assert.strictEqual(caps.requiresObjectArguments, true);
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });

  // Synthetic template based on DeepSeek V3.2's DSML format (encoding_dsv32.py)
  // V3.2 doesn't provide a Jinja template, so we replicate its Python encoding logic
  // DSML format: <｜DSML｜parameter name="argument_needle" string="true">
  test('SyntheticDeepSeekV3_2_DSML', () => {
    const caps = getCaps('synthetic-deepseek-v3.2-dsml.jinja');
    assert.strictEqual(caps.supportsSystemRole, true);
    assert.strictEqual(caps.supportsTools, false);         // No native tools block in template
    assert.strictEqual(caps.supportsToolCalls, true);      // Has tool_calls rendering with DSML format
    assert.strictEqual(caps.supportsToolCallId, false);
    assert.strictEqual(caps.supportsToolResponses, true);
    assert.strictEqual(caps.supportsParallelToolCalls, true);  // Iterates over tool_calls array
    assert.strictEqual(caps.requiresObjectArguments, true);    // DSML iterates over argument keys
    assert.strictEqual(caps.requiresNonNullContent, false);
    assert.strictEqual(caps.requiresTypedContent, false);
  });
});
