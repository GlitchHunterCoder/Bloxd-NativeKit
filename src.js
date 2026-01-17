function createNative(blueprint = {}, autoBoxLiterals = true) {
  const Native = function(input) {
    const DATA = Native.DATA
    function makeLiteral(value) {
      if (autoBoxLiterals) {
        const Box = Object.create(Native.prototype)
        Box[DATA] = blueprint.coerce ? blueprint.coerce(value) : value
        return Box
      } else {
        const Box = blueprint.literal ? blueprint.literal(value) : value
        Box[DATA] = blueprint.coerce ? blueprint.coerce(value) : value
        let temp = "setProto"
        temp+="typeOf"
        Object[temp](Box, Native.prototype)
        return Box
      }
    }
    if (!new.target) return makeLiteral(input)
    this[DATA] = blueprint.coerce ? blueprint.coerce(input) : input
    return this
  }
  Native.DATA = Symbol("NativeInternalData")
  Native.prototype = Object.assign({}, blueprint.proto || {})
  Native.prototype.valueOf = function() { return this[Native.DATA] }
  Native.prototype[Symbol.toPrimitive] = function() { return this[Native.DATA] }
  if (blueprint.wrapBuiltIns) {
    const protoKeys = Object.getOwnPropertyNames(blueprint.wrapBuiltIns.prototype)
    for (const key of protoKeys) {
      const desc = Object.getOwnPropertyDescriptor(blueprint.wrapBuiltIns.prototype, key)
      if (desc && typeof desc.value === "function") {
        Native.prototype[key] = function(...args) {
          return desc.value.apply(this[Native.DATA], args)
        }
      }
    }
  }
  Object.assign(Native, blueprint.static || {})
  return Native
}

function convertNative(GlobalObj, options = {}) {
  const blueprint = {}
  blueprint.proto = {}
  if (GlobalObj.prototype) {
    for (const key of Object.getOwnPropertyNames(GlobalObj.prototype)) {
      const desc = Object.getOwnPropertyDescriptor(GlobalObj.prototype, key)
      if (desc && typeof desc.value === "function" && desc.writable !== false) {
        blueprint.proto[key] = desc.value
      }
    }
    for (const sym of Object.getOwnPropertySymbols(GlobalObj.prototype)) {
      blueprint.proto[sym] = GlobalObj.prototype[sym]
    }
  }
  blueprint.static = {}
  for (const key of Object.getOwnPropertyNames(GlobalObj)) {
    const desc = Object.getOwnPropertyDescriptor(GlobalObj, key)
    if (!desc || (desc.writable !== false && desc.configurable !== false)) {
      blueprint.static[key] = GlobalObj[key]
    }
  }
  for (const sym of Object.getOwnPropertySymbols(GlobalObj)) {
    blueprint.static[sym] = GlobalObj[sym]
  }
  blueprint.coerce = options.coerce || (x => GlobalObj(x))
  blueprint.literal = options.literal || (x => GlobalObj(x))
  blueprint.wrapBuiltIns = GlobalObj
  return blueprint
}
