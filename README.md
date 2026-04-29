# Bloxd-Intrinsics

## Why it was made

JavaScript intrinsics such as `Number`, `String`, `Array`, and `Object` are not ordinary constructors. They combine callable behavior, `new` behavior, internal slots, coercion rules, and prototype dispatch in ways that cannot normally be recreated in user code.

This project exists to explore what happens when those restrictions are removed.

The goal is to recreate intrinsic-like behavior entirely in userland while keeping everything mutable, inspectable, and overridable. Nothing is frozen, hidden, or engine-locked. If JavaScript allows it to be changed, this project lets you change it.

---

## Main Premise: `Natives`

The core idea is to treat intrinsics as **blueprints** rather than fixed engine objects.

A blueprint defines:
- how values are constructed
- how internal data is stored
- how coercion works
- how prototype methods are resolved

`convertNative` derives a blueprint from an existing JS intrinsic. That blueprint can then be edited directly before being passed to `createNative`, which builds the final constructor.

```js
// derive blueprint from existing intrinsic
const NumberBlueprint = convertNative(Number)

// edit the blueprint before creating
NumberBlueprint.proto.double = function() {
  return this[MyNumber.DATA] * 2
}

// build the constructor from the blueprint
const MyNumber = createNative(NumberBlueprint)
```

`createNative` can also build a type from scratch with no existing intrinsic:

```js
const MyNum = createNative({
  coerce: x => Number(x),
  proto: {
    double() { return this[MyNum.DATA] * 2 }
  }
})
```

Both paths produce a constructor that:
- works with or without `new`
- stores internal data in a symbol slot
- exposes `valueOf`, `toString`, and `Symbol.toPrimitive`
- allows full prototype mutation that reflects on all existing instances

---

# Notes

## All User Features

- `convertNative(GlobalObj)` — derives a mutable blueprint from an existing intrinsic, ready to edit before passing to `createNative`
- `createNative(blueprint)` — builds a new intrinsic-like constructor from a blueprint object
- **callable without `new`** — returns a literal value
- **callable with `new`** — returns a boxed object instance
- **`Blueprint.DATA`** — symbol key that holds the internal primitive value on each instance
- **`valueOf`** — override to change arithmetic and comparison behaviour
- **`toString`** — override to change string conversion behaviour
- **`Symbol.toPrimitive`** — supported automatically on all instances
- **live prototype** — adding, removing, or replacing prototype methods affects all existing instances immediately
- **`instanceof`** — works via `Symbol.hasInstance`, checks for presence of `DATA` slot rather than prototype chain

---

## `blueprint` object

the blueprint is a plain object — it can be edited freely between `convertNative` and `createNative`

| Field | What it does |
|---|---|
| `coerce` | function applied to input on construction — defaults to identity |
| `proto` | object whose properties are copied to the prototype |
| `protoProto` | prototype of the prototype — defaults to `Object.prototype` |
| `constructorProto` | prototype of the constructor function itself — defaults to `Function.prototype` |
| `wrapBuiltIns` | existing intrinsic whose prototype methods are forwarded automatically |
| `unwrapThis` | if `true`, unwraps the boxed value before forwarding built-in calls — defaults to `true` |
| `static` | object whose properties are copied to the constructor as static members |

---

## Example User Programs

### Basic Instance
```js
const MyNumber = createNative(convertNative(Number))

const n = MyNumber(10)
console.log(n + 5)  // 15
```

### Override `.valueOf` via Blueprint
```js
const blueprint = convertNative(Number)

blueprint.proto.valueOf = function () {
  return this[blueprint.DATA ?? Symbol()] * 2
}

const MyNumber = createNative(blueprint)

const n = MyNumber(10)
console.log(n + 5)  // 25
```

### Custom Methods via Blueprint
```js
const blueprint = convertNative(Number)

blueprint.proto.toString = function () {
  return `MyNumber(${this[MyNumber.DATA]})`
}

blueprint.proto.double = function () {
  return this[MyNumber.DATA] * 2
}

const MyNumber = createNative(blueprint)

const n = MyNumber(7)
console.log(String(n))   // "MyNumber(7)"
console.log(n.double())  // 14
```

### Edit After Creation
```js
const MyNumber = createNative(convertNative(Number))

// prototype edits after createNative also work
// and reflect on all existing instances immediately
MyNumber.prototype.triple = function () {
  return this[MyNumber.DATA] * 3
}

const n = MyNumber(5)
console.log(n.triple())  // 15
```

### Custom Type from Scratch
```js
const Vec2 = createNative({
  coerce: ({x, y}) => ({x, y}),
  proto: {
    add(other) {
      const {x, y} = this[Vec2.DATA]
      return Vec2({x: x + other.x, y: y + other.y})
    },
    toString() {
      const {x, y} = this[Vec2.DATA]
      return `Vec2(${x}, ${y})`
    }
  }
})

const v = Vec2({x: 1, y: 2})
console.log(String(v))  // "Vec2(1, 2)"
```

