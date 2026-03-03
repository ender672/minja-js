/*
    Copyright 2024 Google LLC

    Use of this source code is governed by an MIT-style
    license that can be found in the LICENSE file or at
    https://opensource.org/licenses/MIT.
*/
// SPDX-License-Identifier: MIT

import { Parser, Context, Value, parseTemplate } from './minja.js';

export class ChatTemplate {
  constructor(source, bosToken = '', eosToken = '') {
    this._source = source;
    this._bosToken = bosToken;
    this._eosToken = eosToken;
    this._templateRoot = parseTemplate(source, {
      trimBlocks: true,
      lstripBlocks: true,
      keepTrailingNewline: false,
    });
    this._toolCallExample = '';
    this._caps = {
      supportsTools: false,
      supportsToolCalls: false,
      supportsToolResponses: false,
      supportsSystemRole: false,
      supportsParallelToolCalls: false,
      supportsToolCallId: false,
      requiresObjectArguments: false,
      requiresNonNullContent: false,
      requiresTypedContent: false,
    };

    this._detectCapabilities();
  }

  _tryRawRender(messages, tools, addGenerationPrompt, extraContext) {
    try {
      const inputs = {
        messages,
        tools,
        addGenerationPrompt,
        extraContext,
        now: new Date(0), // epoch for tests
      };
      const opts = {
        applyPolyfills: false,
      };
      return this.apply(inputs, opts);
    } catch (e) {
      return '';
    }
  }

