// Core Minja template engine - JavaScript port of minja.hpp

// ── Value class ─────────────────────────────────────────────────────────

class Value {
  constructor() {
    this._array = null;
    this._object = null;
    this._callable = null;
    this._primitive = null; // null means "null value"; otherwise {type, value}
  }

  static fromPrimitive(v) {
    const val = new Value();
    val._primitive = v;
    return val;
  }
  static fromArray(arr) {
    const val = new Value();
    val._array = arr;
    return val;
  }
  static fromObject(obj) {
    const val = new Value();
    val._object = obj;
    return val;
  }
  static fromCallable(fn) {
    const val = new Value();
    val._object = new Map();
    val._callable = fn;
    return val;
  }

  static fromJS(v) {
    if (v instanceof Value) return v;
    if (v === null || v === undefined) return new Value();
    if (typeof v === 'boolean') return Value.fromPrimitive({ type: 'bool', value: v });
    if (typeof v === 'number') {
      if (Number.isInteger(v)) return Value.fromPrimitive({ type: 'int', value: v });
      return Value.fromPrimitive({ type: 'float', value: v });
    }
    if (typeof v === 'string') return Value.fromPrimitive({ type: 'string', value: v });
    if (typeof v === 'function') return Value.fromCallable(v);
    if (Array.isArray(v)) {
      return Value.fromArray(v.map(item => Value.fromJS(item)));
    }
    if (typeof v === 'object') {
      const map = new Map();
      for (const [key, val] of Object.entries(v)) {
        map.set(key, Value.fromJS(val));
      }
      return Value.fromObject(map);
    }
    return new Value();
  }

  static array(values = []) {
    return Value.fromArray([...values]);
  }
  static object() {
    return Value.fromObject(new Map());
  }
  static callable(fn) {
    return Value.fromCallable(fn);
  }

  // Type checks
  isNull() { return !this._array && !this._object && !this._callable && this._primitive === null; }
  isBoolean() { return this._primitive !== null && this._primitive?.type === 'bool'; }
  isNumberInteger() { return this._primitive !== null && this._primitive?.type === 'int'; }
  isNumberFloat() { return this._primitive !== null && this._primitive?.type === 'float'; }
  isNumber() { return this.isNumberInteger() || this.isNumberFloat(); }
  isString() { return this._primitive !== null && this._primitive?.type === 'string'; }
  isArray() { return this._array !== null; }
  isObject() { return this._object !== null; }
  isCallable() { return this._callable !== null; }
  isIterable() { return this.isArray() || this.isObject() || this.isString(); }
  isPrimitive() { return !this._array && !this._object && !this._callable; }
  isHashable() { return this.isPrimitive(); }

  get(key) {
    if (key instanceof Value) {
      if (this._array) {
        if (!key.isNumberInteger()) return new Value();
        let idx = key.value;
        if (idx < 0) idx += this._array.length;
        if (idx < 0 || idx >= this._array.length) {
          throw new RangeError(`array index out of range: index ${key.value}, size ${this._array.length}`);
        }
        return this._array[idx];
      }
      if (this._object) {
        if (!key.isHashable()) throw new Error('Unhashable type: ' + this.dump());
        const k = key.isString() ? key.value : String(key.value ?? 'null');
        if (this._object.has(k)) return this._object.get(k);
        return new Value();
      }
      return new Value();
    }
    // String key lookup
    if (this._object) {
      if (this._object.has(key)) return this._object.get(key);
      return new Value();
    }
    return new Value();
  }

  set(key, value) {
    if (!this._object) throw new Error('Value is not an object: ' + this.dump());
    const v = value instanceof Value ? value : Value.fromJS(value);
    if (key instanceof Value) {
      if (!key.isHashable()) throw new Error('Unhashable type: ' + this.dump());
      const k = key.isString() ? key.value : String(key.value ?? 'null');
      this._object.set(k, v);
      if (!this._keyValues) this._keyValues = new Map();
      this._keyValues.set(k, key);
    } else {
      this._object.set(key, v);
    }
  }

  get value() {
    if (this._primitive === null) return null;
    return this._primitive.value;
  }

  get size() {
    if (this.isObject()) return this._object.size;
    if (this.isArray()) return this._array.length;
    if (this.isString()) return this._primitive.value.length;
    throw new Error('Value is not an array or object: ' + this.dump());
  }

  contains(keyOrValue) {
    if (keyOrValue instanceof Value) {
      if (this.isNull()) throw new Error('Undefined value or reference');
      if (this._array) {
        for (const item of this._array) {
          if (item.toBool() && item.eq(keyOrValue)) return true;
        }
        return false;
      }
      if (this._object) {
        if (!keyOrValue.isHashable()) throw new Error('Unhashable type: ' + keyOrValue.dump());
        const k = keyOrValue.isString() ? keyOrValue.value : String(keyOrValue.value ?? 'null');
        return this._object.has(k);
      }
      throw new Error('contains can only be called on arrays and objects: ' + this.dump());
    }
    // String key
    if (this._array) return false;
    if (this._object) return this._object.has(keyOrValue);
    throw new Error('contains can only be called on arrays and objects: ' + this.dump());
  }

  at(index) {
    if (index instanceof Value) {
      if (!index.isHashable()) throw new Error('Unhashable type: ' + this.dump());
      if (this.isArray()) {
        let idx = index.value;
        if (typeof idx !== 'number') throw new Error('Array index must be a number');
        if (idx < 0) idx += this._array.length;
        if (idx < 0 || idx >= this._array.length) throw new Error('Index out of range');
        return this._array[idx];
      }
      if (this.isObject()) {
        const k = index.isString() ? index.value : String(index.value ?? 'null');
        if (!this._object.has(k)) throw new Error('Key not found: ' + k);
        return this._object.get(k);
      }
      throw new Error('Value is not an array or object: ' + this.dump());
    }
    // Numeric index
    if (this.isNull()) throw new Error('Undefined value or reference');
    if (this.isArray()) {
      if (index < 0) index += this._array.length;
      return this._array[index];
    }
    if (this.isObject()) {
      const k = String(index);
      if (!this._object.has(k)) throw new Error('Key not found: ' + k);
      return this._object.get(k);
    }
    throw new Error('Value is not an array or object: ' + this.dump());
  }

  keys() {
    if (!this._object) throw new Error('Value is not an object: ' + this.dump());
    const res = [];
    for (const key of this._object.keys()) {
      if (this._keyValues && this._keyValues.has(key)) {
        res.push(this._keyValues.get(key));
      } else {
        res.push(Value.fromJS(key));
      }
    }
    return res;
  }

  pushBack(v) {
    if (!this._array) throw new Error('Value is not an array: ' + this.dump());
    this._array.push(v instanceof Value ? v : Value.fromJS(v));
  }

  insert(index, v) {
    if (!this._array) throw new Error('Value is not an array: ' + this.dump());
    this._array.splice(index, 0, v instanceof Value ? v : Value.fromJS(v));
  }

  pop(index) {
    if (this.isArray()) {
      if (this._array.length === 0) throw new Error('pop from empty list');
      if (index === undefined || (index instanceof Value && index.isNull())) {
        return this._array.pop();
      }
      const idx = index instanceof Value ? index.value : index;
      if (typeof idx !== 'number' || !Number.isInteger(idx)) {
        throw new Error('pop index must be an integer: ' + (index instanceof Value ? index.dump() : String(index)));
      }
      if (idx < 0 || idx >= this._array.length) {
        throw new Error('pop index out of range: ' + (index instanceof Value ? index.dump() : String(index)));
      }
      const ret = this._array[idx];
      this._array.splice(idx, 1);
      return ret;
    }
    if (this.isObject()) {
      if (index instanceof Value) {
        if (!index.isHashable()) throw new Error('Unhashable type: ' + index.dump());
        const k = index.isString() ? index.value : String(index.value ?? 'null');
        if (!this._object.has(k)) throw new Error('Key not found: ' + index.dump());
        const ret = this._object.get(k);
        this._object.delete(k);
        return ret;
      }
      if (!this._object.has(index)) throw new Error("Key not found: '" + index + "'");
      const ret = this._object.get(index);
      this._object.delete(index);
      return ret;
    }
    throw new Error('Value is not an array or object: ' + this.dump());
  }

  empty() {
    if (this.isNull()) throw new Error('Undefined value or reference');
    if (this.isString()) return this._primitive.value.length === 0;
    if (this.isArray()) return this._array.length === 0;
    if (this.isObject()) return this._object.size === 0;
    return false;
  }

  forEach(callback) {
    if (this.isNull()) throw new Error('Undefined value or reference');
    if (this._array) {
      for (const item of this._array) callback(item);
    } else if (this._object) {
      for (const key of this._object.keys()) {
        if (this._keyValues && this._keyValues.has(key)) callback(this._keyValues.get(key));
        else callback(Value.fromJS(key));
      }
    } else if (this.isString()) {
      for (const c of this._primitive.value) callback(Value.fromJS(c));
    } else {
      throw new Error('Value is not iterable: ' + this.dump());
    }
  }

  toBool() {
    if (this.isNull()) return false;
    if (this.isBoolean()) return this._primitive.value;
    if (this.isNumber()) return this._primitive.value !== 0;
    if (this.isString()) return this._primitive.value.length > 0;
    if (this.isArray()) return !this.empty();
    return true;
  }