---

# Developer Notes

## All Developer Features

- `createNative(blueprint)` — full blueprint API, every aspect of the type is configurable
- `convertNative(GlobalObj, options)` — auto-derives a blueprint from an existing intrinsic, returns a plain editable object
- **blueprint is mutable** — edit any field between `convertNative` and `createNative` to customise behaviour before the constructor is built
- **reference-based** — built-in methods are forwarded via reference, not cloned
- **read-only tolerant** — non-configurable or non-writable properties are skipped during conversion rather than throwing
- **unified call/construct path** — same internal logic handles both `MyType(x)` and `new MyType(x)`
- **symbol slots** — internal data stored via `Symbol("NativeInternalData")`, not closures or WeakMaps
- **`assertBrand`** — internal guard used by `valueOf`, `toString`, `Symbol.toPrimitive` — throws `TypeError` if receiver doesn't own the `DATA` slot
- **`Symbol.hasInstance`** — overridden to check `DATA` slot presence rather than prototype chain, so `instanceof` works correctly across realm boundaries

### `convertNative` options

| Option | What it does |
|---|---|
| `coerce` | custom coercion function — defaults to calling the original intrinsic |
| `literal` | custom literal function — defaults to calling the original intrinsic |
| `unwrapThis` | whether to unwrap boxed value before forwarding built-in calls — defaults to `true` |

---

## Example Developer Programs

### Override Built-in Method via Blueprint
```js
const blueprint = convertNative(String)

blueprint.proto.repeat = function () {
  return "overridden"
}

const MyString = createNative(blueprint)

console.log(MyString("abc").repeat(3))  // "overridden"
```

### Intercept Built-in Method via Blueprint
```js
const blueprint = convertNative(Array)

blueprint.proto.push = function (...items) {
  console.log("intercepted:", items)
  return Array.prototype.push.apply(this[MyArray.DATA], items)
}

const MyArray = createNative(blueprint)

const a = MyArray([])
a.push(1, 2, 3)  // intercepted: [1, 2, 3]
```

### Custom Coercion via Blueprint
```js
const blueprint = convertNative(Number)

blueprint.coerce = x => Math.abs(Number(x))  // always positive

const MyNumber = createNative(blueprint)

const n = MyNumber(-5)
console.log(n + 0)  // 5
```

### Invert Boolean via Blueprint
```js
const blueprint = convertNative(Boolean)

blueprint.proto.valueOf = function () {
  return !this[MyBoolean.DATA]
}

const MyBoolean = createNative(blueprint)

const b = MyBoolean(true)
console.log(b == false)  // true
```

### Add Static Methods via Blueprint
```js
const blueprint = convertNative(Number)

blueprint.static.fromHex = function (str) {
  return MyNumber(parseInt(str, 16))
}

const MyNumber = createNative(blueprint)

console.log(MyNumber.fromHex("ff") + 0)  // 255
```

---

# Outro

## Known Limitations

- **internal slots** — true engine internal slots like `[[NumberData]]` cannot be recreated, so some native methods may reject the boxed value if they check for the real slot
- **spread and iteration** — types like `Array` need extra work to support `for...of` and spread correctly without a real `[[ArrayExoticObject]]` slot
- **blueprint DATA** — `Blueprint.DATA` is only available after `createNative` returns, so blueprint `proto` methods that reference it must use the final constructor variable, not the blueprint itself

## Use Cases

- experimenting with JavaScript coercion rules
- understanding how intrinsics actually behave
- building custom numeric or logical systems
- sandboxing or VM-like environments
- teaching advanced JavaScript internals
- prototyping language features
- extending built-in types without subclassing

## Full Example: Everything Together

```js
const blueprint = convertNative(Number)

blueprint.coerce = x => Math.max(0, Number(x))  // clamp to positive

blueprint.proto.double = function () {
  return MyNumber(this[MyNumber.DATA] * 2)
}

blueprint.static.fromHex = function (str) {
  return MyNumber(parseInt(str, 16))
}

const MyNumber = createNative(blueprint)

MyNumber.prototype.toString = function () {
  return `MyNumber(${this[MyNumber.DATA]})`
}

const n1 = MyNumber(10)
const n2 = new MyNumber(-5)  // clamped to 0

console.log(n1 + 1)               // 11
console.log(n2 + 0)               // 0
console.log(String(n1))           // "MyNumber(10)"
console.log(n1.double() + 0)      // 20
console.log(MyNumber.fromHex("ff") + 0)  // 255
console.log(n1 instanceof MyNumber)      // true
```
