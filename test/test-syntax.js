/*
    Copyright 2024 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
*/
// SPDX-License-Identifier: MIT

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser, Context } from '../src/minja.js';

/**
 * Render a template string with the given bindings and options.
 */
function render(templateStr, bindings = {}, options = {}) {
  const root = Parser.parse(templateStr, options);
  const context = Context.make(bindings);
  return root.render(context);
}

const lstrip_blocks = { trimBlocks: false, lstripBlocks: true, keepTrailingNewline: false };
const trim_blocks = { trimBlocks: true, lstripBlocks: false, keepTrailingNewline: false };
const lstrip_trim_blocks = { trimBlocks: true, lstripBlocks: true, keepTrailingNewline: false };

describe('SyntaxTest', () => {
  // ── String Methods ──────────────────────────────────────────────────

  describe('StringMethods', () => {
    test('strip', () => {
      assert.strictEqual(render("{{ ' a '.strip() }}"), 'a');
    });

    test('lstrip', () => {
      assert.strictEqual(render("{{ ' a '.lstrip() }}"), 'a ');
    });

    test('rstrip', () => {
      assert.strictEqual(render("{{ ' a '.rstrip() }}"), ' a');
    });

    test('strip with chars', () => {
      assert.strictEqual(render("{{ 'abcXYZabc'.strip('ac') }}"), 'bcXYZab');
    });

    test('split', () => {
      assert.strictEqual(render("{{ 'a b'.split(' ') | tojson }}"), '["a", "b"]');
    });

    test('capitalize', () => {
      assert.strictEqual(render("{{ 'ok'.capitalize() }}"), 'Ok');
    });

    test('replace', () => {
      assert.strictEqual(
        render("{{ 'abcXYZabcXYZabc'.replace('bc', 'oui') }}"),
        'aouiXYZaouiXYZaoui'
      );
    });

    test('replace with count', () => {
      assert.strictEqual(
        render("{{ 'abcXYZabcXYZabc'.replace('abc', 'ok', 2) }}"),
        'okXYZokXYZabc'
      );
    });

    test('replace no match', () => {
      assert.strictEqual(
        render("{{ 'abcXYZabcXYZabc'.replace('def', 'ok') }}"),
        'abcXYZabcXYZabc'
      );
    });

    test('upper', () => {
      assert.strictEqual(render("{{ 'hello world'.upper() }}"), 'HELLO WORLD');
    });

    test('upper mixed', () => {
      assert.strictEqual(render("{{ 'MiXeD'.upper() }}"), 'MIXED');
    });

    test('upper empty', () => {
      assert.strictEqual(render("{{ ''.upper() }}"), '');
    });

    test('lower', () => {
      assert.strictEqual(render("{{ 'HELLO WORLD'.lower() }}"), 'hello world');
    });

    test('lower mixed', () => {
      assert.strictEqual(render("{{ 'MiXeD'.lower() }}"), 'mixed');
    });

    test('lower empty', () => {
      assert.strictEqual(render("{{ ''.lower() }}"), '');
    });

    test('title', () => {
      assert.strictEqual(render("{{ 'foo bar'.title() }}"), 'Foo Bar');
    });

    test('startswith and endswith', () => {
      assert.strictEqual(
        render("{{ 'abc'.startswith('ab') }},{{ ''.startswith('a') }}"),
        'True,False'
      );
      assert.strictEqual(
        render("{{ 'abc'.endswith('bc') }},{{ ''.endswith('a') }}"),
        'True,False'
      );
    });
  });

  // ── Comments ────────────────────────────────────────────────────────

  describe('Comments', () => {
    test('block comments with whitespace stripping', () => {
      assert.strictEqual(
        render("{# Hey\nHo #}{#- Multiline...\nComments! -#}{{ 'ok' }}{# yo #}"),
        'ok'
      );
    });
  });

  // ── Whitespace Control ──────────────────────────────────────────────

  describe('WhitespaceControl', () => {
    test('lstrip_trim_blocks set', () => {
      assert.strictEqual(
        render("  {% set _ = 1 %}    {% set _ = 2 %}b", {}, lstrip_trim_blocks),
        '    b'
      );
    });

    test('lstrip_trim_blocks if with set', () => {
      assert.strictEqual(
        render("{%- if True %}        {% set _ = x %}{%- endif %}{{ 1 }}", {}, lstrip_trim_blocks),
        '        1'
      );
    });

    test('lstrip_blocks if/endif', () => {
      assert.strictEqual(
        render("    {% if True %}\n    {% endif %}", {}, lstrip_blocks),
        '\n'
      );
    });

    test('lstrip_trim_blocks if/endif', () => {
      assert.strictEqual(
        render("    {% if True %}\n    {% endif %}", {}, lstrip_trim_blocks),
        ''
      );
    });

    test('trim_blocks if/endif', () => {
      assert.strictEqual(
        render("    {% if True %}\n    {% endif %}", {}, trim_blocks),
        '        '
      );
    });

    test('set with no options', () => {
      assert.strictEqual(render("  {% set _ = 1 %}    "), '      ');
    });

    test('set with lstrip_blocks', () => {
      assert.strictEqual(render("  {% set _ = 1 %}    ", {}, lstrip_blocks), '    ');
    });

    test('set with trim_blocks', () => {
      assert.strictEqual(render("  {% set _ = 1 %}    ", {}, trim_blocks), '      ');
    });

    test('set with lstrip_trim_blocks', () => {
      assert.strictEqual(render("  {% set _ = 1 %}    ", {}, lstrip_trim_blocks), '    ');
    });

    test('multiline set no options', () => {
      assert.strictEqual(
        render("  \n    {% set _ = 1 %}        \n                "),
        '  \n            \n                '
      );
    });

    test('multiline set lstrip_blocks', () => {
      assert.strictEqual(
        render("  \n    {% set _ = 1 %}        \n                ", {}, lstrip_blocks),
        '  \n        \n                '
      );
    });

    test('multiline set trim_blocks', () => {
      assert.strictEqual(
        render("  \n    {% set _ = 1 %}        \n                ", {}, trim_blocks),
        '  \n            \n                '
      );
    });

    test('multiline set lstrip_trim_blocks', () => {
      assert.strictEqual(
        render("  \n    {% set _ = 1 %}        \n                ", {}, lstrip_trim_blocks),
        '  \n        \n                '
      );
    });

    test('set at line start no options', () => {
      assert.strictEqual(render("{% set _ = 1 %}\n  "), '\n  ');
    });

    test('set at line start lstrip_blocks', () => {
      assert.strictEqual(render("{% set _ = 1 %}\n  ", {}, lstrip_blocks), '\n  ');
    });

    test('set at line start trim_blocks', () => {
      assert.strictEqual(render("{% set _ = 1 %}\n  ", {}, trim_blocks), '  ');
    });

    test('set at line start lstrip_trim_blocks', () => {
      assert.strictEqual(render("{% set _ = 1 %}\n  ", {}, lstrip_trim_blocks), '  ');
    });

    const trim_tmpl = "\n  {% if true %}Hello{% endif %}  \n...\n\n";

    test('trim_tmpl with trim_blocks', () => {
      assert.strictEqual(render(trim_tmpl, {}, trim_blocks), '\n  Hello  \n...\n');
    });

    test('trim_tmpl default', () => {
      assert.strictEqual(render(trim_tmpl, {}, {}), '\n  Hello  \n...\n');
    });

    test('trim_tmpl lstrip_blocks', () => {
      assert.strictEqual(render(trim_tmpl, {}, lstrip_blocks), '\nHello  \n...\n');
    });

    test('trim_tmpl lstrip_trim_blocks', () => {
      assert.strictEqual(render(trim_tmpl, {}, lstrip_trim_blocks), '\nHello  \n...\n');
    });

    test('expression dash left strip', () => {
      assert.strictEqual(render("  {{- 'a' -}}{{ '  ' }}{{- 'b' -}}  "), 'a  b');
    });

    test('expression dash with trim_blocks', () => {
      assert.strictEqual(render("  {{- ' a\\n'}}", {}, trim_blocks), " a\n");
    });

    test('space around expression dash', () => {
      assert.strictEqual(render(" {{ \"a\" -}} b {{- \"c\" }} "), ' abc ');
    });

    test('newline with left dash expression', () => {
      assert.strictEqual(render(" a {{  'b' -}} c "), ' a bc ');
    });

    test('newline with right dash expression', () => {
      assert.strictEqual(render(" a {{- 'b'  }} c "), ' ab c ');
    });

    test('newline dash left on expression', () => {
      assert.strictEqual(render("a\n{{- 'b'  }}\nc"), 'ab\nc');
    });

    test('newline dash right on expression', () => {
      assert.strictEqual(render("a\n{{  'b' -}}\nc"), 'a\nbc');
    });

    test('trailing newline removed by default', () => {
      assert.strictEqual(render("a\nb\n"), 'a\nb');
    });

    test('if-endif dash for/endfor empty', () => {
      assert.strictEqual(
        render("{%- if True %}{%- endif %}{{ '        ' }}{%- for x in [] %}foo{% endfor %}end"),
        '        end'
      );
    });
  });

  // ── Filters ─────────────────────────────────────────────────────────

  describe('Filters', () => {
    test('int filter on various types', () => {
      assert.strictEqual(
        render("{% for i in [true, false, 10, -10, 10.1, -10.1, None, 'a', '2', {}, [1]] %}{{ i | int }}, {% endfor %}"),
        '1, 0, 10, -10, 10, -10, 0, 0, 2, 0, 0, '
      );
    });

    test('trim filter', () => {
      assert.strictEqual(render("{{ ' a  ' | trim }}"), 'a');
    });

    test('trim filter on None', () => {
      assert.strictEqual(render("{{ None | trim }}"), '');
    });

    test('lower filter', () => {
      assert.strictEqual(render("{{ 'AbC' | lower }}"), 'abc');
    });

    test('upper filter', () => {
      assert.strictEqual(render("{{ 'me' | upper }}"), 'ME');
    });

    test('safe filter', () => {
      assert.strictEqual(render("{{ 1 | safe }}"), '1');
    });

    test('escape filter', () => {
      assert.strictEqual(
        render(
          '{%- set res = [] -%}' +
          '{%- for c in ["<", ">", "&", \'"\'] -%}' +
          '  {%- set _ = res.append(c | e) -%}' +
          '{%- endfor -%}' +
          '{{- res | join(", ") -}}'
        ),
        '&lt;, &gt;, &amp;, &#34;'
      );
    });

    test('default filter', () => {
      assert.strictEqual(
        render("{{ foo | default('the default') }}{{ 1 | default('nope') }}"),
        'the default1'
      );
    });

    test('default filter with boolean mode', () => {
      assert.strictEqual(
        render("{{ '' | default('the default', true) }}{{ 1 | default('nope', true) }}"),
        'the default1'
      );
    });

    test('indent filter', () => {
      assert.strictEqual(
        render("{% set txt = 'a\\nb\\n' %}{{ txt | indent(2) }}|{{ txt | indent(2, first=true) }}"),
        'a\n  b\n|  a\n  b\n'
      );
    });

    test('tojson filter', () => {
      assert.strictEqual(render('{{ {"a": "b"} | tojson }}'), '{"a": "b"}');
    });

    test('tojson with indent', () => {
      assert.strictEqual(
        render("{% set x = [] %}{% set _ = x.append(1) %}{{ x | tojson(indent=2) }}"),
        '[\n  1\n]'
      );
    });

    test('tojson on various types', () => {
      assert.strictEqual(
        render(
          '{%- for x in [1, 1.2, "a", true, True, false, False, None, [], [1], [1, 2], {}, {"a": 1}, {1: "b"}] -%}' +
          '{{- x | tojson -}},' +
          '{%- endfor -%}'
        ),
        '1,1.2,"a",true,true,false,false,null,[],[1],[1, 2],{},{"a": 1},{"1": "b"},'
      );
    });

    test('length filter', () => {
      assert.strictEqual(render('{{ "123456789" | length }}'), '9');
    });

    test('join filter', () => {
      assert.strictEqual(render("{{ [1, 2, 3] | join(', ') }}"), '1, 2, 3');
    });

    test('join filter with concat', () => {
      assert.strictEqual(render("{{ [1, 2, 3] | join(', ') + '...' }}"), '1, 2, 3...');
    });

    test('list filter from range', () => {
      assert.strictEqual(render("{{ range(3) | list }}"), '[0, 1, 2]');
    });

    test('unique filter', () => {
      assert.strictEqual(
        render("{{ [1, False, 2, '3', 1, '3', False] | unique | list }}"),
        "[1, False, 2, '3']"
      );
    });

    test('last filter', () => {
      assert.strictEqual(render("{{ range(3) | last }}"), '2');
    });

    test('first filter', () => {
      assert.strictEqual(render("{{ range(3) | first }}"), '0');
    });

    test('capitalize filter', () => {
      assert.strictEqual(render("{{ 'aBc' | capitalize }}"), 'Abc');
    });

    test('dictsort filter', () => {
      assert.strictEqual(
        render("{{ {1: 2, 3: 4, 5: 7} | dictsort | tojson }}"),
        '[[1, 2], [3, 4], [5, 7]]'
      );
    });

    test('items filter', () => {
      assert.strictEqual(render("{{ {1: 2} | items | list | tojson }}"), '[[1, 2]]');
    });

    test('items method with map', () => {
      assert.strictEqual(
        render('{{ {1: 2}.items() | map("list") | list }}'),
        '[[1, 2]]'
      );
    });

    test('select filter with in', () => {
      assert.strictEqual(
        render("{{ ['a', 'b', 'c', 'a'] | select('in', ['a']) | list }}"),
        "['a', 'a']"
      );
    });

    test('reject filter with equalto', () => {
      assert.strictEqual(
        render("{{ 'Tools: ' + [1, 2, 3] | reject('equalto', 2) | join(', ') + '...' }}"),
        'Tools: 1, 3...'
      );
    });

    test('select filter with equalto', () => {
      assert.strictEqual(
        render("{{ 'Tools: ' + [1, 2, 3] | select('equalto', 2) | join(', ') + '...' }}"),
        'Tools: 2...'
      );
    });

    test('selectattr filter', () => {
      assert.strictEqual(
        render('{{ [{"a": 1}, {"a": 2}, {}] | selectattr("a", "equalto", 1) | list }}'),
        "[{'a': 1}]"
      );
    });

    test('rejectattr filter', () => {
      assert.strictEqual(
        render('{{ [{"a": 1}, {"a": 2}, {}] | rejectattr("a", "equalto", 1) | list }}'),
        "[{'a': 2}, {}]"
      );
    });

    test('selectattr on none', () => {
      assert.strictEqual(
        render('{{ none | selectattr("foo", "equalto", "bar") | list }}'),
        '[]'
      );
    });

    test('map with attribute', () => {
      assert.strictEqual(
        render('{{ [{"a": 1}, {"a": 2}] | map(attribute="a") | list }}'),
        '[1, 2]'
      );
    });

    test('map with function', () => {
      assert.strictEqual(
        render('{{ ["", "a"] | map("length") | list }}'),
        '[0, 1]'
      );
    });

});

  // ── Expressions & Operators ─────────────────────────────────────────

  describe('Expressions', () => {
    test('string slicing', () => {
      assert.strictEqual(render('{{ "abcd"[1:-1] }}'), 'bc');
    });

    test('array slicing', () => {
      assert.strictEqual(render('{{ [0, 1, 2, 3][1:-1] }}'), '[1, 2]');
    });

    test('array slicing from index', () => {
      assert.strictEqual(
        render("{% set x = [0, 1, 2, 3] %}{{ x[1:] }}{{ x[:2] }}{{ x[1:3] }}"),
        '[1, 2, 3][0, 1][1, 2]'
      );
    });

    test('string slicing variants', () => {
      assert.strictEqual(
        render("{% set x = '0123' %}{{ x[1:] }};{{ x[:2] }};{{ x[1:3] }};{{ x[:] }};{{ x[::] }}"),
        '123;01;12;0123;0123'
      );
    });

    test('array slicing with step', () => {
      assert.strictEqual(
        render("{% set x = [0, 1, 2, 3] %}{{ x[::-1] }}{{ x[:0:-1] }}{{ x[2::-1] }}{{ x[2:0:-1] }}{{ x[::2] }}{{ x[::-2] }}{{ x[-2::-2] }}"),
        '[3, 2, 1, 0][3, 2, 1][2, 1, 0][2, 1][0, 2][3, 1][2, 0]'
      );
    });

    test('string slicing with step', () => {
      assert.strictEqual(
        render("{% set x = '0123' %}{{ x[::-1] }};{{ x[:0:-1] }};{{ x[2::-1] }};{{ x[2:0:-1] }};{{ x[::2] }};{{ x[::-2] }};{{ x[-2::-2] }}"),
        '3210;321;210;21;02;31;20'
      );
    });

    test('array concatenation', () => {
      assert.strictEqual(render("{{ [1] + [2, 3] }}"), '[1, 2, 3]');
    });

    test('string concatenation with length', () => {
      assert.strictEqual(render("{{ 'a' + [] | length | string + 'b' }}"), 'a0b');
    });

    test('string multiplication', () => {
      assert.strictEqual(render("{{ 'ab' * 3 }}"), 'ababab');
    });

    test('tilde concatenation', () => {
      assert.strictEqual(
        render("{% set foo %}Hello {{ 'there' }}{% endset %}{{ 1 ~ foo ~ 2 }}"),
        '1Hello there2'
      );
    });

    test('tilde concat with set', () => {
      assert.strictEqual(
        render(
          '{%- set user = "Olivier" -%}' +
          '{%- set greeting = "Hello " ~ user -%}' +
          '{{- greeting -}}'
        ),
        'Hello Olivier'
      );
    });

    test('modulo operator', () => {
      assert.strictEqual(render("{{ range(5) | length % 2 }}"), '1');
    });

    test('comparison with modulo', () => {
      assert.strictEqual(
        render("{{ range(5) | length % 2 == 1 }},{{ [] | length > 0 }}"),
        'True,False'
      );
    });

    test('equality comparison', () => {
      assert.strictEqual(
        render(
          "{{ messages[0]['role'] != 'system' }}",
          { messages: [{ role: 'system' }] }
        ),
        'False'
      );
    });

    test('in operator on dict', () => {
      assert.strictEqual(
        render("{{ 'a' in {\"a\": 1} }},{{ 'a' in {} }}"),
        'True,False'
      );
    });

    test('in operator on array', () => {
      assert.strictEqual(
        render('{{ \'a\' in ["a"] }},{{ \'a\' in [] }}'),
        'True,False'
      );
    });

    test('in operator on string', () => {
      assert.strictEqual(
        render("{{ 'a' in 'abc' }},{{ 'd' in 'abc' }}"),
        'True,False'
      );
    });

    test('not in operator on string', () => {
      assert.strictEqual(
        render("{{ 'a' not in 'abc' }},{{ 'd' not in 'abc' }}"),
        'False,True'
      );
    });

    test('not on empty array', () => {
      assert.strictEqual(render("{{ not [] }}"), 'True');
    });

    test('property access', () => {
      assert.strictEqual(
        render("{{ (a.b.c) }}", { a: { b: { c: 3 } } }),
        '3'
      );
    });

    test('deep property access function name', () => {
      assert.strictEqual(
        render(
          "{{ tool.function.name == 'ipython' }}",
          { tool: { function: { name: 'ipython' } } }
        ),
        'True'
      );
    });

    test('negative indexing', () => {
      assert.strictEqual(render("{{ [1, 2, 3][-1] }}"), '3');
    });

    test('dict display', () => {
      assert.strictEqual(render('{{ {"a": "b"} }}'), "{'a': 'b'}");
    });

    // ── Type Tests ──────────────────────────────────────────────────

    test('is mapping', () => {
      assert.strictEqual(render("{{ {} is mapping }},{{ '' is mapping }}"), 'True,False');
    });

    test('is iterable', () => {
      assert.strictEqual(render("{{ {} is iterable }},{{ '' is iterable }}"), 'True,True');
    });

    test('is iterable array', () => {
      assert.strictEqual(render("{{ [] is iterable }}"), 'True');
    });

    test('is defined', () => {
      assert.strictEqual(render("{% set foo = true %}{{ foo is defined }}"), 'True');
    });

    test('not is defined', () => {
      assert.strictEqual(render("{% set foo = true %}{{ not foo is defined }}"), 'False');
    });

    test('is true', () => {
      assert.strictEqual(render("{% set foo = true %}{{ foo is true }}"), 'True');
    });

    test('is false', () => {
      assert.strictEqual(render("{% set foo = true %}{{ foo is false }}"), 'False');
    });

    test('is not true', () => {
      assert.strictEqual(render("{% set foo = false %}{{ foo is not true }}"), 'True');
    });

    test('is not false', () => {
      assert.strictEqual(render("{% set foo = false %}{{ foo is not false }}"), 'False');
    });

    test('is not string', () => {
      assert.strictEqual(render("{{ 1 is not string }}"), 'True');
    });

    test('is not number', () => {
      assert.strictEqual(render("{{ [] is not number }}"), 'True');
    });

    test('chaining function call and method call', () => {
      assert.strictEqual(render("{{ trim(' a ').endswith(' ') }}"), 'False');
    });
  });

  // ── Control Flow ────────────────────────────────────────────────────

  describe('ControlFlow', () => {
    test('for loop with array', () => {
      assert.strictEqual(
        render('{% for x in ["a", "b"] %}{{ x }},{% endfor %}'),
        'a,b,'
      );
    });

    test('for loop with dict', () => {
      assert.strictEqual(
        render('{% for x in {"a": 1, "b": 2} %}{{ x }},{% endfor %}'),
        'a,b,'
      );
    });

    test('for loop with string', () => {
      assert.strictEqual(render('{% for x in "ab" %}{{ x }},{% endfor %}'), 'a,b,');
    });

    test('for with tuple destructuring', () => {
      assert.strictEqual(
        render(
          '{%- for x, y in [("a", "b"), ("c", "d")] -%}' +
          '{{- x }},{{ y -}};' +
          '{%- endfor -%}'
        ),
        'a,b;c,d;'
      );
    });

    test('for with tuple destructuring from binding', () => {
      assert.strictEqual(
        render(
          '{%- for x, y in z -%}' +
          '{{- x }},{{ y -}};' +
          '{%- endfor -%}',
          { z: [[1, 10], [2, 20]] }
        ),
        '1,10;2,20;'
      );
    });

    test('for with range', () => {
      assert.strictEqual(render("{% for i in range(3) %}{{i}},{% endfor %}"), '0,1,2,');
    });

    test('for with else (empty iterable)', () => {
      assert.strictEqual(render("{%- for i in range(0) -%}NAH{% else %}OK{% endfor %}"), 'OK');
    });

    test('loop.first, loop.last, loop.index', () => {
      assert.strictEqual(
        render(
          '{%- for x in range(3) -%}' +
          '{%- if loop.first -%}' +
          'but first, mojitos!' +
          '{%- endif -%}' +
          '{{ loop.index }}{{ "," if not loop.last -}}' +
          '{%- endfor -%}'
        ),
        'but first, mojitos!1,2,3'
      );
    });

    test('loop.cycle', () => {
      assert.strictEqual(
        render(
          '{%- for i in range(5) -%}' +
          '({{ i }}, {{ loop.cycle(\'odd\', \'even\') }}),' +
          '{%- endfor -%}'
        ),
        '(0, odd),(1, even),(2, odd),(3, even),(4, odd),'
      );
    });

    test('loop variables with conditional for', () => {
      assert.strictEqual(
        render(
          "{%- for i in range(5) if i % 2 == 0 -%}\n" +
          "{{ i }}, first={{ loop.first }}, last={{ loop.last }}, index={{ loop.index }}, index0={{ loop.index0 }}, revindex={{ loop.revindex }}, revindex0={{ loop.revindex0 }}, prev={{ loop.previtem }}, next={{ loop.nextitem }},\n" +
          "{% endfor -%}"
        ),
        "0, first=True, last=False, index=1, index0=0, revindex=3, revindex0=2, prev=, next=2,\n" +
        "2, first=False, last=False, index=2, index0=1, revindex=2, revindex0=1, prev=0, next=4,\n" +
        "4, first=False, last=True, index=3, index0=2, revindex=1, revindex0=0, prev=2, next=,\n"
      );
    });

    test('if/elif/else empty bodies', () => {
      assert.strictEqual(render("{% if 1 %}{% elif 1 %}{% else %}{% endif %}"), '');
    });

    test('break', () => {
      assert.strictEqual(
        render("{% for i in range(10) %}{{ i }},{% if i == 2 %}{% break %}{% endif %}{% endfor %}"),
        '0,1,2,'
      );
    });

    test('continue', () => {
      assert.strictEqual(
        render("{% for i in range(10) %}{% if i % 2 %}{% continue %}{% endif %}{{ i }},{% endfor %}"),
        '0,2,4,6,8,'
      );
    });
  });

  // ── Set & Namespace ─────────────────────────────────────────────────

  describe('SetAndNamespace', () => {
    test('namespace basic', () => {
      assert.strictEqual(
        render("{% set ns = namespace(is_first=false, nottool=false, and_or=true, delme='') %}{{ ns.is_first }}"),
        'False'
      );
    });

    test('namespace get and set', () => {
      assert.strictEqual(
        render(
          "{%- set n = namespace(value=1, title='') -%}" +
          "{{- n.value }} \"{{ n.title }}\"," +
          "{%- set n.value = 2 -%}" +
          "{%- set n.title = 'Hello' -%}" +
          "{{- n.value }} \"{{ n.title }}\""
        ),
        '1 "",2 "Hello"'
      );
    });

    test('set block form', () => {
      assert.strictEqual(
        render("{% set foo %}Hello {{ 'there' }}{% endset %}{{ 1 ~ foo ~ 2 }}"),
        '1Hello there2'
      );
    });

    test('set with method call on binding', () => {
      assert.strictEqual(
        render(
          "{% set _ = a.b.append(c.d.e) %}{{ a.b }}",
          { a: { b: [1, 2] }, c: { d: { e: 3 } } }
        ),
        '[1, 2, 3]'
      );
    });
  });

  // ── Macros ──────────────────────────────────────────────────────────

  describe('Macros', () => {
    test('basic macro with args and defaults', () => {
      assert.strictEqual(
        render(
          '{%- set x = 1 -%}' +
          '{%- set y = 2 -%}' +
          '{%- macro foo(x, z, w=10) -%}' +
          'x={{ x }}, y={{ y }}, z={{ z }}, w={{ w -}}' +
          '{%- endmacro -%}' +
          '{{- foo(100, 3) -}}'
        ),
        'x=100, y=2, z=3, w=10'
      );
    });

    test('macro with kwargs', () => {
      assert.strictEqual(
        render(
          "\n" +
          "            {% macro input(name, value='', type='text', size=20) -%}\n" +
          '                <input type="{{ type }}" name="{{ name }}" value="{{ value|e }}" size="{{ size }}">\n' +
          "            {%- endmacro -%}\n" +
          "\n" +
          "            <p>{{ input('username') }}</p>\n" +
          "            <p>{{ input('password', type='password') }}</p>"
        ),
        '\n            <p><input type="text" name="username" value="" size="20"></p>\n' +
        '            <p><input type="password" name="password" value="" size="20"></p>'
      );
    });

    test('macro mutable default args fresh per call', () => {
      assert.strictEqual(
        render(
          '{#- The values\' default array should be created afresh at each call, unlike the equivalent Python function -#}' +
          '{%- macro foo(values=[]) -%}' +
          '{%- set _ = values.append(1) -%}' +
          '{{- values -}}' +
          '{%- endmacro -%}' +
          '{{- foo() }} {{ foo() -}}'
        ),
        '[1] [1]'
      );
    });

    test('macro captures outer variable', () => {
      // The macro foo captures outer y=2
      assert.strictEqual(
        render(
          '{%- set x = 1 -%}' +
          '{%- set y = 2 -%}' +
          '{%- macro foo(x, z, w=10) -%}' +
          'x={{ x }}, y={{ y }}, z={{ z }}, w={{ w -}}' +
          '{%- endmacro -%}' +
          '{{- foo(100, 3) -}}'
        ),
        'x=100, y=2, z=3, w=10'
      );
    });
  });

  // ── Call Blocks ─────────────────────────────────────────────────────

  describe('CallBlocks', () => {
    test('simple call/endcall with caller', () => {
      assert.strictEqual(
        render(
          '{%- macro test() -%}{{ caller() }},{{ caller() }}{%- endmacro -%}' +
          '{%- call test() -%}x{%- endcall -%}'
        ),
        'x,x'
      );
    });

    test('nested call blocks', () => {
      assert.strictEqual(
        render(
          '{%- macro outer() -%}Outer[{{ caller() }}]{%- endmacro -%}' +
          '{%- macro inner() -%}Inner({{ caller() }}){%- endmacro -%}' +
          '{%- call outer() -%}{%- call inner() -%}X{%- endcall -%}{%- endcall -%}'
        ),
        'Outer[Inner(X)]'
      );
    });

    test('call with parameters and loop', () => {
      assert.strictEqual(
        render(
          '{%- macro test(prefix, suffix) -%}{{ prefix }}{{ caller() }}{{ suffix }}{%- endmacro -%}' +
          '{%- set items = ["a", "b"] -%}' +
          '{%- call test("<ul>", "</ul>") -%}' +
          '{%- for item in items -%}' +
          '<li>{{ item | upper }}</li>' +
          '{%- endfor -%}' +
          '{%- endcall -%}'
        ),
        '<ul><li>A</li><li>B</li></ul>'
      );
    });

    test('recursive call block', () => {
      assert.strictEqual(
        render(
          '{%- macro recursive(obj) -%}' +
          '{%- set ns = namespace(content = caller()) -%}' +
          '{%- for key, value in obj.items() %}' +
          '{%- if value is mapping %}' +
          '{%- call recursive(value) -%}' +
          "{{ '\\\\n\\\\nclass ' + key.title() + ':\\\\n' }}" +
          '{%- endcall -%}' +
          '{%- else -%}' +
          "{%- set ns.content = ns.content + '  ' + key + ': ' + value + '\\\\n' -%}" +
          '{%- endif -%}' +
          '{%- endfor -%}' +
          '{{ ns.content }}' +
          '{%- endmacro -%}' +
          '' +
          '{%- call recursive({"a": {"b": "1", "c": "2"}}) -%}' +
          '{%- endcall -%}'
        ),
        '\\n\\nclass A:\\n  b: 1\\n  c: 2\\n'
      );
    });
  });

  // ── Filter Blocks ───────────────────────────────────────────────────

  describe('FilterBlocks', () => {
    test('filter trim block', () => {
      assert.strictEqual(render("{% filter trim %} abc {% endfilter %}"), 'abc');
    });
  });

  // ── Generation Block ────────────────────────────────────────────────

  describe('GenerationBlock', () => {
    test('generation block', () => {
      assert.strictEqual(render("{% generation %}Foo{% endgeneration %}"), 'Foo');
    });
  });

  // ── Collection Methods ──────────────────────────────────────────────

  describe('CollectionMethods', () => {
    test('array pop and pop(index)', () => {
      assert.strictEqual(
        render(
          '{%- set o = [0, 1, 2, 3] -%}' +
          '{%- set _ = o.pop() -%}' +
          '{{- o | tojson -}}' +
          '{%- set _ = o.pop(1) -%}' +
          '{{- o | tojson -}}'
        ),
        '[0, 1, 2][0, 2]'
      );
    });

    test('dict pop', () => {
      assert.strictEqual(
        render(
          '{%- set o = {"x": 1, "y": 2} -%}' +
          '{%- set _ = o.pop("x") -%}' +
          '{{- o | tojson -}}'
        ),
        '{"y": 2}'
      );
    });

    test('dict get', () => {
      assert.strictEqual(
        render("{{ {1: 2}.get(1) }}; {{ {}.get(1) or '' }}; {{ {}.get(1, 10) }}"),
        '2; ; 10'
      );
    });

    test('dict keys', () => {
      assert.strictEqual(
        render("{{ {'a': 1, 'b': 2}.keys() | list }},{{ {}.keys() | list }}"),
        "['a', 'b'],[]"
      );
    });

    test('range with unpacking', () => {
      assert.strictEqual(render("{{ range(*[2,4]) | list }}"), '[2, 3]');
    });

    test('array append via set', () => {
      assert.strictEqual(
        render(
          "{% set _ = a.b.append(c.d.e) %}{{ a.b }}",
          { a: { b: [1, 2] }, c: { d: { e: 3 } } }
        ),
        '[1, 2, 3]'
      );
    });
  });

  // ── Built-in Functions ──────────────────────────────────────────────

  describe('BuiltinFunctions', () => {
    test('range variants', () => {
      assert.strictEqual(
        render("{{ range(3) | list }}{{ range(4, 7) | list }}{{ range(0, 10, 2) | list }}"),
        '[0, 1, 2][4, 5, 6][0, 2, 4, 6, 8]'
      );
    });

    test('joiner', () => {
      assert.strictEqual(
        render(
          '{%- set separator = joiner(\' | \') -%}' +
          '{%- for item in ["a", "b", "c"] %}{{ separator() }}{{ item }}{% endfor -%}'
        ),
        'a | b | c'
      );
    });

    test('namespace function', () => {
      assert.strictEqual(
        render("{% set ns = namespace(is_first=false, nottool=false, and_or=true, delme='') %}{{ ns.is_first }}"),
        'False'
      );
    });
  });

  // ── Error Cases ─────────────────────────────────────────────────────

  describe('ErrorCases', () => {
    test('items on string throws', () => {
      assert.throws(
        () => render("{{ '' | items }}"),
        { message: /Can only get item pairs from a mapping/ }
      );
    });

    test('items on array throws', () => {
      assert.throws(
        () => render("{{ [] | items }}"),
        { message: /Can only get item pairs from a mapping/ }
      );
    });

    test('items on None throws', () => {
      assert.throws(
        () => render("{{ None | items }}"),
        { message: /Can only get item pairs from a mapping/ }
      );
    });

    test('break outside loop throws', () => {
      assert.throws(
        () => render("{% break %}"),
        { message: /break outside of a loop/ }
      );
    });

    test('continue outside loop throws', () => {
      assert.throws(
        () => render("{% continue %}"),
        { message: /continue outside of a loop/ }
      );
    });

    test('pop from empty list throws', () => {
      assert.throws(
        () => render("{%- set _ = [].pop() -%}"),
        { message: /pop from empty list/ }
      );
    });

    test('pop from empty dict throws', () => {
      assert.throws(
        () => render("{%- set _ = {}.pop() -%}"),
        { message: /pop/ }
      );
    });

    test('pop missing key from dict throws', () => {
      assert.throws(
        () => render("{%- set _ = {}.pop('foooo') -%}"),
        { message: /foooo/ }
      );
    });

    test('unexpected else throws', () => {
      assert.throws(
        () => render("{% else %}"),
        { message: /Unexpected else/ }
      );
    });

    test('unexpected endif throws', () => {
      assert.throws(
        () => render("{% endif %}"),
        { message: /Unexpected endif/ }
      );
    });

    test('unexpected elif throws', () => {
      assert.throws(
        () => render("{% elif 1 %}"),
        { message: /Unexpected elif/ }
      );
    });

    test('unexpected endfor throws', () => {
      assert.throws(
        () => render("{% endfor %}"),
        { message: /Unexpected endfor/ }
      );
    });

    test('unexpected endfilter throws', () => {
      assert.throws(
        () => render("{% endfilter %}"),
        { message: /Unexpected endfilter/ }
      );
    });

    test('unexpected endmacro throws', () => {
      assert.throws(
        () => render("{% endmacro %}"),
        { message: /Unexpected endmacro/ }
      );
    });

    test('unexpected endcall throws', () => {
      assert.throws(
        () => render("{% endcall %}"),
        { message: /Unexpected endcall/ }
      );
    });

    test('unterminated if', () => {
      assert.throws(
        () => render("{% if 1 %}"),
        { message: /Unterminated if/ }
      );
    });

    test('unterminated for', () => {
      assert.throws(
        () => render("{% for x in 1 %}"),
        { message: /Unterminated for/ }
      );
    });

    test('unterminated generation', () => {
      assert.throws(
        () => render("{% generation %}"),
        { message: /Unterminated generation/ }
      );
    });

    test('unterminated if with else', () => {
      assert.throws(
        () => render("{% if 1 %}{% else %}"),
        { message: /Unterminated if/ }
      );
    });

    test('elif after else', () => {
      assert.throws(
        () => render("{% if 1 %}{% else %}{% elif 1 %}{% endif %}"),
        { message: /Unterminated if/ }
      );
    });

    test('unterminated filter', () => {
      assert.throws(
        () => render("{% filter trim %}"),
        { message: /Unterminated filter/ }
      );
    });

    test('unterminated comment', () => {
      assert.throws(
        () => render("{# "),
        { message: /Missing end of comment tag/ }
      );
    });

    test('unterminated macro', () => {
      assert.throws(
        () => render("{% macro test() %}"),
        { message: /Unterminated macro/ }
      );
    });

    test('unterminated call', () => {
      assert.throws(
        () => render("{% call test %}"),
        { message: /Unterminated call/ }
      );
    });

    test('invalid call block syntax', () => {
      assert.throws(
        () => render("{%- macro test() -%}content{%- endmacro -%}{%- call test -%}caller_content{%- endcall -%}"),
        { message: /Invalid call block syntax/ }
      );
    });
  });
});