  toInt() {
    if (this.isNull()) return 0;
    if (this.isBoolean()) return this._primitive.value ? 1 : 0;
    if (this.isNumber()) return Math.trunc(this._primitive.value);
    if (this.isString()) {
      const n = parseInt(this._primitive.value, 10);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }

  toStr() {
    if (this.isString()) return this._primitive.value;
    if (this.isNumberInteger()) return String(this._primitive.value);
    if (this.isNumberFloat()) return this._primitive.value.toFixed(6);
    if (this.isBoolean()) return this._primitive.value ? 'True' : 'False';
    if (this.isNull()) return 'None';
    return this.dump();
  }

  neg() {
    if (this.isNumberInteger()) return Value.fromPrimitive({ type: 'int', value: -this._primitive.value });
    return Value.fromPrimitive({ type: 'float', value: -this._primitive.value });
  }

  add(rhs) {
    if (this.isString() || rhs.isString()) {
      return Value.fromJS(this.toStr() + rhs.toStr());
    }
    if (this.isNumberInteger() && rhs.isNumberInteger()) {
      return Value.fromPrimitive({ type: 'int', value: this._primitive.value + rhs._primitive.value });
    }
    if (this.isArray() && rhs.isArray()) {
      const res = Value.array();
      for (const item of this._array) res.pushBack(item);
      for (const item of rhs._array) res.pushBack(item);
      return res;
    }
    return Value.fromPrimitive({ type: 'float', value: this.getNumber() + rhs.getNumber() });
  }

  sub(rhs) {
    if (this.isNumberInteger() && rhs.isNumberInteger()) {
      return Value.fromPrimitive({ type: 'int', value: this._primitive.value - rhs._primitive.value });
    }
    return Value.fromPrimitive({ type: 'float', value: this.getNumber() - rhs.getNumber() });
  }

  mul(rhs) {
    if (this.isString() && rhs.isNumberInteger()) {
      const n = rhs._primitive.value;
      return Value.fromJS(n > 0 ? this._primitive.value.repeat(n) : '');
    }
    if (this.isNumberInteger() && rhs.isNumberInteger()) {
      return Value.fromPrimitive({ type: 'int', value: this._primitive.value * rhs._primitive.value });
    }
    return Value.fromPrimitive({ type: 'float', value: this.getNumber() * rhs.getNumber() });
  }

  div(rhs) {
    if (this.isNumberInteger() && rhs.isNumberInteger()) {
      const a = this._primitive.value;
      const b = rhs._primitive.value;
      return Value.fromPrimitive({ type: 'int', value: Math.trunc(a / b) });
    }
    return Value.fromPrimitive({ type: 'float', value: this.getNumber() / rhs.getNumber() });
  }

  mod(rhs) {
    return Value.fromPrimitive({ type: 'int', value: this.getInt() % rhs.getInt() });
  }

  getNumber() {
    if (this._primitive === null || (this._primitive.type !== 'int' && this._primitive.type !== 'float')) {
      throw new Error('Value is not a number: ' + this.dump());
    }
    return this._primitive.value;
  }

  getInt() {
    if (this._primitive === null || (this._primitive.type !== 'int' && this._primitive.type !== 'float')) {
      throw new Error('Value is not a number: ' + this.dump());
    }
    return Math.trunc(this._primitive.value);
  }

  eq(other) {
    if (this._callable || other._callable) {
      return this._callable === other._callable;
    }
    if (this._array) {
      if (!other._array) return false;
      if (this._array.length !== other._array.length) return false;
      for (let i = 0; i < this._array.length; i++) {
        if (!this._array[i].toBool() || !other._array[i].toBool() || !this._array[i].eq(other._array[i])) return false;
      }
      return true;
    }
    if (this._object && !this._callable) {
      if (!other._object) return false;
      if (this._object.size !== other._object.size) return false;
      for (const [key, val] of this._object) {
        if (!val.toBool() || !other._object.has(key) || !val.eq(other._object.get(key))) return false;
      }
      return true;
    }
    // Primitive comparison
    if (this.isNull() && other.isNull()) return true;
    if (this.isNull() || other.isNull()) return false;
    if (this._primitive?.type === other._primitive?.type) return this._primitive.value === other._primitive.value;
    // Cross-type: both numbers
    if (this.isNumber() && other.isNumber()) return this._primitive.value === other._primitive.value;
    return false;
  }

  ne(other) { return !this.eq(other); }

  lt(other) {
    if (this.isNull()) throw new Error('Undefined value or reference');
    if (this.isNumber() && other.isNumber()) return this._primitive.value < other._primitive.value;
    if (this.isString() && other.isString()) return this._primitive.value < other._primitive.value;
    throw new Error('Cannot compare values: ' + this.dump() + ' < ' + other.dump());
  }

  gt(other) {
    if (this.isNull()) throw new Error('Undefined value or reference');
    if (this.isNumber() && other.isNumber()) return this._primitive.value > other._primitive.value;
    if (this.isString() && other.isString()) return this._primitive.value > other._primitive.value;
    throw new Error('Cannot compare values: ' + this.dump() + ' > ' + other.dump());
  }

  le(other) { return !this.gt(other); }
  ge(other) { return !this.lt(other); }

  call(context, args) {
    if (!this._callable) throw new Error('Value is not callable: ' + this.dump());
    return this._callable(context, args);
  }

  // Dump with Python-style repr or JSON
  static _dumpString(str, quote = "'") {
    const jsonStr = JSON.stringify(str);
    if (quote === '"' || str.includes("'")) {
      return jsonStr;
    }
    let result = quote;
    for (let i = 1; i < jsonStr.length - 1; i++) {
      if (jsonStr[i] === '\\' && jsonStr[i + 1] === '"') {
        result += '"';
        i++;
      } else if (jsonStr[i] === quote) {
        result += '\\' + quote;
      } else {
        result += jsonStr[i];
      }
    }
    result += quote;
    return result;
  }

  dump(indent = -1, toJson = false) {
    return this._dumpImpl(indent, 0, toJson);
  }

  _dumpImpl(indent, level, toJson) {
    const printIndent = (lvl) => {
      if (indent > 0) return '\n' + ' '.repeat(lvl * indent);
      return '';
    };
    const subSep = () => {
      if (indent < 0) return ', ';
      return ',' + printIndent(level + 1);
    };

    const stringQuote = toJson ? '"' : "'";

    if (this.isNull()) return 'null';
    if (this._array) {
      let out = '[';
      out += printIndent(level + 1);
      for (let i = 0; i < this._array.length; i++) {
        if (i > 0) out += subSep();
        out += this._array[i]._dumpImpl(indent, level + 1, toJson);
      }
      out += printIndent(level);
      out += ']';
      return out;
    }
    if (this._object && !this._callable) {
      let out = '{';
      out += printIndent(level + 1);
      let first = true;
      for (const [key, value] of this._object) {
        if (!first) out += subSep();
        first = false;
        // Use original key Value type if available (preserves int keys in non-JSON mode)
        const keyVal = this._keyValues && this._keyValues.has(key) ? this._keyValues.get(key) : null;
        if (keyVal && !keyVal.isString() && !toJson) {
          out += keyVal._dumpImpl(indent, level + 1, toJson);
        } else {
          out += Value._dumpString(key, stringQuote);
        }
        out += ': ';
        out += value._dumpImpl(indent, level + 1, toJson);
      }
      out += printIndent(level);
      out += '}';
      return out;
    }
    if (this._callable) {
      throw new Error('Cannot dump callable to JSON');
    }
    if (this.isBoolean() && !toJson) {
      return this._primitive.value ? 'True' : 'False';
    }
    if (this.isString()) {
      return Value._dumpString(this._primitive.value, stringQuote);
    }
    if (this.isBoolean()) return this._primitive.value ? 'true' : 'false';
    if (this.isNumberInteger()) return String(this._primitive.value);
    if (this.isNumberFloat()) return String(this._primitive.value);
    return 'null';
  }

  toJSON() {
    if (this.isNull()) return null;
    if (this.isPrimitive()) return this._primitive.value;
    if (this._array) return this._array.map(v => v.toJSON());
    if (this._object) {
      const obj = {};
      for (const [key, value] of this._object) {
        obj[key] = value instanceof Value ? value.toJSON() : value;
      }
      return obj;
    }
    return null;
  }
}

// ── ArgumentsValue ──────────────────────────────────────────────────────

class ArgumentsValue {
  constructor() {
    this.args = [];
    this.kwargs = [];
  }

  hasNamed(name) {
    return this.kwargs.some(([k]) => k === name);
  }

  getNamed(name) {
    for (const [k, v] of this.kwargs) {
      if (k === name) return v;
    }
    return new Value();
  }

  empty() {
    return this.args.length === 0 && this.kwargs.length === 0;
  }

  expectArgs(methodName, posCount, kwCount) {
    if (this.args.length < posCount[0] || this.args.length > posCount[1] ||
        this.kwargs.length < kwCount[0] || this.kwargs.length > kwCount[1]) {
      throw new Error(`${methodName} must have between ${posCount[0]} and ${posCount[1]} positional arguments and between ${kwCount[0]} and ${kwCount[1]} keyword arguments`);
    }
  }
}

// ── Context ─────────────────────────────────────────────────────────────

class Context {
  constructor(values, parent = null) {
    this._values = values;
    this._parent = parent;
    if (!values.isObject()) throw new Error('Context values must be an object: ' + values.dump());
  }

  static builtins() {
    return _createBuiltins();
  }

  static make(bindings = {}, parent = null) {
    let values;
    if (bindings instanceof Value) {
      values = bindings.isNull() ? Value.object() : bindings;
    } else {
      values = Value.fromJS(bindings);
    }
    return new Context(values, parent || Context.builtins());
  }

  _toKey(key) {
    if (typeof key === 'string') return key;
    if (key instanceof Value) return key.isString() ? key.value : String(key.value);
    return String(key);
  }

  get(key) {
    const k = this._toKey(key);
    if (this._values.contains(k)) return this._values.get(k);
    if (this._parent) return this._parent.get(k);
    return new Value();
  }

  at(key) {
    const k = this._toKey(key);
    if (this._values.contains(k)) return this._values.get(k);
    if (this._parent) return this._parent.at(k);
    throw new Error('Undefined variable: ' + k);
  }

  contains(key) {
    const k = this._toKey(key);
    if (this._values.contains(k)) return true;
    if (this._parent) return this._parent.contains(k);
    return false;
  }