  _detectCapabilities() {
    const contains = (haystack, needle) => haystack.includes(needle);

    const userNeedle = '<User Needle>';
    const sysNeedle = '<System Needle>';
    const dummyStrUserMsg = { role: 'user', content: userNeedle };
    const dummyTypedUserMsg = {
      role: 'user',
      content: [{ type: 'text', text: userNeedle }],
    };

    this._caps.requiresTypedContent =
      !contains(this._tryRawRender([dummyStrUserMsg], undefined, false), userNeedle) &&
      contains(this._tryRawRender([dummyTypedUserMsg], undefined, false), userNeedle);

    const dummyUserMsg = this._caps.requiresTypedContent
      ? dummyTypedUserMsg
      : dummyStrUserMsg;
    const needleSystemMsg = {
      role: 'system',
      content: this._caps.requiresTypedContent
        ? [{ type: 'text', text: sysNeedle }]
        : sysNeedle,
    };

    this._caps.supportsSystemRole = contains(
      this._tryRawRender([needleSystemMsg, dummyUserMsg], undefined, false),
      sysNeedle
    );

    let out = this._tryRawRender(
      [dummyUserMsg],
      [
        {
          name: 'some_tool',
          type: 'function',
          function: {
            name: 'some_tool',
            description: 'Some tool.',
            parameters: {
              type: 'object',
              properties: {
                arg: {
                  type: 'string',
                  description: 'Some argument.',
                },
              },
              required: ['arg'],
            },
          },
        },
      ],
      false
    );
    this._caps.supportsTools = contains(out, 'some_tool');

    const renderWithContent = (content) => {
      const assistantMsg = { role: 'assistant', content };
      return this._tryRawRender(
        [dummyUserMsg, assistantMsg, dummyUserMsg, assistantMsg],
        undefined,
        false
      );
    };
    const outEmpty = renderWithContent('');
    const outNull = renderWithContent(null);
    this._caps.requiresNonNullContent =
      contains(outEmpty, userNeedle) && !contains(outNull, userNeedle);

    const makeToolCallsMsg = (toolCalls) => ({
      role: 'assistant',
      content: this._caps.requiresNonNullContent ? '' : null,
      tool_calls: toolCalls,
    });
    const makeToolCall = (toolName, args) => ({
      id: 'call_1___',
      type: 'function',
      function: {
        arguments: args,
        name: toolName,
      },
    });
    const dummyArgsObj = { argument_needle: "print('Hello, World!')" };
    const containsArgNeedle = (s) =>
      contains(s, '<parameter=argument_needle>') ||
      contains(s, '"argument_needle"') ||
      contains(s, "'argument_needle':") ||
      contains(s, '>argument_needle<');

    // Test with string arguments
    out = this._tryRawRender(
      [
        dummyUserMsg,
        makeToolCallsMsg([makeToolCall('ipython', JSON.stringify(dummyArgsObj))]),
      ],
      undefined,
      false
    );
    const toolCallRendersStrArguments = containsArgNeedle(out);

    // Test with object arguments
    out = this._tryRawRender(
      [
        dummyUserMsg,
        makeToolCallsMsg([makeToolCall('ipython', dummyArgsObj)]),
      ],
      undefined,
      false
    );
    const toolCallRendersObjArguments = containsArgNeedle(out);

    this._caps.supportsToolCalls = toolCallRendersStrArguments || toolCallRendersObjArguments;
    this._caps.requiresObjectArguments = !toolCallRendersStrArguments && toolCallRendersObjArguments;

    if (this._caps.supportsToolCalls) {
      const dummyArgs = this._caps.requiresObjectArguments
        ? dummyArgsObj
        : JSON.stringify(dummyArgsObj);
      const tc1 = makeToolCall('test_tool1', dummyArgs);
      const tc2 = makeToolCall('test_tool2', dummyArgs);
      out = this._tryRawRender(
        [dummyUserMsg, makeToolCallsMsg([tc1, tc2])],
        undefined,
        false
      );
      this._caps.supportsParallelToolCalls =
        contains(out, 'test_tool1') && contains(out, 'test_tool2');

      out = this._tryRawRender(
        [
          dummyUserMsg,
          makeToolCallsMsg([tc1]),
          {
            role: 'tool',
            name: 'test_tool1',
            content: 'Some response!',
            tool_call_id: 'call_911_',
          },
        ],
        undefined,
        false
      );
      this._caps.supportsToolResponses = contains(out, 'Some response!');
      this._caps.supportsToolCallId = contains(out, 'call_911_');
    }

    // Generate tool call example for polyfill
    try {
      if (!this._caps.supportsTools) {
        const userMsg = { role: 'user', content: 'Hey' };
        const args = { arg1: 'some_value' };
        const toolCallMsg = {
          role: 'assistant',
          content: this._caps.requiresNonNullContent ? '' : null,
          tool_calls: [
            {
              id: 'call_1___',
              type: 'function',
              function: {
                name: 'tool_name',
                arguments: this._caps.requiresObjectArguments
                  ? args
                  : Value.fromJS(args).dump(-1, true),
              },
            },
          ],
        };

        let prefix, full;
        prefix = this.apply({ messages: [userMsg], addGenerationPrompt: true });
        full = this.apply({
          messages: [userMsg, toolCallMsg],
          addGenerationPrompt: false,
        });

        let eosPos = full.lastIndexOf(this._eosToken);
        if (
          this._eosToken.length > 0 &&
          (eosPos === prefix.length - this._eosToken.length ||
            (full[full.length - 1] === '\n' &&
              eosPos === full.length - this._eosToken.length - 1))
        ) {
          full = full.substring(0, eosPos);
        }

        let commonPrefixLength = 0;
        for (let i = 0; i < prefix.length && i < full.length; i++) {
          if (prefix[i] !== full[i]) break;
          if (prefix[i] === '<') continue;
          commonPrefixLength = i + 1;
        }
        const example = full.substring(commonPrefixLength);
        if (example.includes('tool_name') || example.includes('some_value')) {
          this._toolCallExample = example;
        }
      }
    } catch (e) {
      // Failed to generate tool call example
    }
  }

  originalCaps() {
    return { ...this._caps };
  }

