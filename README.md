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

`createNative` builds a new intrinsic-like type from scratch using a blueprint object. `convertNative` derives a blueprint automatically from an existing JS intrinsic like `Number` or `String`, then passes it to `createNative`.

```js
// from scratch
const MyNum = createNative({
  coerce: x => Number(x),
  proto: { double() { return this[MyNum.DATA] * 2 } }
})

// from existing intrinsic
const MyNumber = convertNative(Number)
```

Both paths produce a constructor that:
- works with or without `new`
- stores internal data in a symbol slot
- exposes `valueOf`, `toString`, and `Symbol.toPrimitive`
- allows full prototype mutation that reflects on all existing instances

---

# Notes

## All User Features

- `convertNative(GlobalObj)` — derives a mutable blueprint from an existing intrinsic and returns a constructor that mirrors its behaviour
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

when using `createNative` directly, the blueprint controls every aspect of the resulting type

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
const MyNumber = convertNative(Number)

const n = MyNumber(10)
console.log(n + 5)  // 15
```

### Override `.valueOf`
```js
const MyNumber = convertNative(Number)

MyNumber.prototype.valueOf = function () {
  return this[MyNumber.DATA] * 2
}

const n = MyNumber(10)
console.log(n + 5)  // 25
```

### Custom Methods
```js
const MyNumber = convertNative(Number)

MyNumber.prototype.toString = function () {
  return `MyNumber(${this[MyNumber.DATA]})`
}

MyNumber.prototype.double = function () {
  return this[MyNumber.DATA] * 2
}

const n = MyNumber(7)
console.log(String(n))   // "MyNumber(7)"
console.log(n.double())  // 14
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
- `convertNative(GlobalObj, options)` — auto-derives a blueprint from an existing intrinsic
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

### Override Built-in Method
```js
const MyString = convertNative(String)

MyString.prototype.repeat = function () {
  return "overridden"
}

console.log(MyString("abc").repeat(3))  // "overridden"
```

### Intercept Built-in Method
```js
const MyArray = convertNative(Array)

MyArray.prototype.push = function (...items) {
  console.log("intercepted:", items)
  return Array.prototype.push.apply(this[MyArray.DATA], items)
}

const a = MyArray([])
a.push(1, 2, 3)  // intercepted: [1, 2, 3]
```

### Invert Boolean
```js
const MyBoolean = convertNative(Boolean)

MyBoolean.prototype.valueOf = function () {
  return !this[MyBoolean.DATA]
}

const b = MyBoolean(true)
console.log(b == false)  // true
```

### Static Methods
```js
const MyNumber = convertNative(Number, {
  coerce: x => Math.abs(Number(x))  // always positive
})

const n = MyNumber(-5)
console.log(n + 0)  // 5
```

---

# Outro

## Known Limitations

- **internal slots** — true engine internal slots like `[[NumberData]]` cannot be recreated, so some native methods may reject the boxed value if they check for the real slot
- **performance** — forwarding through a proxy layer adds overhead vs native intrinsics
- **spread and iteration** — types like `Array` need extra work to support `for...of` and spread correctly without a real `[[ArrayExoticObject]]` slot

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
const MyNumber = convertNative(Number)

MyNumber.prototype.valueOf = function () {
  return this[MyNumber.DATA] * 3
}

MyNumber.prototype.toString = function () {
  return `MyNumber(${this[MyNumber.DATA]})`
}

MyNumber.prototype.double = function () {
  return MyNumber(this[MyNumber.DATA] * 2)
}

const n1 = MyNumber(10)
const n2 = new MyNumber(20)

console.log(n1 + 1)          // 31
console.log(n2 + 1)          // 61
console.log(String(n1))      // "MyNumber(10)"
console.log(n1.double() + 0) // 60
console.log(n2 instanceof MyNumber)  // true
```
