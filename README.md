# Introduction

## Why it was made

JavaScript intrinsics such as `Number`, `String`, `Array`, and `Object` are not ordinary constructors. They combine callable behavior, `new` behavior, internal slots, coercion rules, and prototype dispatch in ways that cannot normally be recreated in user code.

This project exists to explore what happens when those restrictions are removed.

The goal is to recreate *intrinsic-like behavior* entirely in userland while keeping everything mutable, inspectable, and overridable. Nothing is frozen, hidden, or engine-locked. If JavaScript allows it to be changed, this project lets you change it.

---

## Main Premise: `Intrinsics`

The core idea is to treat intrinsics as **blueprints** rather than fixed engine objects.

A blueprint defines:

- how values are constructed
- how internal data is stored
- how coercion works
- how prototype methods are resolved

Instead of cloning behavior, the system references existing intrinsics and re-routes their behavior through a controllable layer.

Key concepts include:

- callable constructors that work with or without `new`
- explicit internal data storage via symbols
- user-defined coercion using `valueOf` and `Symbol.toPrimitive`
- prototype mutation that affects existing instances

Example:

```js
const MyNumber = Native.convert(Number);

const n = MyNumber(42);
const m = new MyNumber(100);

console.log(n + 8); // 50
console.log(m + 10); // 110
```

---

# User Notes

## All User Features

- Blueprint conversion

  - `Native.convert(Number)` creates a mutable intrinsic blueprint
  - The resulting function behaves like the original intrinsic

- Construction behavior

  - Calling without `new` returns a literal value
  - Calling with `new` returns a boxed object
  - Both share the same prototype

- Internal data access

  - Each instance stores its primitive value in a symbol
  - The symbol is exposed as `Blueprint.DATA`

- Coercion control

  - Overriding `valueOf` affects arithmetic and comparisons
  - Overriding `toString` affects string conversion
  - `Symbol.toPrimitive` is supported when present

- Full mutability

  - Prototype methods can be added, removed, or replaced
  - Static properties can be added freely
  - Existing instances reflect prototype changes immediately

---

## Example User Programs / Addons
### Instance
```js
const MyNumber = convertNative(Number);

const n = MyNumber(10);
console.log(n + 5); // 15
```
---
### (`.valueOf`)
```js
const MyNumber = convertNative(Number);

MyNumber.prototype.valueOf = function () {
  return this[MyNumber.DATA] * 2;
};

const n = MyNumber(10);
console.log(n + 5); // 25
```
---
### Custom Method (`.toString`)
```js
const MyNumber = convertNative(Number);

MyNumber.prototype.toString = function () {
  return `MyNumber(${this[MyNumber.DATA]})`;
};

MyNumber.prototype.customMethod = function () {
  return "hello";
};

const n = MyNumber(7);
console.log(String(n));       // "MyNumber(7)"
console.log(n.customMethod()); // "hello"
```
---

# Developer Notes

## All Developer Features

- Reference-based design
  - The system does not clone intrinsic methods. It keeps references to original functions where possible.
- Read-only tolerant conversion
  - Non-writable or non-configurable properties are skipped during blueprint creation instead of causing failures.
- Unified call and construct path
  - The same internal logic handles both `MyType(x)` and `new MyType(x)`.
- Symbol-based internal slots
  - Internal data is stored using symbols rather than closures or weak maps.
- Live prototype linkage
  - Instances do not snapshot behavior. Prototype edits affect all instances immediately.

---

## Example Developer Programs / Addons
### Override
```js
const MyString = convertNative(String);

MyString.prototype.repeat = function () {
  return "overridden";
};

console.log(MyString("abc").repeat(3)); // "overridden"
```
---
### Intercept
```js
const MyArray = convertNative(Array);

MyArray.prototype.push = function (...items) {
  console.log("Intercepted:", items);
  return Array.prototype.push.apply(this, items);
};

const a = MyArray();
a.push(1, 2, 3);
```
---
### Alter
```js
const MyBoolean = convertNative(Boolean);

MyBoolean.prototype.valueOf = function () {
  return !this[MyBoolean.DATA];
};

const b = MyBoolean(true);
console.log(b == false); // true
```
---

# Outro

## Use Cases

This project is useful for:

- experimenting with JavaScript coercion rules
- understanding how intrinsics actually behave
- building custom numeric or logical systems
- sandboxing or VM-like environments
- teaching advanced JavaScript internals
- prototyping language features

It is intentionally powerful and intentionally unsafe.

---

## Full Example: Everything Together

```js
const MyNumber = Native.convert(Number);

MyNumber.prototype.valueOf = function () {
  return this[MyNumber.DATA] * 3;
};

MyNumber.prototype.toString = function () {
  return `MyNumber(${this[MyNumber.DATA]})`;
};

MyNumber.prototype.customMethod = function () {
  return "works";
};

const n1 = MyNumber(10);
const n2 = new MyNumber(20);

console.log(n1 + 1);           // 31
console.log(n2 + 1);           // 61
console.log(String(n1));       // "MyNumber(10)"
console.log(n2.customMethod()); // "works"
```