  apply(inputs, options = {}) {
    const {
      messages = [],
      tools,
      addGenerationPrompt = true,
      extraContext,
      now = new Date(),
    } = inputs;

    const opts = {
      applyPolyfills: options.applyPolyfills !== undefined ? options.applyPolyfills : true,
      useBosToken: options.useBosToken !== undefined ? options.useBosToken : true,
      useEosToken: options.useEosToken !== undefined ? options.useEosToken : true,
      defineStrftimeNow: options.defineStrftimeNow !== undefined ? options.defineStrftimeNow : true,
      polyfillTools: options.polyfillTools !== undefined ? options.polyfillTools : true,
      polyfillToolCallExamples: options.polyfillToolCallExamples !== undefined ? options.polyfillToolCallExamples : true,
      polyfillToolCalls: options.polyfillToolCalls !== undefined ? options.polyfillToolCalls : true,
      polyfillToolResponses: options.polyfillToolResponses !== undefined ? options.polyfillToolResponses : true,
      polyfillSystemRole: options.polyfillSystemRole !== undefined ? options.polyfillSystemRole : true,
      polyfillObjectArguments: options.polyfillObjectArguments !== undefined ? options.polyfillObjectArguments : true,
      polyfillTypedContent: options.polyfillTypedContent !== undefined ? options.polyfillTypedContent : true,
    };

    const hasTools = Array.isArray(tools) && tools.length > 0;
    let hasToolCalls = false;
    let hasToolResponses = false;
    let hasStringContent = false;
    for (const message of messages) {
      if (message.tool_calls != null) hasToolCalls = true;
      if (message.role === 'tool') hasToolResponses = true;
      if (typeof message.content === 'string') hasStringContent = true;
    }

    const polyfillSystemRole = opts.polyfillSystemRole && !this._caps.supportsSystemRole;
    const polyfillTools = opts.polyfillTools && hasTools && !this._caps.supportsTools;
    const polyfillToolCallExample = polyfillTools && opts.polyfillToolCallExamples;
    const polyfillToolCalls = opts.polyfillToolCalls && hasToolCalls && !this._caps.supportsToolCalls;
    const polyfillToolResponses = opts.polyfillToolResponses && hasToolResponses && !this._caps.supportsToolResponses;
    const polyfillObjectArguments = opts.polyfillObjectArguments && hasToolCalls && this._caps.requiresObjectArguments;
    const polyfillTypedContent = opts.polyfillTypedContent && hasStringContent && this._caps.requiresTypedContent;

    const needsPolyfills = opts.applyPolyfills && (
      polyfillSystemRole ||
      polyfillTools ||
      polyfillToolCalls ||
      polyfillToolResponses ||
      polyfillObjectArguments ||
      polyfillTypedContent
    );

    let actualMessages;

    if (needsPolyfills) {
      actualMessages = [];

      const addMessage = (msg) => {
        if (polyfillTypedContent && msg.content != null && typeof msg.content === 'string') {
          actualMessages.push({
            role: msg.role,
            content: [{ type: 'text', text: msg.content }],
          });
        } else {
          actualMessages.push(msg);
        }
      };

      let pendingSystem = '';
      const flushSys = () => {
        if (pendingSystem.length > 0) {
          addMessage({ role: 'user', content: pendingSystem });
          pendingSystem = '';
        }
      };

      let adjustedMessages;
      if (polyfillTools) {
        const toolsStr = Value.fromJS(tools).dump(2, true);
        const exampleStr = polyfillToolCallExample && this._toolCallExample
          ? '\n\nExample tool call syntax:\n\n' + this._toolCallExample + '\n\n'
          : '';
        adjustedMessages = ChatTemplate.addSystem(
          messages,
          "You can call any of the following tools to satisfy the user's requests: " +
            toolsStr + exampleStr
        );
      } else {
        adjustedMessages = messages;
      }

      for (let message of adjustedMessages) {
        message = { ...message }; // shallow clone

        if (message.tool_calls != null) {
          if (polyfillObjectArguments || polyfillToolCalls) {
            message.tool_calls = message.tool_calls.map((tc) => {
              tc = { ...tc };
              if (tc.type === 'function') {
                tc.function = { ...tc.function };
                if (typeof tc.function.arguments === 'string') {
                  try {
                    tc.function.arguments = JSON.parse(tc.function.arguments);
                  } catch (e) {
                    // Failed to parse arguments
                  }
                }
              }
              return tc;
            });
          }
          if (polyfillToolCalls) {
            const toolCallsArr = [];
            for (const tc of message.tool_calls) {
              if (tc.type !== 'function') continue;
              const entry = {
                name: tc.function.name,
                arguments: tc.function.arguments,
              };
              if (tc.id !== undefined) {
                entry.id = tc.id;
              }
              toolCallsArr.push(entry);
            }
            const obj = { tool_calls: toolCallsArr };
            if (message.content != null && message.content !== '') {
              obj.content = message.content;
            }
            message.content = JSON.stringify(obj, null, 2);
            delete message.tool_calls;
          }
        }

        if (polyfillToolResponses && message.role === 'tool') {
          message.role = 'user';
          const toolResponse = {};
          if (message.name !== undefined) {
            toolResponse.tool = message.name;
          }
          toolResponse.content = message.content;
          if (message.tool_call_id !== undefined) {
            toolResponse.tool_call_id = message.tool_call_id;
          }
          message.content = JSON.stringify({ tool_response: toolResponse }, null, 2);
          delete message.name;
        }

        if (message.content != null && polyfillSystemRole) {
          const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
          if (message.role === 'system') {
            if (pendingSystem.length > 0) pendingSystem += '\n';
            pendingSystem += content;
            continue;
          } else {
            if (message.role === 'user') {
              if (pendingSystem.length > 0) {
                message = { ...message };
                message.content = pendingSystem + (content.length === 0 ? '' : '\n' + content);
                pendingSystem = '';
              }
            } else {
              flushSys();
            }
          }
        }
        addMessage(message);
      }
      flushSys();
    } else {
      actualMessages = messages;
    }

    const contextData = {
      messages: actualMessages,
      add_generation_prompt: addGenerationPrompt,
    };
    const context = Context.make(contextData);
    context.set('bos_token', opts.useBosToken ? this._bosToken : '');
    context.set('eos_token', opts.useEosToken ? this._eosToken : '');

    if (opts.defineStrftimeNow) {
      const nowDate = now;
      context.set(
        'strftime_now',
        Value.callable((ctx, args) => {
          args.expectArgs('strftime_now', [1, 1], [0, 0]);
          const format = args.args[0].value;
          return Value.fromJS(ChatTemplate._strftime(format, nowDate));
        })
      );
    }

    if (tools !== undefined && tools !== null) {
      context.set('tools', Value.fromJS(tools));
    }

    if (extraContext != null) {
      for (const [key, val] of Object.entries(extraContext)) {
        context.set(key, Value.fromJS(val));
      }
    }

    return this._templateRoot.render(context);
  }