  set(key, value) {
    const k = this._toKey(key);
    this._values.set(k, value instanceof Value ? value : Value.fromJS(value));
  }
}

// ── LoopControlException ────────────────────────────────────────────────

const LoopControlType = { Break: 'break', Continue: 'continue' };

class LoopControlException extends Error {
  constructor(controlType, message) {
    super(message || (controlType + ' outside of a loop'));
    this.controlType = controlType;
  }
}

// ── Error location ──────────────────────────────────────────────────────

function errorLocationSuffix(source, pos) {
  const getLine = (lineNum) => {
    let start = 0;
    for (let i = 1; i < lineNum; i++) {
      const idx = source.indexOf('\n', start);
      start = idx === -1 ? source.length : idx + 1;
    }
    const end = source.indexOf('\n', start);
    return source.substring(start, end === -1 ? source.length : end);
  };
  const before = source.substring(0, pos);
  const line = (before.match(/\n/g) || []).length + 1;
  const maxLine = (source.match(/\n/g) || []).length + 1;
  const lastNl = before.lastIndexOf('\n');
  const col = pos - lastNl;

  let out = ` at row ${line}, column ${col}:\n`;
  if (line > 1) out += getLine(line - 1) + '\n';
  out += getLine(line) + '\n';
  out += ' '.repeat(col - 1) + '^\n';
  if (line < maxLine) out += getLine(line + 1) + '\n';
  return out;
}

// ── Expression AST ──────────────────────────────────────────────────────

class Expression {
  constructor(location) { this.location = location; }
  evaluate(context) {
    try {
      return this.doEvaluate(context);
    } catch (e) {
      if (e._hasLocation) throw e;
      if (this.location?.source) {
        e.message += errorLocationSuffix(this.location.source, this.location.pos);
        e._hasLocation = true;
      }
      throw e;
    }
  }
  doEvaluate(_context) { throw new Error('Not implemented'); }
}

class LiteralExpr extends Expression {
  constructor(loc, value) { super(loc); this.value = value; }
  doEvaluate() { return this.value; }
}

class VariableExpr extends Expression {
  constructor(loc, name) { super(loc); this.name = name; }
  getName() { return this.name; }
  doEvaluate(context) {
    if (!context.contains(this.name)) return new Value();
    return context.at(this.name);
  }
}

class ArrayExpr extends Expression {
  constructor(loc, elements) { super(loc); this.elements = elements; }
  doEvaluate(context) {
    const result = Value.array();
    for (const e of this.elements) {
      if (!e) throw new Error('Array element is null');
      result.pushBack(e.evaluate(context));
    }
    return result;
  }
}

class DictExpr extends Expression {
  constructor(loc, elements) { super(loc); this.elements = elements; }
  doEvaluate(context) {
    const result = Value.object();
    for (const [key, value] of this.elements) {
      if (!key) throw new Error('Dict key is null');
      if (!value) throw new Error('Dict value is null');
      result.set(key.evaluate(context), value.evaluate(context));
    }
    return result;
  }
}

class SliceExpr extends Expression {
  constructor(loc, start, end, step) {
    super(loc);
    this.start = start;
    this.end = end;
    this.step = step;
  }
  doEvaluate() { throw new Error('SliceExpr not implemented'); }
}

class SubscriptExpr extends Expression {
  constructor(loc, base, index) { super(loc); this.base = base; this.index = index; }
  doEvaluate(context) {
    if (!this.base) throw new Error('SubscriptExpr.base is null');
    if (!this.index) throw new Error('SubscriptExpr.index is null');
    const targetValue = this.base.evaluate(context);

    if (this.index instanceof SliceExpr) {
      const slice = this.index;
      const len = targetValue.size;
      const wrap = (i) => i < 0 ? i + len : i;

      const stepVal = slice.step ? slice.step.evaluate(context).value : 1;
      if (!stepVal) throw new Error('slice step cannot be zero');

      const startVal = slice.start ? wrap(slice.start.evaluate(context).value) : (stepVal < 0 ? len - 1 : 0);
      const endVal = slice.end ? wrap(slice.end.evaluate(context).value) : (stepVal < 0 ? -1 : len);

      if (targetValue.isString()) {
        const s = targetValue.value;
        let result = '';
        if (startVal < endVal && stepVal === 1) {
          result = s.substring(startVal, endVal);
        } else {
          for (let i = startVal; stepVal > 0 ? i < endVal : i > endVal; i += stepVal) {
            result += s[i];
          }
        }
        return Value.fromJS(result);
      }
      if (targetValue.isArray()) {
        const result = Value.array();
        for (let i = startVal; stepVal > 0 ? i < endVal : i > endVal; i += stepVal) {
          result.pushBack(targetValue.at(i));
        }
        return result;
      }
      throw new Error(targetValue.isNull() ? 'Cannot subscript null' : 'Subscripting only supported on arrays and strings');
    }

    const indexValue = this.index.evaluate(context);
    if (targetValue.isNull()) {
      if (this.base instanceof VariableExpr) {
        throw new Error("'" + this.base.getName() + "' is " + (context.contains(this.base.getName()) ? 'null' : 'not defined'));
      }
      throw new Error("Trying to access property '" + indexValue.dump() + "' on null!");
    }
    return targetValue.get(indexValue);
  }
}

class UnaryOpExpr extends Expression {
  constructor(loc, expr, op) { super(loc); this.expr = expr; this.op = op; }
  doEvaluate(context) {
    if (!this.expr) throw new Error('UnaryOpExpr.expr is null');
    const e = this.expr.evaluate(context);
    switch (this.op) {
      case 'Plus': return e;
      case 'Minus': return e.neg();
      case 'LogicalNot': return Value.fromJS(!e.toBool());
      case 'Expansion':
      case 'ExpansionDict':
        throw new Error('Expansion operator is only supported in function calls and collections');
    }
    throw new Error('Unknown unary operator');
  }
}

function valueIn(value, container) {
  return ((container.isArray() || container.isObject()) && container.contains(value)) ||
    (value.isString() && container.isString() && container.value.includes(value.value));
}

class BinaryOpExpr extends Expression {
  constructor(loc, left, right, op) {
    super(loc);
    this.left = left;
    this.right = right;
    this.op = op;
  }
  doEvaluate(context) {
    if (!this.left) throw new Error('BinaryOpExpr.left is null');
    if (!this.right) throw new Error('BinaryOpExpr.right is null');
    const l = this.left.evaluate(context);

    const doEval = (lVal) => {
      if (this.op === 'Is' || this.op === 'IsNot') {
        if (!(this.right instanceof VariableExpr)) throw new Error("Right side of 'is' operator must be a variable");
        const name = this.right.getName();
        let result;
        if (name === 'none') result = lVal.isNull();
        else if (name === 'boolean') result = lVal.isBoolean();
        else if (name === 'integer') result = lVal.isNumberInteger();
        else if (name === 'float') result = lVal.isNumberFloat();
        else if (name === 'number') result = lVal.isNumber();
        else if (name === 'string') result = lVal.isString();
        else if (name === 'mapping') result = lVal.isObject();
        else if (name === 'iterable') result = lVal.isIterable();
        else if (name === 'sequence') result = lVal.isArray();
        else if (name === 'defined') result = !lVal.isNull();
        else if (name === 'true') result = lVal.toBool();
        else if (name === 'false') result = !lVal.toBool();
        else throw new Error("Unknown type for 'is' operator: " + name);
        return Value.fromJS(this.op === 'Is' ? result : !result);
      }

      if (this.op === 'And') {
        if (!lVal.toBool()) return Value.fromJS(false);
        return Value.fromJS(this.right.evaluate(context).toBool());
      }
      if (this.op === 'Or') {
        if (lVal.toBool()) return lVal;
        return this.right.evaluate(context);
      }

      const r = this.right.evaluate(context);
      switch (this.op) {
        case 'StrConcat': return Value.fromJS(lVal.toStr() + r.toStr());
        case 'Add': return lVal.add(r);
        case 'Sub': return lVal.sub(r);
        case 'Mul': return lVal.mul(r);
        case 'Div': return lVal.div(r);
        case 'MulMul': return Value.fromJS(Math.pow(lVal.getNumber(), r.getNumber()));
        case 'DivDiv': return Value.fromPrimitive({ type: 'int', value: Math.trunc(lVal.getInt() / r.getInt()) });
        case 'Mod': return lVal.mod(r);
        case 'Eq': return Value.fromJS(lVal.eq(r));
        case 'Ne': return Value.fromJS(lVal.ne(r));
        case 'Lt': return Value.fromJS(lVal.lt(r));
        case 'Gt': return Value.fromJS(lVal.gt(r));
        case 'Le': return Value.fromJS(lVal.le(r));
        case 'Ge': return Value.fromJS(lVal.ge(r));
        case 'In': return Value.fromJS(valueIn(lVal, r));
        case 'NotIn': return Value.fromJS(!valueIn(lVal, r));
      }
      throw new Error('Unknown binary operator');
    };

    if (l.isCallable()) {
      return Value.callable((ctx, args) => {
        const ll = l.call(ctx, args);
        return doEval(ll);
      });
    }
    return doEval(l);
  }
}

class ArgumentsExpression {
  constructor() {
    this.args = [];
    this.kwargs = [];
  }

  evaluate(context) {
    const vargs = new ArgumentsValue();
    for (const arg of this.args) {
      if (arg instanceof UnaryOpExpr) {
        if (arg.op === 'Expansion') {
          const array = arg.expr.evaluate(context);
          if (!array.isArray()) throw new Error('Expansion operator only supported on arrays');
          array.forEach((v) => vargs.args.push(v));
          continue;
        } else if (arg.op === 'ExpansionDict') {
          const dict = arg.expr.evaluate(context);
          if (!dict.isObject()) throw new Error('ExpansionDict operator only supported on objects');
          dict.forEach((key) => {
            vargs.kwargs.push([key.value, dict.at(key)]);
          });
          continue;
        }
      }
      vargs.args.push(arg.evaluate(context));
    }
    for (const [name, value] of this.kwargs) {
      vargs.kwargs.push([name, value.evaluate(context)]);
    }
    return vargs;
  }
}

// ── String helpers ──────────────────────────────────────────────────────

function strip(s, chars = '', left = true, right = true) {
  const charset = chars || ' \t\n\r';
  let start = 0;
  let end = s.length - 1;
  if (left) {
    while (start <= end && charset.includes(s[start])) start++;
  }
  if (right) {
    while (end >= start && charset.includes(s[end])) end--;
  }
  return s.substring(start, end + 1);
}

function splitStr(s, sep) {
  const result = [];
  let start = 0;
  let idx;
  while ((idx = s.indexOf(sep, start)) !== -1) {
    result.push(s.substring(start, idx));
    start = idx + sep.length;
  }
  result.push(s.substring(start));
  return result;
}

function capitalize(s) {
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase();
}

function htmlEscape(s) {
  let result = '';
  for (const c of s) {
    switch (c) {
      case '&': result += '&amp;'; break;
      case '<': result += '&lt;'; break;
      case '>': result += '&gt;'; break;
      case '"': result += '&#34;'; break;
      case "'": result += '&apos;'; break;
      default: result += c;
    }
  }
  return result;
}

// ── Method Call Expression ───────────────────────────────────────────────

class MethodCallExpr extends Expression {
  constructor(loc, object, method, args) {
    super(loc);
    this.object = object;
    this.method = method;
    this.args = args;
  }
  doEvaluate(context) {
    if (!this.object) throw new Error('MethodCallExpr.object is null');
    if (!this.method) throw new Error('MethodCallExpr.method is null');
    const obj = this.object.evaluate(context);
    const vargs = this.args.evaluate(context);
    const methodName = this.method.getName();

    if (obj.isNull()) {
      throw new Error("Trying to call method '" + methodName + "' on null");
    }

    if (obj.isArray()) {
      if (methodName === 'append') {
        vargs.expectArgs('append method', [1, 1], [0, 0]);
        obj.pushBack(vargs.args[0]);
        return new Value();
      }
      if (methodName === 'pop') {
        vargs.expectArgs('pop method', [0, 1], [0, 0]);
        return obj.pop(vargs.args.length === 0 ? undefined : vargs.args[0]);
      }
      if (methodName === 'insert') {
        vargs.expectArgs('insert method', [2, 2], [0, 0]);
        const index = vargs.args[0].value;
        if (index < 0 || index > obj.size) throw new Error('Index out of range for insert method');
        obj.insert(index, vargs.args[1]);
        return new Value();
      }
    } else if (obj.isObject()) {
      if (methodName === 'items') {
        vargs.expectArgs('items method', [0, 0], [0, 0]);
        const result = Value.array();
        for (const key of obj.keys()) {
          result.pushBack(Value.array([key, obj.at(key)]));
        }
        return result;
      }
      if (methodName === 'pop') {
        vargs.expectArgs('pop method', [1, 1], [0, 0]);
        return obj.pop(vargs.args[0]);
      }
      if (methodName === 'keys') {
        vargs.expectArgs('keys method', [0, 0], [0, 0]);
        const result = Value.array();
        for (const key of obj.keys()) {
          result.pushBack(key);
        }
        return result;
      }
      if (methodName === 'get') {
        vargs.expectArgs('get method', [1, 2], [0, 0]);
        const key = vargs.args[0];
        if (vargs.args.length === 1) {
          return obj.contains(key) ? obj.at(key) : new Value();
        }
        return obj.contains(key) ? obj.at(key) : vargs.args[1];
      }
      if (obj.contains(methodName)) {
        const callable = obj.get(methodName);
        if (!callable.isCallable()) throw new Error("Property '" + methodName + "' is not callable");
        return callable.call(context, vargs);
      }
    } else if (obj.isString()) {
      const str = obj.value;
      if (methodName === 'strip') {
        vargs.expectArgs('strip method', [0, 1], [0, 0]);
        const chars = vargs.args.length === 0 ? '' : vargs.args[0].value;
        return Value.fromJS(strip(str, chars));
      }
      if (methodName === 'lstrip') {
        vargs.expectArgs('lstrip method', [0, 1], [0, 0]);
        const chars = vargs.args.length === 0 ? '' : vargs.args[0].value;
        return Value.fromJS(strip(str, chars, true, false));
      }
      if (methodName === 'rstrip') {
        vargs.expectArgs('rstrip method', [0, 1], [0, 0]);
        const chars = vargs.args.length === 0 ? '' : vargs.args[0].value;
        return Value.fromJS(strip(str, chars, false, true));
      }
      if (methodName === 'split') {
        vargs.expectArgs('split method', [1, 1], [0, 0]);
        const sep = vargs.args[0].value;
        const parts = splitStr(str, sep);
        const result = Value.array();
        for (const p of parts) result.pushBack(Value.fromJS(p));
        return result;
      }
      if (methodName === 'capitalize') {
        vargs.expectArgs('capitalize method', [0, 0], [0, 0]);
        return Value.fromJS(capitalize(str));
      }
      if (methodName === 'upper') {
        vargs.expectArgs('upper method', [0, 0], [0, 0]);
        return Value.fromJS(str.toUpperCase());
      }
      if (methodName === 'lower') {
        vargs.expectArgs('lower method', [0, 0], [0, 0]);
        return Value.fromJS(str.toLowerCase());
      }
      if (methodName === 'endswith') {
        vargs.expectArgs('endswith method', [1, 1], [0, 0]);
        return Value.fromJS(str.endsWith(vargs.args[0].value));
      }
      if (methodName === 'startswith') {
        vargs.expectArgs('startswith method', [1, 1], [0, 0]);
        return Value.fromJS(str.startsWith(vargs.args[0].value));
      }
      if (methodName === 'title') {
        vargs.expectArgs('title method', [0, 0], [0, 0]);
        let res = '';
        for (let i = 0; i < str.length; i++) {
          if (i === 0 || /\s/.test(str[i - 1])) res += str[i].toUpperCase();
          else res += str[i].toLowerCase();
        }
        return Value.fromJS(res);
      }
      if (methodName === 'replace') {
        vargs.expectArgs('replace method', [2, 3], [0, 0]);
        const before = vargs.args[0].value;
        const after = vargs.args[1].value;
        let count = vargs.args.length === 3 ? vargs.args[2].value : str.length;
        let result = str;
        let startPos = 0;
        while (count > 0) {
          const idx = result.indexOf(before, startPos);
          if (idx === -1) break;
          result = result.substring(0, idx) + after + result.substring(idx + before.length);
          startPos = idx + after.length;
          count--;
        }
        return Value.fromJS(result);
      }
    }
    throw new Error('Unknown method: ' + methodName);
  }
}

class CallExpr extends Expression {
  constructor(loc, object, args) {
    super(loc);
    this.object = object;
    this.args = args;
  }
  doEvaluate(context) {
    if (!this.object) throw new Error('CallExpr.object is null');
    const obj = this.object.evaluate(context);
    if (!obj.isCallable()) throw new Error('Object is not callable: ' + obj.dump(2));
    const vargs = this.args.evaluate(context);
    return obj.call(context, vargs);
  }
}

class FilterExpr extends Expression {
  constructor(loc, parts) { super(loc); this.parts = parts; }
  doEvaluate(context) {
    let result;
    let first = true;
    for (const part of this.parts) {
      if (!part) throw new Error('FilterExpr.part is null');
      if (first) {
        first = false;
        result = part.evaluate(context);
      } else {
        if (part instanceof CallExpr) {
          const target = part.object.evaluate(context);
          const args = part.args.evaluate(context);
          args.args.unshift(result);
          result = target.call(context, args);
        } else {
          const callable = part.evaluate(context);
          const args = new ArgumentsValue();
          args.args.push(result);
          result = callable.call(context, args);
        }
      }
    }
    return result;
  }
  prepend(expr) { this.parts.unshift(expr); }
}

class IfExpr extends Expression {
  constructor(loc, condition, thenExpr, elseExpr) {
    super(loc);
    this.condition = condition;
    this.thenExpr = thenExpr;
    this.elseExpr = elseExpr;
  }
  doEvaluate(context) {
    if (!this.condition) throw new Error('IfExpr.condition is null');
    if (!this.thenExpr) throw new Error('IfExpr.then_expr is null');
    if (this.condition.evaluate(context).toBool()) return this.thenExpr.evaluate(context);
    if (this.elseExpr) return this.elseExpr.evaluate(context);
    return new Value();
  }
}

// ── TemplateNode AST ────────────────────────────────────────────────────

class TemplateNode {
  constructor(location) { this._location = location; }

