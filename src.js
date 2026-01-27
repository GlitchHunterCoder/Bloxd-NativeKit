globalThis.GeneratorFunction = function* () {}.constructor;
globalThis.Generator = function* () {}().constructor;

const ErrMsg = (e) => {
  api.broadcastMessage(
    `${e.name}: ${e.message}\n${e.stack}`,
    { color: "red" }
  );
};

const Try = (fn, ctx = this, ...params) => {
  try { fn.apply(ctx, params) }
  catch (e) { ErrMsg(e); }
}

function createNative(blueprint = {}, autoBoxLiterals = true) {
  function Native(input) {
    const DATA = Native.DATA
    function makeLiteral(value) {
      const coerced = blueprint.coerce ? blueprint.coerce(value) : value
      const box = Object.create(Native.prototype)
      Object.defineProperty(box, DATA, {
        value: coerced,
        writable: false,
        configurable: false
      })
      return box
    }
    if (!new.target) return makeLiteral(input)
    Object.defineProperty(this, DATA, {
      value: blueprint.coerce ? blueprint.coerce(input) : input,
      writable: false,
      configurable: false
    })
    return this
  }
  Native.DATA = Symbol("NativeInternalData")
  const proto = blueprint.proto || Object.create(null)
  const protoProto = blueprint.protoProto ?? Object.prototype
  Native.prototype = Object.create(protoProto)
  Try(()=>{Object.defineProperties(
    Native.prototype,
    Object.getOwnPropertyDescriptors(proto)
  )})
  Object.defineProperty(Native.prototype, "constructor", {
    value: Native,
    writable: true,
    configurable: true
  })
  Object.setPrototypeOf(
    Native,
    blueprint.constructorProto ?? Function.prototype
  )
  function assertBrand(self) {
    if (
      !self ||
      !Object.prototype.hasOwnProperty.call(self, Native.DATA)
    ) {
      throw new TypeError("Incompatible receiver")
    }
  }
  if (!Native.prototype.valueOf) {
    Object.defineProperty(Native.prototype, "valueOf", {
      value() {
        assertBrand(this)
        return this[Native.DATA]
      },
      writable: true,
      configurable: true
    })
  }
  if (!Native.prototype.toString) {
    Object.defineProperty(Native.prototype, "toString", {
      value() {
        assertBrand(this)
        return String(this[Native.DATA])
      },
      writable: true,
      configurable: true
    })
  }
  if (!Native.prototype[Symbol.toPrimitive]) {
    Object.defineProperty(Native.prototype, Symbol.toPrimitive, {
      value() {
        assertBrand(this)
        return this[Native.DATA]
      },
      writable: true,
      configurable: true
    })
  }
  Object.defineProperty(Native, Symbol.hasInstance, {
    value(obj) {
      return (
        !!obj &&
        Object.prototype.hasOwnProperty.call(obj, Native.DATA)
      )
    },
    configurable: true
  })
  if (blueprint.wrapBuiltIns) {
    const srcProto = blueprint.wrapBuiltIns.prototype
    const unwrapThis = blueprint.unwrapThis ?? true
    for (const key of Reflect.ownKeys(srcProto)) {
      if (key in Native.prototype) continue
      const desc = Object.getOwnPropertyDescriptor(srcProto, key)
      if (!desc || typeof desc.value !== "function") continue
      Object.defineProperty(Native.prototype, key, {
        value(...args) {
          assertBrand(this)
          const receiver = unwrapThis ? this[Native.DATA] : this
          return desc.value.apply(receiver, args)
        },
        writable: true,
        configurable: true,
        enumerable: false
      })
    }
  }
  if (blueprint.static) {
    Try(() => {
      const descriptors = Object.getOwnPropertyDescriptors(blueprint.static)
      for (const key of Reflect.ownKeys(descriptors)) {
        const desc = descriptors[key]
        if (key === "prototype" || (desc && desc.configurable === false)) {
          delete descriptors[key]
        }
      }
      Object.defineProperties(Native, descriptors)
    })
  }
  return Native
}

function convertNative(GlobalObj, options = {}) {
  const blueprint = {
    proto: Object.create(null),
    static: Object.create(null)
  }
  if (GlobalObj.prototype) {
    for (const key of Reflect.ownKeys(GlobalObj.prototype)) {
      const desc = Object.getOwnPropertyDescriptor(
        GlobalObj.prototype,
        key
      )
      if (!desc) continue
      blueprint.proto[key] = desc
    }
    blueprint.protoProto =
      Object.getPrototypeOf(GlobalObj.prototype)
  }
  for (const key of Reflect.ownKeys(GlobalObj)) {
    if (key === "length" || key === "name") continue
    const desc = Object.getOwnPropertyDescriptor(GlobalObj, key)
    if (!desc) continue
    if (!("value" in desc) && !desc.configurable) continue
    blueprint.static[key] = desc
  }
  blueprint.constructorProto =
    Object.getPrototypeOf(GlobalObj)
  blueprint.coerce = options.coerce ?? (x => GlobalObj(x))
  blueprint.literal = options.literal ?? (x => GlobalObj(x))
  blueprint.wrapBuiltIns = GlobalObj
  blueprint.unwrapThis = options.unwrapThis ?? true
  return blueprint
}
