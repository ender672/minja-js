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

describe('ChatTemplateTest', () => {
  test('strftime_now', () => {
    const tmpl = new ChatTemplate("{{ strftime_now('%Y-%m-%d %H:%M:%S') }}", '', '');

    const result = tmpl.apply({}, {});

    assert.match(result, /\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  });
});