  render(contextOrWrite, context) {
    if (typeof contextOrWrite === 'function') {
      this._render(contextOrWrite, context);
      return;
    }
    let out = '';
    this._render((s) => { out += s; }, contextOrWrite);
    return out;
  }

  _render(write, context) {
    try {
      this.doRender(write, context);
    } catch (e) {
      if (e instanceof LoopControlException) {
        if (e._hasLocation) throw e;
        if (this._location?.source) {
          const newMsg = e.message + errorLocationSuffix(this._location.source, this._location.pos);
          const newErr = new LoopControlException(e.controlType, newMsg);
          newErr._hasLocation = true;
          throw newErr;
        }
        throw e;
      }
      if (e._hasLocation) throw e;
      if (this._location?.source) {
        e.message += errorLocationSuffix(this._location.source, this._location.pos);
        e._hasLocation = true;
      }
      throw e;
    }
  }

  doRender(_write, _context) { throw new Error('Not implemented'); }
}

class SequenceNode extends TemplateNode {
  constructor(loc, children) { super(loc); this.children = children; }
  doRender(write, context) {
    for (const child of this.children) child._render(write, context);
  }
}

class TextNode extends TemplateNode {
  constructor(loc, text) { super(loc); this.text = text; }
  doRender(write) { write(this.text); }
}

class ExpressionNode extends TemplateNode {
  constructor(loc, expr) { super(loc); this.expr = expr; }
  doRender(write, context) {
    if (!this.expr) throw new Error('ExpressionNode.expr is null');
    const result = this.expr.evaluate(context);
    if (result.isString()) write(result.value);
    else if (result.isBoolean()) write(result.value ? 'True' : 'False');
    else if (!result.isNull()) write(result.dump());
  }
}

class IfNode extends TemplateNode {
  constructor(loc, cascade) { super(loc); this.cascade = cascade; }
  doRender(write, context) {
    for (const [condition, body] of this.cascade) {
      let enter = true;
      if (condition) enter = condition.evaluate(context).toBool();
      if (enter) {
        if (!body) throw new Error('IfNode.cascade.second is null');
        body._render(write, context);
        return;
      }
    }
  }
}

class LoopControlNode extends TemplateNode {
  constructor(loc, controlType) { super(loc); this.controlType = controlType; }
  doRender() { throw new LoopControlException(this.controlType); }
}

function destructuringAssign(varNames, context, item) {
  if (varNames.length === 1) {
    context.set(varNames[0], item);
  } else {
    if (!item.isArray() || item.size !== varNames.length) {
      throw new Error('Mismatched number of variables and items in destructuring assignment');
    }
    for (let i = 0; i < varNames.length; i++) {
      context.set(varNames[i], item.at(i));
    }
  }
}

class ForNode extends TemplateNode {
  constructor(loc, varNames, iterable, condition, body, recursive, elseBody) {
    super(loc);
    this.varNames = varNames;
    this.iterable = iterable;
    this.condition = condition;
    this.body = body;
    this.recursive = recursive;
    this.elseBody = elseBody;
  }
  doRender(write, context) {
    if (!this.iterable) throw new Error('ForNode.iterable is null');
    if (!this.body) throw new Error('ForNode.body is null');

    const iterableValue = this.iterable.evaluate(context);
    let loopFunction;

    const visit = (iter) => {
      const filteredItems = Value.array();
      if (!iter.isNull()) {
        if (!iterableValue.isIterable()) throw new Error('For loop iterable must be iterable: ' + iterableValue.dump());
        iterableValue.forEach((item) => {
          destructuringAssign(this.varNames, context, item);
          if (!this.condition || this.condition.evaluate(context).toBool()) {
            filteredItems.pushBack(item);
          }
        });
      }

      if (filteredItems.size === 0) {
        if (this.elseBody) this.elseBody._render(write, context);
      } else {
        const loop = this.recursive ? Value.callable(loopFunction) : Value.object();
        loop.set('length', Value.fromJS(filteredItems.size));

        let cycleIndex = 0;
        loop.set('cycle', Value.callable((_ctx, args) => {
          if (args.args.length === 0 || args.kwargs.length > 0) {
            throw new Error('cycle() expects at least 1 positional argument and no named arg');
          }
          const item = args.args[cycleIndex];
          cycleIndex = (cycleIndex + 1) % args.args.length;
          return item;
        }));

        const loopContext = new Context(Value.object(), context);
        loopContext.set('loop', loop);
        const n = filteredItems.size;
        for (let i = 0; i < n; i++) {
          const item = filteredItems.at(i);
          destructuringAssign(this.varNames, loopContext, item);
          loop.set('index', Value.fromJS(i + 1));
          loop.set('index0', Value.fromJS(i));
          loop.set('revindex', Value.fromJS(n - i));
          loop.set('revindex0', Value.fromJS(n - i - 1));
          loop.set('length', Value.fromJS(n));
          loop.set('first', Value.fromJS(i === 0));
          loop.set('last', Value.fromJS(i === n - 1));
          loop.set('previtem', i > 0 ? filteredItems.at(i - 1) : new Value());
          loop.set('nextitem', i < n - 1 ? filteredItems.at(i + 1) : new Value());
          try {
            this.body._render(write, loopContext);
          } catch (e) {
            if (e instanceof LoopControlException) {
              if (e.controlType === LoopControlType.Break) break;
              if (e.controlType === LoopControlType.Continue) continue;
            }
            throw e;
          }
        }
      }
    };

    if (this.recursive) {
      loopFunction = (_ctx, args) => {
        if (args.args.length !== 1 || args.kwargs.length > 0 || !args.args[0].isArray()) {
          throw new Error('loop() expects exactly 1 positional iterable argument');
        }
        visit(args.args[0]);
        return new Value();
      };
    }

    visit(iterableValue);
  }
}

class MacroNode extends TemplateNode {
  constructor(loc, name, params, body) {
    super(loc);
    this.name = name;
    this.params = params;
    this.body = body;
    this.namedParamPositions = new Map();
    for (let i = 0; i < params.length; i++) {
      if (params[i][0]) this.namedParamPositions.set(params[i][0], i);
    }
  }
  doRender(_write, macroContext) {
    if (!this.name) throw new Error('MacroNode.name is null');
    if (!this.body) throw new Error('MacroNode.body is null');
    const self = this;
    const callable = Value.callable((callContext, args) => {
      const executionContext = new Context(Value.object(), macroContext);

      if (callContext.contains('caller')) {
        executionContext.set('caller', callContext.get('caller'));
      }

      const paramSet = new Array(self.params.length).fill(false);
      for (let i = 0; i < args.args.length; i++) {
        if (i >= self.params.length) throw new Error('Too many positional arguments for macro ' + self.name.getName());
        paramSet[i] = true;
        executionContext.set(self.params[i][0], args.args[i]);
      }
      for (const [argName, value] of args.kwargs) {
        const pos = self.namedParamPositions.get(argName);
        if (pos === undefined) throw new Error('Unknown parameter name for macro ' + self.name.getName() + ': ' + argName);
        executionContext.set(argName, value);
        paramSet[pos] = true;
      }
      for (let i = 0; i < self.params.length; i++) {
        if (!paramSet[i] && self.params[i][1] !== null) {
          const val = self.params[i][1].evaluate(callContext);
          executionContext.set(self.params[i][0], val);
        }
      }
      return Value.fromJS(self.body.render(executionContext));
    });
    macroContext.set(this.name.getName(), callable);
  }
}

class FilterNode extends TemplateNode {
  constructor(loc, filter, body) { super(loc); this.filter = filter; this.body = body; }
  doRender(write, context) {
    if (!this.filter) throw new Error('FilterNode.filter is null');
    if (!this.body) throw new Error('FilterNode.body is null');
    const filterValue = this.filter.evaluate(context);
    if (!filterValue.isCallable()) throw new Error('Filter must be a callable: ' + filterValue.dump());
    const renderedBody = this.body.render(context);
    const filterArgs = new ArgumentsValue();
    filterArgs.args.push(Value.fromJS(renderedBody));
    const result = filterValue.call(context, filterArgs);
    write(result.toStr());
  }
}

class SetNode extends TemplateNode {
  constructor(loc, ns, varNames, value) {
    super(loc);
    this.ns = ns;
    this.varNames = varNames;
    this.value = value;
  }
  doRender(_write, context) {
    if (!this.value) throw new Error('SetNode.value is null');
    if (this.ns) {
      if (this.varNames.length !== 1) throw new Error('Namespaced set only supports a single variable name');
      const nsValue = context.get(this.ns);
      if (!nsValue.isObject()) throw new Error("Namespace '" + this.ns + "' is not an object");
      nsValue.set(this.varNames[0], this.value.evaluate(context));
    } else {
      const val = this.value.evaluate(context);
      destructuringAssign(this.varNames, context, val);
    }
  }
}

class SetTemplateNode extends TemplateNode {
  constructor(loc, name, templateValue) { super(loc); this.name = name; this.templateValue = templateValue; }
  doRender(_write, context) {
    if (!this.templateValue) throw new Error('SetTemplateNode.template_value is null');
    context.set(this.name, Value.fromJS(this.templateValue.render(context)));
  }
}

class CallNode extends TemplateNode {
  constructor(loc, expr, body) { super(loc); this.expr = expr; this.body = body; }
  doRender(write, context) {
    if (!this.expr) throw new Error('CallNode.expr is null');
    if (!this.body) throw new Error('CallNode.body is null');

    const caller = Value.callable(() => Value.fromJS(this.body.render(context)));
    context.set('caller', caller);

    if (!(this.expr instanceof CallExpr)) {
      throw new Error('Invalid call block syntax - expected function call');
    }

    const fn = this.expr.object.evaluate(context);
    if (!fn.isCallable()) throw new Error('Call target must be callable: ' + fn.dump());
    const args = this.expr.args.evaluate(context);
    const result = fn.call(context, args);
    write(result.toStr());
  }
}

// ── Parser ──────────────────────────────────────────────────────────────

class Parser {
  constructor(templateStr, options) {
    this.source = templateStr;
    this.pos = 0;
    this.options = options;
  }