  static addSystem(messages, systemPrompt) {
    const result = [...messages];
    if (result.length > 0 && result[0].role === 'system') {
      result[0] = {
        role: 'system',
        content: result[0].content + '\n\n' + systemPrompt,
      };
    } else {
      result.unshift({ role: 'system', content: systemPrompt });
    }
    return result;
  }

  static _strftime(format, date) {
    const pad = (n, width = 2) => String(n).padStart(width, '0');
    let result = '';
    for (let i = 0; i < format.length; i++) {
      if (format[i] === '%' && i + 1 < format.length) {
        i++;
        switch (format[i]) {
          case 'Y': result += String(date.getFullYear()); break;
          case 'm': result += pad(date.getMonth() + 1); break;
          case 'd': result += pad(date.getDate()); break;
          case 'H': result += pad(date.getHours()); break;
          case 'M': result += pad(date.getMinutes()); break;
          case 'S': result += pad(date.getSeconds()); break;
          case 'j': {
            const start = new Date(date.getFullYear(), 0, 0);
            const diff = date - start;
            const oneDay = 1000 * 60 * 60 * 24;
            result += pad(Math.floor(diff / oneDay), 3);
            break;
          }
          case 'p': result += date.getHours() >= 12 ? 'PM' : 'AM'; break;
          case 'I': {
            let h = date.getHours() % 12;
            if (h === 0) h = 12;
            result += pad(h);
            break;
          }
          case 'A': {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            result += days[date.getDay()];
            break;
          }
          case 'a': {
            const daysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            result += daysShort[date.getDay()];
            break;
          }
          case 'B': {
            const months = ['January', 'February', 'March', 'April', 'May', 'June',
              'July', 'August', 'September', 'October', 'November', 'December'];
            result += months[date.getMonth()];
            break;
          }
          case 'b': {
            const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            result += monthsShort[date.getMonth()];
            break;
          }
          case '%': result += '%'; break;
          default: result += '%' + format[i]; break;
        }
      } else {
        result += format[i];
      }
    }
    return result;
  }
}