  getLocation() { return { source: this.source, pos: this.pos }; }

  consumeSpaces(mode = 'Strip') {
    if (mode === 'Strip') {
      while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) this.pos++;
    }
    return true;
  }

  peekSymbols(symbols) {
    for (const sym of symbols) {
      if (this.pos + sym.length <= this.source.length && this.source.substring(this.pos, this.pos + sym.length) === sym) return true;
    }
    return false;
  }

  consumeToken(tokenOrRegex, spaceHandling = 'Strip') {
    const start = this.pos;
    this.consumeSpaces(spaceHandling);
    if (typeof tokenOrRegex === 'string') {
      if (this.pos + tokenOrRegex.length <= this.source.length && this.source.substring(this.pos, this.pos + tokenOrRegex.length) === tokenOrRegex) {
        this.pos += tokenOrRegex.length;
        return tokenOrRegex;
      }
      this.pos = start;
      return '';
    }
    const remaining = this.source.substring(this.pos);
    const match = remaining.match(tokenOrRegex);
    if (match && match.index === 0) {
      this.pos += match[0].length;
      return match[0];
    }
    this.pos = start;
    return '';
  }

  consumeTokenGroups(regex, spaceHandling = 'Strip') {
    const start = this.pos;
    this.consumeSpaces(spaceHandling);
    const remaining = this.source.substring(this.pos);
    const match = remaining.match(regex);
    if (match && match.index === 0) {
      this.pos += match[0].length;
      return Array.from(match).map(m => m || '');
    }
    this.pos = start;
    return [];
  }

  parseString() {
    const doParse = (quote) => {
      if (this.pos >= this.source.length || this.source[this.pos] !== quote) return null;
      let result = '';
      let escape = false;
      this.pos++;
      while (this.pos < this.source.length) {
        const c = this.source[this.pos];
        if (escape) {
          escape = false;
          switch (c) {
            case 'n': result += '\n'; break;
            case 'r': result += '\r'; break;
            case 't': result += '\t'; break;
            case 'b': result += '\b'; break;
            case 'f': result += '\f'; break;
            case '\\': result += '\\'; break;
            default: result += (c === quote) ? quote : c; break;
          }
          this.pos++;
        } else if (c === '\\') {
          escape = true;
          this.pos++;
        } else if (c === quote) {
          this.pos++;
          return result;
        } else {
          result += c;
          this.pos++;
        }
      }
      return null;
    };
    this.consumeSpaces();
    if (this.pos >= this.source.length) return null;
    if (this.source[this.pos] === '"') return doParse('"');
    if (this.source[this.pos] === "'") return doParse("'");
    return null;
  }

  parseNumber() {
    const before = this.pos;
    this.consumeSpaces();
    const start = this.pos;
    let hasDecimal = false, hasExponent = false;

    if (this.pos < this.source.length && (this.source[this.pos] === '-' || this.source[this.pos] === '+')) this.pos++;

    while (this.pos < this.source.length) {
      const c = this.source[this.pos];
      if (/\d/.test(c)) { this.pos++; }
      else if (c === '.') {
        if (hasDecimal) throw new Error('Multiple decimal points');
        hasDecimal = true;
        this.pos++;
      } else if (this.pos !== start && (c === 'e' || c === 'E')) {
        if (hasExponent) throw new Error('Multiple exponents');
        hasExponent = true;
        this.pos++;
      } else { break; }
    }

    if (start === this.pos) { this.pos = before; return null; }
    const str = this.source.substring(start, this.pos);
    const num = Number(str);
    if (isNaN(num)) throw new Error("Failed to parse number: '" + str + "'");
    return (hasDecimal || hasExponent) ? { type: 'float', value: num } : { type: 'int', value: num };
  }

  parseConstant() {
    const start = this.pos;
    this.consumeSpaces();
    if (this.pos >= this.source.length) return null;

    if (this.source[this.pos] === '"' || this.source[this.pos] === "'") {
      const str = this.parseString();
      if (str !== null) return Value.fromJS(str);
    }

    const primTok = this.consumeToken(/^(?:true|True|false|False|None)\b/);
    if (primTok) {
      if (primTok === 'true' || primTok === 'True') return Value.fromJS(true);
      if (primTok === 'false' || primTok === 'False') return Value.fromJS(false);
      if (primTok === 'None') return new Value();
    }

    const number = this.parseNumber();
    if (number !== null) return Value.fromPrimitive(number);

    this.pos = start;
    return null;
  }

  parseIdentifier() {
    const loc = this.getLocation();
    const ident = this.consumeToken(/^(?!(?:not|is|and|or|del)\b)[a-zA-Z_]\w*/);
    if (!ident) return null;
    return new VariableExpr(loc, ident);
  }

  parseExpression(allowIfExpr = true) {
    const left = this.parseLogicalOr();
    if (this.pos >= this.source.length) return left;
    if (!allowIfExpr) return left;
    if (!this.consumeToken(/^if\b/)) return left;
    const loc = this.getLocation();
    const [condition, elseExpr] = this.parseIfExpression();
    return new IfExpr(loc, condition, left, elseExpr);
  }

  parseIfExpression() {
    const condition = this.parseLogicalOr();
    if (!condition) throw new Error('Expected condition expression');
    let elseExpr = null;
    if (this.consumeToken(/^else\b/)) {
      elseExpr = this.parseExpression();
      if (!elseExpr) throw new Error("Expected 'else' expression");
    }
    return [condition, elseExpr];
  }

  parseLogicalOr() {
    let left = this.parseLogicalAnd();
    if (!left) throw new Error("Expected left side of 'logical or' expression");
    while (this.consumeToken(/^or\b/)) {
      const right = this.parseLogicalAnd();
      if (!right) throw new Error("Expected right side of 'or' expression");
      left = new BinaryOpExpr(this.getLocation(), left, right, 'Or');
    }
    return left;
  }

  parseLogicalAnd() {
    let left = this.parseLogicalNot();
    if (!left) throw new Error("Expected left side of 'logical and' expression");
    while (this.consumeToken(/^and\b/)) {
      const right = this.parseLogicalNot();
      if (!right) throw new Error("Expected right side of 'and' expression");
      left = new BinaryOpExpr(this.getLocation(), left, right, 'And');
    }
    return left;
  }

  parseLogicalNot() {
    const loc = this.getLocation();
    if (this.consumeToken(/^not\b/)) {
      const sub = this.parseLogicalNot();
      if (!sub) throw new Error("Expected expression after 'not' keyword");
      return new UnaryOpExpr(loc, sub, 'LogicalNot');
    }
    return this.parseLogicalCompare();
  }

  parseLogicalCompare() {
    let left = this.parseStringConcat();
    if (!left) throw new Error("Expected left side of 'logical compare' expression");
    let opStr;
    while ((opStr = this.consumeToken(/^(?:==|!=|<=?|>=?|in\b|is\b|not\s+in\b)/))) {
      const loc = this.getLocation();
      if (opStr === 'is') {
        const negated = !!this.consumeToken(/^not\b/);
        const identifier = this.parseIdentifier();
        if (!identifier) throw new Error("Expected identifier after 'is' keyword");
        return new BinaryOpExpr(left.location, left, identifier, negated ? 'IsNot' : 'Is');
      }
      const right = this.parseStringConcat();
      if (!right) throw new Error("Expected right side of 'logical compare' expression");
      let op;
      if (opStr === '==') op = 'Eq';
      else if (opStr === '!=') op = 'Ne';
      else if (opStr === '<') op = 'Lt';
      else if (opStr === '>') op = 'Gt';
      else if (opStr === '<=') op = 'Le';
      else if (opStr === '>=') op = 'Ge';
      else if (opStr === 'in') op = 'In';
      else if (opStr.startsWith('not')) op = 'NotIn';
      else throw new Error('Unknown comparison operator: ' + opStr);
      left = new BinaryOpExpr(loc, left, right, op);
    }
    return left;
  }

  parseStringConcat() {
    let left = this.parseMathPow();
    if (!left) throw new Error("Expected left side of 'string concat' expression");
    if (this.consumeToken(/^~(?!\})/)) {
      const right = this.parseLogicalAnd();
      if (!right) throw new Error("Expected right side of 'string concat' expression");
      left = new BinaryOpExpr(this.getLocation(), left, right, 'StrConcat');
    }
    return left;
  }

  parseMathPow() {
    let left = this.parseMathPlusMinus();
    if (!left) throw new Error("Expected left side of 'math pow' expression");
    while (this.consumeToken('**')) {
      const right = this.parseMathPlusMinus();
      if (!right) throw new Error("Expected right side of 'math pow' expression");
      left = new BinaryOpExpr(this.getLocation(), left, right, 'MulMul');
    }
    return left;
  }

  parseMathPlusMinus() {
    let left = this.parseMathMulDiv();
    if (!left) throw new Error("Expected left side of 'math plus/minus' expression");
    let opStr;
    while ((opStr = this.consumeToken(/^(?:\+|-(?![}%#]\}))/))) {
      const right = this.parseMathMulDiv();
      if (!right) throw new Error("Expected right side of 'math plus/minus' expression");
      left = new BinaryOpExpr(this.getLocation(), left, right, opStr === '+' ? 'Add' : 'Sub');
    }
    return left;
  }

  parseMathMulDiv() {
    let left = this.parseMathUnaryPlusMinus();
    if (!left) throw new Error("Expected left side of 'math mul/div' expression");
    let opStr;
    while ((opStr = this.consumeToken(/^(?:\*\*?|\/\/?|%(?!\}))/))) {
      const right = this.parseMathUnaryPlusMinus();
      if (!right) throw new Error("Expected right side of 'math mul/div' expression");
      let op;
      if (opStr === '*') op = 'Mul';
      else if (opStr === '**') op = 'MulMul';
      else if (opStr === '/') op = 'Div';
      else if (opStr === '//') op = 'DivDiv';
      else op = 'Mod';
      left = new BinaryOpExpr(this.getLocation(), left, right, op);
    }
    if (this.consumeToken('|')) {
      const expr = this.parseMathMulDiv();
      if (expr instanceof FilterExpr) { expr.prepend(left); return expr; }
      return new FilterExpr(this.getLocation(), [left, expr]);
    }
    return left;
  }

  parseMathUnaryPlusMinus() {
    const opStr = this.consumeToken(/^(?:\+|-(?![}%#]\}))/);
    const expr = this.parseExpansion();
    if (!expr) throw new Error("Expected expr of 'unary plus/minus/expansion' expression");
    if (opStr) return new UnaryOpExpr(this.getLocation(), expr, opStr === '+' ? 'Plus' : 'Minus');
    return expr;
  }

  parseExpansion() {
    const opStr = this.consumeToken(/^\*\*?/);
    const expr = this.parseValueExpression();
    if (!opStr) return expr;
    if (!expr) throw new Error("Expected expr of 'expansion' expression");
    return new UnaryOpExpr(this.getLocation(), expr, opStr === '*' ? 'Expansion' : 'ExpansionDict');
  }

  parseValueExpression() {
    const parseValue = () => {
      const loc = this.getLocation();
      const constant = this.parseConstant();
      if (constant) return new LiteralExpr(loc, constant);
      if (this.consumeToken(/^null\b/)) return new LiteralExpr(loc, new Value());
      const identifier = this.parseIdentifier();
      if (identifier) return identifier;
      const braced = this.parseBracedExpressionOrArray();
      if (braced) return braced;
      const array = this.parseArray();
      if (array) return array;
      const dictionary = this.parseDictionary();
      if (dictionary) return dictionary;
      throw new Error('Expected value expression');
    };

    let value = parseValue();

    while (this.pos < this.source.length && this.consumeSpaces() && this.peekSymbols(['[', '.', '('])) {
      if (this.consumeToken('[')) {
        const sliceLoc = this.getLocation();
        let start = null, end = null, step = null;
        let hasFirstColon = false, hasSecondColon = false;

        if (!this.peekSymbols([':'])) start = this.parseExpression();

        if (this.consumeToken(':')) {
          hasFirstColon = true;
          if (!this.peekSymbols([':', ']'])) end = this.parseExpression();
          if (this.consumeToken(':')) {
            hasSecondColon = true;
            if (!this.peekSymbols([']'])) step = this.parseExpression();
          }
        }

        let index;
        if (hasFirstColon || hasSecondColon) index = new SliceExpr(sliceLoc, start, end, step);
        else index = start;
        if (!index) throw new Error('Empty index in subscript');
        if (!this.consumeToken(']')) throw new Error('Expected closing bracket in subscript');
        value = new SubscriptExpr(value.location, value, index);
      } else if (this.consumeToken('.')) {
        const identifier = this.parseIdentifier();
        if (!identifier) throw new Error('Expected identifier in subscript');
        this.consumeSpaces();
        if (this.peekSymbols(['('])) {
          value = new MethodCallExpr(identifier.location, value, identifier, this.parseCallArgs());
        } else {
          value = new SubscriptExpr(identifier.location, value, new LiteralExpr(identifier.location, Value.fromJS(identifier.getName())));
        }
      } else if (this.peekSymbols(['('])) {
        const loc = this.getLocation();
        value = new CallExpr(loc, value, this.parseCallArgs());
      }
      this.consumeSpaces();
    }
    return value;
  }

  parseCallArgs() {
    this.consumeSpaces();
    if (!this.consumeToken('(')) throw new Error('Expected opening parenthesis in call args');
    const result = new ArgumentsExpression();
    while (this.pos < this.source.length) {
      if (this.consumeToken(')')) return result;
      const expr = this.parseExpression();
      if (!expr) throw new Error('Expected expression in call args');
      if (expr instanceof VariableExpr) {
        if (this.consumeToken('=')) {
          const value = this.parseExpression();
          if (!value) throw new Error('Expected expression in for named arg');
          result.kwargs.push([expr.getName(), value]);
        } else {
          result.args.push(expr);
        }
      } else {
        result.args.push(expr);
      }
      if (!this.consumeToken(',')) {
        if (!this.consumeToken(')')) throw new Error('Expected closing parenthesis in call args');
        return result;
      }
    }
    throw new Error('Expected closing parenthesis in call args');
  }

  parseParameters() {
    this.consumeSpaces();
    if (!this.consumeToken('(')) throw new Error('Expected opening parenthesis in param list');
    const result = [];
    while (this.pos < this.source.length) {
      if (this.consumeToken(')')) return result;
      const expr = this.parseExpression();
      if (!expr) throw new Error('Expected expression in call args');
      if (expr instanceof VariableExpr) {
        if (this.consumeToken('=')) {
          const value = this.parseExpression();
          if (!value) throw new Error('Expected expression in for named arg');
          result.push([expr.getName(), value]);
        } else {
          result.push([expr.getName(), null]);
        }
      } else {
        result.push(['', expr]);
      }
      if (!this.consumeToken(',')) {
        if (!this.consumeToken(')')) throw new Error('Expected closing parenthesis in call args');
        return result;
      }
    }
    throw new Error('Expected closing parenthesis in call args');
  }

  parseBracedExpressionOrArray() {
    if (!this.consumeToken('(')) return null;
    const expr = this.parseExpression();
    if (!expr) throw new Error('Expected expression in braced expression');
    if (this.consumeToken(')')) return expr;
    const tuple = [expr];
    while (this.pos < this.source.length) {
      if (!this.consumeToken(',')) throw new Error('Expected comma in tuple');
      const next = this.parseExpression();
      if (!next) throw new Error('Expected expression in tuple');
      tuple.push(next);
      if (this.consumeToken(')')) return new ArrayExpr(this.getLocation(), tuple);
    }
    throw new Error('Expected closing parenthesis');
  }

  parseArray() {
    if (!this.consumeToken('[')) return null;
    const elements = [];
    if (this.consumeToken(']')) return new ArrayExpr(this.getLocation(), elements);
    elements.push(this.parseExpression());
    while (this.pos < this.source.length) {
      if (this.consumeToken(',')) { elements.push(this.parseExpression()); }
      else if (this.consumeToken(']')) { return new ArrayExpr(this.getLocation(), elements); }
      else { throw new Error('Expected comma or closing bracket in array'); }
    }
    throw new Error('Expected closing bracket');
  }

  parseDictionary() {
    if (!this.consumeToken('{')) return null;
    const elements = [];
    if (this.consumeToken('}')) return new DictExpr(this.getLocation(), elements);
    const parseKV = () => {
      const key = this.parseExpression();
      if (!key) throw new Error('Expected key in dictionary');
      if (!this.consumeToken(':')) throw new Error('Expected colon betweek key & value in dictionary');
      const value = this.parseExpression();
      if (!value) throw new Error('Expected value in dictionary');
      elements.push([key, value]);
    };
    parseKV();
    while (this.pos < this.source.length) {
      if (this.consumeToken(',')) { parseKV(); }
      else if (this.consumeToken('}')) { return new DictExpr(this.getLocation(), elements); }
      else { throw new Error('Expected comma or closing brace in dictionary'); }
    }
    throw new Error('Expected closing brace');
  }

  parseVarNames() {
    const group = this.consumeTokenGroups(/^((?:\w+)(?:\s*,\s*(?:\w+))*)\s*/);
    if (!group.length) throw new Error('Expected variable names');
    return group[1].split(',').map(s => s.trim());
  }

  // ── Tokenizer ───────────────────────────────────────────────────────

  tokenize() {
    const tokens = [];
    try {
      while (this.pos < this.source.length) {
        const location = this.getLocation();
        let group;

        if ((group = this.consumeTokenGroups(/^\{#(-?)([\s\S]*?)(-?)#\}/, 'Keep')).length) {
          tokens.push({ type: 'Comment', location, preSpace: group[1] === '-' ? 'Strip' : 'Keep', postSpace: group[3] === '-' ? 'Strip' : 'Keep', text: group[2] });
        } else if ((group = this.consumeTokenGroups(/^\{\{(-?)/, 'Keep')).length) {
          const preSpace = group[1] === '-' ? 'Strip' : 'Keep';
          const expr = this.parseExpression();
          group = this.consumeTokenGroups(/^\s*(-?)\}\}/);
          if (!group.length) throw new Error('Expected closing expression tag');
          tokens.push({ type: 'Expression', location, preSpace, postSpace: group[1] === '-' ? 'Strip' : 'Keep', expr });
        } else if ((group = this.consumeTokenGroups(/^\{%(-?)\s*/, 'Keep')).length) {
          const preSpace = group[1] === '-' ? 'Strip' : 'Keep';
          const parseBlockClose = () => {
            const g = this.consumeTokenGroups(/^\s*(-?)%\}/);
            if (!g.length) throw new Error('Expected closing block tag');
            return g[1] === '-' ? 'Strip' : 'Keep';
          };
          const keyword = this.consumeToken(/^(?:if|else|elif|endif|for|endfor|generation|endgeneration|set|endset|block|endblock|macro|endmacro|filter|endfilter|break|continue|call|endcall)\b/);
          if (!keyword) throw new Error('Expected block keyword');

          if (keyword === 'if') {
            const condition = this.parseExpression();
            tokens.push({ type: 'If', location, preSpace, postSpace: parseBlockClose(), condition });
          } else if (keyword === 'elif') {
            const condition = this.parseExpression();
            tokens.push({ type: 'Elif', location, preSpace, postSpace: parseBlockClose(), condition });
          } else if (keyword === 'else') {
            tokens.push({ type: 'Else', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'endif') {
            tokens.push({ type: 'EndIf', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'for') {
            const varNames = this.parseVarNames();
            if (!this.consumeToken(/^in\b/)) throw new Error("Expected 'in' keyword in for block");
            const iterable = this.parseExpression(false);
            let condition = null;
            if (this.consumeToken(/^if\b/)) condition = this.parseExpression();
            const recursive = !!this.consumeToken(/^recursive\b/);
            tokens.push({ type: 'For', location, preSpace, postSpace: parseBlockClose(), varNames, iterable, condition, recursive });
          } else if (keyword === 'endfor') {
            tokens.push({ type: 'EndFor', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'generation') {
            tokens.push({ type: 'Generation', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'endgeneration') {
            tokens.push({ type: 'EndGeneration', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'set') {
            let ns = '', varNames, value = null;
            const nsGroup = this.consumeTokenGroups(/^(\w+)\s*\.\s*(\w+)/);
            if (nsGroup.length) {
              ns = nsGroup[1]; varNames = [nsGroup[2]];
              if (!this.consumeToken('=')) throw new Error('Expected equals sign in set block');
              value = this.parseExpression();
            } else {
              varNames = this.parseVarNames();
              if (this.consumeToken('=')) value = this.parseExpression();
            }
            tokens.push({ type: 'Set', location, preSpace, postSpace: parseBlockClose(), ns, varNames, value });
          } else if (keyword === 'endset') {
            tokens.push({ type: 'EndSet', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'macro') {
            const name = this.parseIdentifier();
            if (!name) throw new Error('Expected macro name');
            const params = this.parseParameters();
            tokens.push({ type: 'Macro', location, preSpace, postSpace: parseBlockClose(), name, params });
          } else if (keyword === 'endmacro') {
            tokens.push({ type: 'EndMacro', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'call') {
            const expr = this.parseExpression();
            tokens.push({ type: 'Call', location, preSpace, postSpace: parseBlockClose(), expr });
          } else if (keyword === 'endcall') {
            tokens.push({ type: 'EndCall', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'filter') {
            const filter = this.parseExpression();
            tokens.push({ type: 'Filter', location, preSpace, postSpace: parseBlockClose(), filter });
          } else if (keyword === 'endfilter') {
            tokens.push({ type: 'EndFilter', location, preSpace, postSpace: parseBlockClose() });
          } else if (keyword === 'break' || keyword === 'continue') {
            tokens.push({ type: keyword === 'break' ? 'Break' : 'Continue', location, preSpace, postSpace: parseBlockClose(), controlType: keyword === 'break' ? LoopControlType.Break : LoopControlType.Continue });
          } else if (keyword === 'block' || keyword === 'endblock') {
            parseBlockClose(); // skip
          } else {
            throw new Error('Unexpected block: ' + keyword);
          }
        } else {
          const remaining = this.source.substring(this.pos);
          const match = remaining.match(/\{\{|\{%|\{#/);
          if (match && match.index > 0) {
            tokens.push({ type: 'Text', location, preSpace: 'Keep', postSpace: 'Keep', text: remaining.substring(0, match.index) });
            this.pos += match.index;
          } else if (match && match.index === 0) {
            if (match[0] === '{#') throw new Error('Missing end of comment tag');
            throw new Error('Internal error: Expected a comment');
          } else {
            tokens.push({ type: 'Text', location, preSpace: 'Keep', postSpace: 'Keep', text: remaining });
            this.pos = this.source.length;
          }
        }
      }
      return tokens;
    } catch (e) {
      if (!e._hasLocation) {
        e.message += errorLocationSuffix(this.source, this.pos);
        e._hasLocation = true;
      }
      throw e;
    }
  }

  // ── Template builder ────────────────────────────────────────────────

  buildTemplate(tokens, state, fully = false) {
    const children = [];
    while (state.pos < tokens.length) {
      const startPos = state.pos;
      const token = tokens[state.pos++];

      if (token.type === 'If') {
        const cascade = [[token.condition, this.buildTemplate(tokens, state)]];
        while (state.pos < tokens.length && tokens[state.pos].type === 'Elif') {
          const et = tokens[state.pos++];
          cascade.push([et.condition, this.buildTemplate(tokens, state)]);
        }
        if (state.pos < tokens.length && tokens[state.pos].type === 'Else') {
          state.pos++;
          cascade.push([null, this.buildTemplate(tokens, state)]);
        }
        if (state.pos >= tokens.length || tokens[state.pos++].type !== 'EndIf') {
          throw new Error('Unterminated if' + errorLocationSuffix(this.source, tokens[startPos].location.pos));
        }
        children.push(new IfNode(token.location, cascade));
      } else if (token.type === 'For') {
        const body = this.buildTemplate(tokens, state);
        let elseBody = null;
        if (state.pos < tokens.length && tokens[state.pos].type === 'Else') {
          state.pos++;
          elseBody = this.buildTemplate(tokens, state);
        }
        if (state.pos >= tokens.length || tokens[state.pos++].type !== 'EndFor') {
          throw new Error('Unterminated for' + errorLocationSuffix(this.source, tokens[startPos].location.pos));
        }
        children.push(new ForNode(token.location, token.varNames, token.iterable, token.condition, body, token.recursive, elseBody));
      } else if (token.type === 'Generation') {
        const body = this.buildTemplate(tokens, state);
        if (state.pos >= tokens.length || tokens[state.pos++].type !== 'EndGeneration') {
          throw new Error('Unterminated generation' + errorLocationSuffix(this.source, tokens[startPos].location.pos));
        }
        children.push(body);
      } else if (token.type === 'Text') {
        const prevToken = state.pos - 1 > 0 ? tokens[state.pos - 2] : null;
        const nextToken = state.pos < tokens.length ? tokens[state.pos] : null;
        const preSpace = prevToken ? prevToken.postSpace : 'Keep';
        const postSpace = nextToken ? nextToken.preSpace : 'Keep';

        let text = token.text;

        if (postSpace === 'Strip') {
          text = text.replace(/\s+$/, '');
        } else if (this.options.lstrip_blocks && nextToken) {
          let i = text.length;
          while (i > 0 && (text[i - 1] === ' ' || text[i - 1] === '\t')) i--;
          if ((i === 0 && !prevToken) || (i > 0 && text[i - 1] === '\n')) {
            text = text.substring(0, i);
          }
        }

        if (preSpace === 'Strip') {
          text = text.replace(/^\s+/, '');
        } else if (this.options.trim_blocks && prevToken && prevToken.type !== 'Expression') {
          if (text.length > 0 && text[0] === '\n') text = text.substring(1);
        }

        if (state.pos >= tokens.length && !this.options.keep_trailing_newline) {
          let i = text.length;
          if (i > 0 && text[i - 1] === '\n') {
            i--;
            if (i > 0 && text[i - 1] === '\r') i--;
            text = text.substring(0, i);
          }
        }

        children.push(new TextNode(token.location, text));
      } else if (token.type === 'Expression') {
        children.push(new ExpressionNode(token.location, token.expr));
      } else if (token.type === 'Set') {
        if (token.value) {
          children.push(new SetNode(token.location, token.ns, token.varNames, token.value));
        } else {
          const valueTemplate = this.buildTemplate(tokens, state);
          if (state.pos >= tokens.length || tokens[state.pos++].type !== 'EndSet') {
            throw new Error('Unterminated set' + errorLocationSuffix(this.source, tokens[startPos].location.pos));
          }
          children.push(new SetTemplateNode(token.location, token.varNames[0], valueTemplate));
        }
      } else if (token.type === 'Macro') {
        const body = this.buildTemplate(tokens, state);
        if (state.pos >= tokens.length || tokens[state.pos++].type !== 'EndMacro') {
          throw new Error('Unterminated macro' + errorLocationSuffix(this.source, tokens[startPos].location.pos));
        }
        children.push(new MacroNode(token.location, token.name, token.params, body));
      } else if (token.type === 'Call') {
        const body = this.buildTemplate(tokens, state);
        if (state.pos >= tokens.length || tokens[state.pos++].type !== 'EndCall') {
          throw new Error('Unterminated call' + errorLocationSuffix(this.source, tokens[startPos].location.pos));
        }
        children.push(new CallNode(token.location, token.expr, body));
      } else if (token.type === 'Filter') {
        const body = this.buildTemplate(tokens, state);
        if (state.pos >= tokens.length || tokens[state.pos++].type !== 'EndFilter') {
          throw new Error('Unterminated filter' + errorLocationSuffix(this.source, tokens[startPos].location.pos));
        }
        children.push(new FilterNode(token.location, token.filter, body));
      } else if (token.type === 'Comment') {
        // skip
      } else if (token.type === 'Break' || token.type === 'Continue') {
        children.push(new LoopControlNode(token.location, token.controlType));
      } else if (['EndFor', 'EndSet', 'EndMacro', 'EndCall', 'EndFilter', 'EndIf', 'Else', 'EndGeneration', 'Elif'].includes(token.type)) {
        state.pos--;
        break;
      } else {
        throw new Error('Unexpected ' + token.type + errorLocationSuffix(this.source, token.location.pos));
      }
    }

    if (fully && state.pos < tokens.length) {
      const tok = tokens[state.pos];
      throw new Error('Unexpected ' + tok.type.toLowerCase() + errorLocationSuffix(this.source, tok.location.pos));
    }

    if (children.length === 0) return new TextNode({ source: this.source, pos: 0 }, '');
    if (children.length === 1) return children[0];
    return new SequenceNode(children[0]._location, children);
  }

  static parse(templateStr, options = {}) {
    const opts = {
      trim_blocks: options.trimBlocks || false,
      lstrip_blocks: options.lstripBlocks || false,
      keep_trailing_newline: options.keepTrailingNewline || false,
    };
    const normalized = templateStr.replace(/\r\n/g, '\n');
    const parser = new Parser(normalized, opts);
    const tokens = parser.tokenize();
    return parser.buildTemplate(tokens, { pos: 0 }, true);
  }
}

// ── Builtins ────────────────────────────────────────────────────────────

function simpleFunction(fnName, params, fn) {
  const namedPositions = new Map();
  for (let i = 0; i < params.length; i++) namedPositions.set(params[i], i);

  return Value.callable((context, args) => {
    const argsObj = Value.object();
    const provided = new Array(params.length).fill(false);
    for (let i = 0; i < args.args.length; i++) {
      if (i < params.length) { argsObj.set(params[i], args.args[i]); provided[i] = true; }
      else throw new Error('Too many positional params for ' + fnName);
    }
    for (const [name, value] of args.kwargs) {
      const pos = namedPositions.get(name);
      if (pos === undefined) throw new Error('Unknown argument ' + name + ' for function ' + fnName);
      provided[pos] = true;
      argsObj.set(name, value);
    }
    return fn(context, argsObj);
  });
}

function _createBuiltins() {
  const globals = Value.object();

  globals.set('raise_exception', simpleFunction('raise_exception', ['message'], (_ctx, args) => {
    throw new Error(args.get('message').value);
  }));

  globals.set('tojson', simpleFunction('tojson', ['value', 'indent', 'ensure_ascii'], (_ctx, args) => {
    const indent = args.contains('indent') && !args.get('indent').isNull() ? args.get('indent').value : -1;
    return Value.fromJS(args.get('value').dump(indent, true));
  }));

  globals.set('items', simpleFunction('items', ['object'], (_ctx, args) => {
    const items = Value.array();
    if (args.contains('object')) {
      const obj = args.get('object');
      if (!obj.isObject()) throw new Error('Can only get item pairs from a mapping');
      for (const key of obj.keys()) items.pushBack(Value.array([key, obj.at(key)]));
    }
    return items;
  }));

  globals.set('last', simpleFunction('last', ['items'], (_ctx, args) => {
    const items = args.get('items');
    if (!items.isArray()) throw new Error('object is not a list');
    if (items.empty()) return new Value();
    return items.at(items.size - 1);
  }));

  globals.set('first', simpleFunction('first', ['items'], (_ctx, args) => {
    const items = args.get('items');
    if (!items.isArray()) throw new Error('object is not a list');
    if (items.empty()) return new Value();
    return items.at(0);
  }));

  globals.set('trim', simpleFunction('trim', ['text'], (_ctx, args) => {
    const text = args.get('text');
    return text.isNull() ? text : Value.fromJS(strip(text.value));
  }));

  globals.set('capitalize', simpleFunction('capitalize', ['text'], (_ctx, args) => {
    const text = args.get('text');
    if (text.isNull()) return text;
    if (!text.isString()) throw new Error('Type must be string, but is ' + typeof text.value);
    return Value.fromJS(capitalize(text.value));
  }));

  const charTf = (name, fn) => simpleFunction(name, ['text'], (_ctx, args) => {
    const t = args.get('text');
    return t.isNull() ? t : Value.fromJS(fn(t.value));
  });

  globals.set('lower', charTf('lower', s => s.toLowerCase()));
  globals.set('upper', charTf('upper', s => s.toUpperCase()));

  globals.set('default', Value.callable((_ctx, args) => {
    args.expectArgs('default', [2, 3], [0, 1]);
    const value = args.args[0], defaultValue = args.args[1];
    let boolean = false;
    if (args.args.length === 3) boolean = args.args[2].value;
    else { const bv = args.getNamed('boolean'); if (!bv.isNull()) boolean = bv.value; }
    return boolean ? (value.toBool() ? value : defaultValue) : (value.isNull() ? defaultValue : value);
  }));

  const escape = simpleFunction('escape', ['text'], (_ctx, args) => Value.fromJS(htmlEscape(args.get('text').value)));
  globals.set('e', escape);
  globals.set('escape', escape);

  globals.set('joiner', simpleFunction('joiner', ['sep'], (_ctx, args) => {
    const sep = args.contains('sep') && !args.get('sep').isNull() ? args.get('sep').value : '';
    let first = true;
    return simpleFunction('', [], () => {
      if (first) { first = false; return Value.fromJS(''); }
      return Value.fromJS(sep);
    });
  }));

  globals.set('count', simpleFunction('count', ['items'], (_ctx, args) => Value.fromJS(args.get('items').size)));

  globals.set('dictsort', simpleFunction('dictsort', ['value'], (_ctx, args) => {
    const v = args.get('value');
    const keys = v.keys();
    keys.sort((a, b) => a.lt(b) ? -1 : a.gt(b) ? 1 : 0);
    const res = Value.array();
    for (const k of keys) res.pushBack(Value.array([k, v.at(k)]));
    return res;
  }));

  globals.set('join', simpleFunction('join', ['items', 'd'], (_ctx, args) => {
    const doJoin = (items, sep) => {
      if (!items.isArray()) throw new Error('object is not iterable: ' + items.dump());
      let r = '';
      for (let i = 0; i < items.size; i++) { if (i) r += sep; r += items.at(i).toStr(); }
      return Value.fromJS(r);
    };
    const sep = args.contains('d') && !args.get('d').isNull() ? args.get('d').value : '';
    if (args.contains('items')) return doJoin(args.get('items'), sep);
    return simpleFunction('', ['items'], (_c, a) => doJoin(a.get('items'), sep));
  }));

  globals.set('namespace', Value.callable((_ctx, args) => {
    const ns = Value.object();
    for (const [name, value] of args.kwargs) ns.set(name, value);
    return ns;
  }));

  const equalto = simpleFunction('equalto', ['expected', 'actual'], (_ctx, args) => Value.fromJS(args.get('actual').eq(args.get('expected'))));
  globals.set('equalto', equalto);
  globals.set('==', equalto);

  globals.set('length', simpleFunction('length', ['items'], (_ctx, args) => Value.fromJS(args.get('items').size)));
  globals.set('safe', simpleFunction('safe', ['value'], (_ctx, args) => Value.fromJS(args.get('value').toStr())));
  globals.set('string', simpleFunction('string', ['value'], (_ctx, args) => Value.fromJS(args.get('value').toStr())));
  globals.set('int', simpleFunction('int', ['value'], (_ctx, args) => Value.fromJS(args.get('value').toInt())));
  globals.set('list', simpleFunction('list', ['items'], (_ctx, args) => {
    const items = args.get('items');
    if (!items.isArray()) throw new Error('object is not iterable');
    return items;
  }));
  globals.set('in', simpleFunction('in', ['item', 'items'], (_ctx, args) => Value.fromJS(valueIn(args.get('item'), args.get('items')))));
  globals.set('unique', simpleFunction('unique', ['items'], (_ctx, args) => {
    const items = args.get('items');
    if (!items.isArray()) throw new Error('object is not iterable');
    const seen = new Set(), result = Value.array();
    for (let i = 0; i < items.size; i++) {
      const item = items.at(i);
      if (!item.isHashable()) throw new Error('Unsupported type for hashing: ' + item.dump());
      const key = item.dump();
      if (!seen.has(key)) { seen.add(key); result.pushBack(item); }
    }
    return result;
  }));

  const makeFilter = (filter, extraArgs) => simpleFunction('', ['value'], (context, args) => {
    const a = new ArgumentsValue();
    a.args.push(args.get('value'));
    for (let i = 0; i < extraArgs.size; i++) a.args.push(extraArgs.at(i));
    return filter.call(context, a);
  });

  const selectOrReject = (isSelect) => Value.callable((context, args) => {
    args.expectArgs(isSelect ? 'select' : 'reject', [2, Infinity], [0, 0]);
    const items = args.args[0];
    if (items.isNull()) return Value.array();
    if (!items.isArray()) throw new Error('object is not iterable: ' + items.dump());
    const filterFn = context.get(args.args[1]);
    if (filterFn.isNull()) throw new Error('Undefined filter: ' + args.args[1].dump());
    const fa = Value.array();
    for (let i = 2; i < args.args.length; i++) fa.pushBack(args.args[i]);
    const filter = makeFilter(filterFn, fa);
    const res = Value.array();
    for (let i = 0; i < items.size; i++) {
      const item = items.at(i);
      const fca = new ArgumentsValue(); fca.args.push(item);
      if (filter.call(context, fca).toBool() === isSelect) res.pushBack(item);
    }
    return res;
  });
  globals.set('select', selectOrReject(true));
  globals.set('reject', selectOrReject(false));

  globals.set('map', Value.callable((context, args) => {
    const res = Value.array();
    if (args.args.length === 1 && ((args.hasNamed('attribute') && args.kwargs.length === 1) || (args.hasNamed('default') && args.kwargs.length === 2))) {
      const items = args.args[0], attrName = args.getNamed('attribute'), defaultValue = args.getNamed('default');
      for (let i = 0; i < items.size; i++) {
        const attr = items.at(i).get(attrName);
        res.pushBack(attr.isNull() ? defaultValue : attr);
      }
    } else if (args.kwargs.length === 0 && args.args.length >= 2) {
      const fn = context.get(args.args[1]);
      if (fn.isNull()) throw new Error('Undefined filter: ' + args.args[1].dump());
      const fa = new ArgumentsValue(); fa.args.push(new Value());
      for (let i = 2; i < args.args.length; i++) fa.args.push(args.args[i]);
      for (let i = 0; i < args.args[0].size; i++) { fa.args[0] = args.args[0].at(i); res.pushBack(fn.call(context, fa)); }
    } else throw new Error('Invalid or unsupported arguments for map');
    return res;
  }));

  globals.set('indent', simpleFunction('indent', ['text', 'indent', 'first'], (_ctx, args) => {
    const text = args.get('text').value;
    const firstIndent = args.contains('first') && !args.get('first').isNull() ? args.get('first').toBool() : false;
    const indentStr = ' '.repeat(args.contains('indent') && !args.get('indent').isNull() ? args.get('indent').value : 0);
    // Mimic C++ std::getline behavior: split by \n but don't create trailing empty element
    let lines = text.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '' && text.endsWith('\n')) {
      lines = lines.slice(0, -1);
    }
    let out = '';
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) out += '\n';
      if (i > 0 || firstIndent) out += indentStr;
      out += lines[i];
    }
    if (text.length > 0 && text[text.length - 1] === '\n') out += '\n';
    return Value.fromJS(out);
  }));

  const selectOrRejectAttr = (isSelect) => Value.callable((context, args) => {
    args.expectArgs(isSelect ? 'selectattr' : 'rejectattr', [2, Infinity], [0, 0]);
    const items = args.args[0];
    if (items.isNull()) return Value.array();
    if (!items.isArray()) throw new Error('object is not iterable: ' + items.dump());
    const attrName = args.args[1].value;
    let hasTest = false, testFn;
    const testArgs = new ArgumentsValue(); testArgs.args.push(new Value());
    if (args.args.length >= 3) {
      hasTest = true;
      testFn = context.get(args.args[2]);
      if (testFn.isNull()) throw new Error('Undefined test: ' + args.args[2].dump());
      for (let i = 3; i < args.args.length; i++) testArgs.args.push(args.args[i]);
      testArgs.kwargs = args.kwargs;
    }
    const res = Value.array();
    for (let i = 0; i < items.size; i++) {
      const item = items.at(i), attr = item.get(attrName);
      if (hasTest) { testArgs.args[0] = attr; if (testFn.call(context, testArgs).toBool() === isSelect) res.pushBack(item); }
      else res.pushBack(attr);
    }
    return res;
  });
  globals.set('selectattr', selectOrRejectAttr(true));
  globals.set('rejectattr', selectOrRejectAttr(false));

  globals.set('range', Value.callable((_ctx, args) => {
    const ses = [0, 0, 1], ps = [false, false, false];
    if (args.args.length === 1) { ses[1] = args.args[0].value; ps[1] = true; }
    else { for (let i = 0; i < args.args.length; i++) { ses[i] = args.args[i].value; ps[i] = true; } }
    for (const [n, v] of args.kwargs) {
      let i; if (n === 'start') i = 0; else if (n === 'end') i = 1; else if (n === 'step') i = 2;
      else throw new Error('Unknown argument ' + n + ' for function range');
      if (ps[i]) throw new Error('Duplicate argument ' + n + ' for function range');
      ses[i] = v.value; ps[i] = true;
    }
    if (!ps[1]) throw new Error("Missing required argument 'end' for function range");
    const start = ps[0] ? ses[0] : 0, end = ses[1], step = ps[2] ? ses[2] : 1;
    const res = Value.array();
    if (step > 0) { for (let i = start; i < end; i += step) res.pushBack(Value.fromJS(i)); }
    else { for (let i = start; i > end; i += step) res.pushBack(Value.fromJS(i)); }
    return res;
  }));

  return new Context(globals);
}
export { Parser, Context, Value };
