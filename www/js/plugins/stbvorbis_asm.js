var Module = typeof Module !== "undefined" ? Module : {};
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}
Module["arguments"] = [];
Module["thisProgram"] = "./this.program";
Module["quit"] = function (status, toThrow) {
  throw toThrow;
};
Module["preRun"] = [];
Module["postRun"] = [];
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
if (Module["ENVIRONMENT"]) {
  if (Module["ENVIRONMENT"] === "WEB") {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module["ENVIRONMENT"] === "WORKER") {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module["ENVIRONMENT"] === "NODE") {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module["ENVIRONMENT"] === "SHELL") {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error(
      "Module['ENVIRONMENT'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL."
    );
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === "object";
  ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
  ENVIRONMENT_IS_NODE =
    typeof process === "object" &&
    typeof require === "function" &&
    !ENVIRONMENT_IS_WEB &&
    !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL =
    !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}
if (ENVIRONMENT_IS_NODE) {
  var nodeFS;
  var nodePath;
  Module["read"] = function shell_read(filename, binary) {
    var ret;
    ret = tryParseAsDataURI(filename);
    if (!ret) {
      if (!nodeFS) nodeFS = require("fs");
      if (!nodePath) nodePath = require("path");
      filename = nodePath["normalize"](filename);
      ret = nodeFS["readFileSync"](filename);
    }
    return binary ? ret : ret.toString();
  };
  Module["readBinary"] = function readBinary(filename) {
    var ret = Module["read"](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };
  if (process["argv"].length > 1) {
    Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/");
  }
  Module["arguments"] = process["argv"].slice(2);
  if (typeof module !== "undefined") {
    module["exports"] = Module;
  }
  process["on"]("uncaughtException", function (ex) {
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  process["on"]("unhandledRejection", function (reason, p) {
    process["exit"](1);
  });
  Module["inspect"] = function () {
    return "[Emscripten Module object]";
  };
} else if (ENVIRONMENT_IS_SHELL) {
  if (typeof read != "undefined") {
    Module["read"] = function shell_read(f) {
      var data = tryParseAsDataURI(f);
      if (data) {
        return intArrayToString(data);
      }
      return read(f);
    };
  }
  Module["readBinary"] = function readBinary(f) {
    var data;
    data = tryParseAsDataURI(f);
    if (data) {
      return data;
    }
    if (typeof readbuffer === "function") {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, "binary");
    assert(typeof data === "object");
    return data;
  };
  if (typeof scriptArgs != "undefined") {
    Module["arguments"] = scriptArgs;
  } else if (typeof arguments != "undefined") {
    Module["arguments"] = arguments;
  }
  if (typeof quit === "function") {
    Module["quit"] = function (status, toThrow) {
      quit(status);
    };
  }
} else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module["read"] = function shell_read(url) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", url, false);
      xhr.send(null);
      return xhr.responseText;
    } catch (err) {
      var data = tryParseAsDataURI(url);
      if (data) {
        return intArrayToString(data);
      }
      throw err;
    }
  };
  if (ENVIRONMENT_IS_WORKER) {
    Module["readBinary"] = function readBinary(url) {
      try {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", url, false);
        xhr.responseType = "arraybuffer";
        xhr.send(null);
        return new Uint8Array(xhr.response);
      } catch (err) {
        var data = tryParseAsDataURI(url);
        if (data) {
          return data;
        }
        throw err;
      }
    };
  }
  Module["readAsync"] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", url, true);
    xhr.responseType = "arraybuffer";
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
        onload(xhr.response);
        return;
      }
      var data = tryParseAsDataURI(url);
      if (data) {
        onload(data.buffer);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };
  Module["setWindowTitle"] = function (title) {
    document.title = title;
  };
}
Module["print"] =
  typeof console !== "undefined"
    ? console.log.bind(console)
    : typeof print !== "undefined"
    ? print
    : null;
Module["printErr"] =
  typeof printErr !== "undefined"
    ? printErr
    : (typeof console !== "undefined" && console.warn.bind(console)) ||
      Module["print"];
Module.print = Module["print"];
Module.printErr = Module["printErr"];
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
moduleOverrides = undefined;
var STACK_ALIGN = 16;
function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  return ret;
}
function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR >> 2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR >> 2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR >> 2] = ret;
      return 0;
    }
  }
  return ret;
}
function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN;
  var ret = (size = Math.ceil(size / factor) * factor);
  return ret;
}
function getNativeTypeSize(type) {
  switch (type) {
    case "i1":
    case "i8":
      return 1;
    case "i16":
      return 2;
    case "i32":
      return 4;
    case "i64":
      return 8;
    case "float":
      return 4;
    case "double":
      return 8;
    default: {
      if (type[type.length - 1] === "*") {
        return 4;
      } else if (type[0] === "i") {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}
function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    Module.printErr(text);
  }
}
var jsCallStartIndex = 1;
var functionPointers = new Array(0);
function addFunction(func, sig) {
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw "Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.";
}
function removeFunction(index) {
  functionPointers[index - jsCallStartIndex] = null;
}
var funcWrappers = {};
function getFuncWrapper(func, sig) {
  if (!func) return;
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}
function makeBigInt(low, high, unsigned) {
  return unsigned
    ? +(low >>> 0) + +(high >>> 0) * 4294967296
    : +(low >>> 0) + +(high | 0) * 4294967296;
}
function dynCall(sig, ptr, args) {
  if (args && args.length) {
    return Module["dynCall_" + sig].apply(null, [ptr].concat(args));
  } else {
    return Module["dynCall_" + sig].call(null, ptr);
  }
}
var Runtime = { dynCall: dynCall };
var GLOBAL_BASE = 8;
var ABORT = 0;
var EXITSTATUS = 0;
function assert(condition, text) {
  if (!condition) {
    abort("Assertion failed: " + text);
  }
}
var globalScope = this;
function getCFunc(ident) {
  var func = Module["_" + ident];
  assert(
    func,
    "Cannot call unknown function " + ident + ", make sure it is exported"
  );
  return func;
}
var JSfuncs = {
  stackSave: function () {
    stackSave();
  },
  stackRestore: function () {
    stackRestore();
  },
  arrayToC: function (arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  stringToC: function (str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) {
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  },
};
var toC = { string: JSfuncs["stringToC"], array: JSfuncs["arrayToC"] };
function ccall(ident, returnType, argTypes, args, opts) {
  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  if (returnType === "string") ret = Pointer_stringify(ret);
  else if (returnType === "boolean") ret = Boolean(ret);
  if (stack !== 0) {
    stackRestore(stack);
  }
  return ret;
}
function cwrap(ident, returnType, argTypes) {
  argTypes = argTypes || [];
  var cfunc = getCFunc(ident);
  var numericArgs = argTypes.every(function (type) {
    return type === "number";
  });
  var numericRet = returnType !== "string";
  if (numericRet && numericArgs) {
    return cfunc;
  }
  return function () {
    return ccall(ident, returnType, argTypes, arguments);
  };
}
function setValue(ptr, value, type, noSafe) {
  type = type || "i8";
  if (type.charAt(type.length - 1) === "*") type = "i32";
  switch (type) {
    case "i1":
      HEAP8[ptr >> 0] = value;
      break;
    case "i8":
      HEAP8[ptr >> 0] = value;
      break;
    case "i16":
      HEAP16[ptr >> 1] = value;
      break;
    case "i32":
      HEAP32[ptr >> 2] = value;
      break;
    case "i64":
      (tempI64 = [
        value >>> 0,
        ((tempDouble = value),
        +Math_abs(tempDouble) >= +1
          ? tempDouble > +0
            ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) |
                0) >>>
              0
            : ~~+Math_ceil(
                (tempDouble - +(~~tempDouble >>> 0)) / +4294967296
              ) >>> 0
          : 0),
      ]),
        (HEAP32[ptr >> 2] = tempI64[0]),
        (HEAP32[(ptr + 4) >> 2] = tempI64[1]);
      break;
    case "float":
      HEAPF32[ptr >> 2] = value;
      break;
    case "double":
      HEAPF64[ptr >> 3] = value;
      break;
    default:
      abort("invalid type for setValue: " + type);
  }
}
function getValue(ptr, type, noSafe) {
  type = type || "i8";
  if (type.charAt(type.length - 1) === "*") type = "i32";
  switch (type) {
    case "i1":
      return HEAP8[ptr >> 0];
    case "i8":
      return HEAP8[ptr >> 0];
    case "i16":
      return HEAP16[ptr >> 1];
    case "i32":
      return HEAP32[ptr >> 2];
    case "i64":
      return HEAP32[ptr >> 2];
    case "float":
      return HEAPF32[ptr >> 2];
    case "double":
      return HEAPF64[ptr >> 3];
    default:
      abort("invalid type for getValue: " + type);
  }
  return null;
}
var ALLOC_NORMAL = 0;
var ALLOC_STACK = 1;
var ALLOC_STATIC = 2;
var ALLOC_DYNAMIC = 3;
var ALLOC_NONE = 4;
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === "number") {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }
  var singleType = typeof types === "string" ? types : null;
  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [
      typeof _malloc === "function" ? _malloc : staticAlloc,
      stackAlloc,
      staticAlloc,
      dynamicAlloc,
    ][allocator === undefined ? ALLOC_STATIC : allocator](
      Math.max(size, singleType ? 1 : types.length)
    );
  }
  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[ptr >> 2] = 0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[ptr++ >> 0] = 0;
    }
    return ret;
  }
  if (singleType === "i8") {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }
  var i = 0,
    type,
    typeSize,
    previousType;
  while (i < size) {
    var curr = slab[i];
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    if (type == "i64") type = "i32";
    setValue(ret + i, curr, type);
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }
  return ret;
}
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return "";
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(ptr + i) >> 0];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;
  var ret = "";
  if (hasUtf < 128) {
    var MAX_CHUNK = 1024;
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(
        String,
        HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK))
      );
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}
function AsciiToString(ptr) {
  var str = "";
  while (1) {
    var ch = HEAP8[ptr++ >> 0];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
var UTF8Decoder =
  typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  while (u8Array[endPtr]) ++endPtr;
  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;
    var str = "";
    while (1) {
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 128)) {
        str += String.fromCharCode(u0);
        continue;
      }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 224) == 192) {
        str += String.fromCharCode(((u0 & 31) << 6) | u1);
        continue;
      }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 240) == 224) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 248) == 240) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 252) == 248) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 =
              ((u0 & 1) << 30) |
              (u1 << 24) |
              (u2 << 18) |
              (u3 << 12) |
              (u4 << 6) |
              u5;
          }
        }
      }
      if (u0 < 65536) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 65536;
        str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
      }
    }
  }
}
function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8, ptr);
}
function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) return 0;
  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343)
      u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
    if (u <= 127) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 2047) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 192 | (u >> 6);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else if (u <= 65535) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 224 | (u >> 12);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else if (u <= 2097151) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 240 | (u >> 18);
      outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else if (u <= 67108863) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 248 | (u >> 24);
      outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 252 | (u >> 30);
      outU8Array[outIdx++] = 128 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 128 | (u & 63);
    }
  }
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
function stringToUTF8(str, outPtr, maxBytesToWrite) {
  return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
}
function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var u = str.charCodeAt(i);
    if (u >= 55296 && u <= 57343)
      u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
    if (u <= 127) {
      ++len;
    } else if (u <= 2047) {
      len += 2;
    } else if (u <= 65535) {
      len += 3;
    } else if (u <= 2097151) {
      len += 4;
    } else if (u <= 67108863) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
var UTF16Decoder =
  typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;
function UTF16ToString(ptr) {
  var endPtr = ptr;
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;
  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;
    var str = "";
    while (1) {
      var codeUnit = HEAP16[(ptr + i * 2) >> 1];
      if (codeUnit == 0) return str;
      ++i;
      str += String.fromCharCode(codeUnit);
    }
  }
}
function stringToUTF16(str, outPtr, maxBytesToWrite) {
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2;
  var startPtr = outPtr;
  var numCharsToWrite =
    maxBytesToWrite < str.length * 2 ? maxBytesToWrite / 2 : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    var codeUnit = str.charCodeAt(i);
    HEAP16[outPtr >> 1] = codeUnit;
    outPtr += 2;
  }
  HEAP16[outPtr >> 1] = 0;
  return outPtr - startPtr;
}
function lengthBytesUTF16(str) {
  return str.length * 2;
}
function UTF32ToString(ptr) {
  var i = 0;
  var str = "";
  while (1) {
    var utf32 = HEAP32[(ptr + i * 4) >> 2];
    if (utf32 == 0) return str;
    ++i;
    if (utf32 >= 65536) {
      var ch = utf32 - 65536;
      str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}
function stringToUTF32(str, outPtr, maxBytesToWrite) {
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 2147483647;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = (65536 + ((codeUnit & 1023) << 10)) | (trailSurrogate & 1023);
    }
    HEAP32[outPtr >> 2] = codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  HEAP32[outPtr >> 2] = 0;
  return outPtr - startPtr;
}
function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 55296 && codeUnit <= 57343) ++i;
    len += 4;
  }
  return len;
}
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}
function demangle(func) {
  return func;
}
function demangleAll(text) {
  var regex = /__Z[\w\d_]+/g;
  return text.replace(regex, function (x) {
    var y = demangle(x);
    return x === y ? x : x + " [" + y + "]";
  });
}
function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    try {
      throw new Error(0);
    } catch (e) {
      err = e;
    }
    if (!err.stack) {
      return "(no stack trace available)";
    }
  }
  return err.stack.toString();
}
function stackTrace() {
  var js = jsStackTrace();
  if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
  return demangleAll(js);
}
var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;
function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}
var HEAP,
  buffer,
  HEAP8,
  HEAPU8,
  HEAP16,
  HEAPU16,
  HEAP32,
  HEAPU32,
  HEAPF32,
  HEAPF64;
function updateGlobalBuffer(buf) {
  Module["buffer"] = buffer = buf;
}
function updateGlobalBufferViews() {
  Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
  Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
  Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
  Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
  Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
  Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
  Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
  Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer);
}
var STATIC_BASE, STATICTOP, staticSealed;
var STACK_BASE, STACKTOP, STACK_MAX;
var DYNAMIC_BASE, DYNAMICTOP_PTR;
STATIC_BASE =
  STATICTOP =
  STACK_BASE =
  STACKTOP =
  STACK_MAX =
  DYNAMIC_BASE =
  DYNAMICTOP_PTR =
    0;
staticSealed = false;
function abortOnCannotGrowMemory() {
  abort(
    "Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value " +
      TOTAL_MEMORY +
      ", (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 "
  );
}
if (!Module["reallocBuffer"])
  Module["reallocBuffer"] = function (size) {
    var ret;
    try {
      if (ArrayBuffer.transfer) {
        ret = ArrayBuffer.transfer(buffer, size);
      } else {
        var oldHEAP8 = HEAP8;
        ret = new ArrayBuffer(size);
        var temp = new Int8Array(ret);
        temp.set(oldHEAP8);
      }
    } catch (e) {
      return false;
    }
    var success = _emscripten_replace_memory(ret);
    if (!success) return false;
    return ret;
  };
function enlargeMemory() {
  var PAGE_MULTIPLE = Module["usingWasm"] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
  var LIMIT = 2147483648 - PAGE_MULTIPLE;
  if (HEAP32[DYNAMICTOP_PTR >> 2] > LIMIT) {
    return false;
  }
  var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
  TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY);
  while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR >> 2]) {
    if (TOTAL_MEMORY <= 536870912) {
      TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE);
    } else {
      TOTAL_MEMORY = Math.min(
        alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE),
        LIMIT
      );
    }
  }
  var replacement = Module["reallocBuffer"](TOTAL_MEMORY);
  if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
    TOTAL_MEMORY = OLD_TOTAL_MEMORY;
    return false;
  }
  updateGlobalBuffer(replacement);
  updateGlobalBufferViews();
  return true;
}
var byteLength;
try {
  byteLength = Function.prototype.call.bind(
    Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get
  );
  byteLength(new ArrayBuffer(4));
} catch (e) {
  byteLength = function (buffer) {
    return buffer.byteLength;
  };
}
var TOTAL_STACK = Module["TOTAL_STACK"] || 5242880;
var TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK)
  Module.printErr(
    "TOTAL_MEMORY should be larger than TOTAL_STACK, was " +
      TOTAL_MEMORY +
      "! (TOTAL_STACK=" +
      TOTAL_STACK +
      ")"
  );
if (Module["buffer"]) {
  buffer = Module["buffer"];
} else {
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  Module["buffer"] = buffer;
}
updateGlobalBufferViews();
function getTotalMemory() {
  return TOTAL_MEMORY;
}
HEAP32[0] = 1668509029;
HEAP16[1] = 25459;
if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99)
  throw "Runtime error: expected the system to be little-endian!";
function callRuntimeCallbacks(callbacks) {
  while (callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == "function") {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === "number") {
      if (callback.arg === undefined) {
        Module["dynCall_v"](func);
      } else {
        Module["dynCall_vi"](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}
var __ATPRERUN__ = [];
var __ATINIT__ = [];
var __ATMAIN__ = [];
var __ATEXIT__ = [];
var __ATPOSTRUN__ = [];
var runtimeInitialized = false;
var runtimeExited = false;
function preRun() {
  if (Module["preRun"]) {
    if (typeof Module["preRun"] == "function")
      Module["preRun"] = [Module["preRun"]];
    while (Module["preRun"].length) {
      addOnPreRun(Module["preRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}
function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}
function postRun() {
  if (Module["postRun"]) {
    if (typeof Module["postRun"] == "function")
      Module["postRun"] = [Module["postRun"]];
    while (Module["postRun"].length) {
      addOnPostRun(Module["postRun"].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}
function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce(
    "writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!"
  );
  var lastChar, end;
  if (dontAddNull) {
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar;
}
function writeArrayToMemory(array, buffer) {
  HEAP8.set(array, buffer);
}
function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    HEAP8[buffer++ >> 0] = str.charCodeAt(i);
  }
  if (!dontAddNull) HEAP8[buffer >> 0] = 0;
}
function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32
    ? 2 * Math.abs(1 << (bits - 1)) + value
    : Math.pow(2, bits) + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits - 1)) : Math.pow(2, bits - 1);
  if (value >= half && (bits <= 32 || value > half)) {
    value = -2 * half + value;
  }
  return value;
}
var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null;
function getUniqueRunDependency(id) {
  return id;
}
function addRunDependency(id) {
  runDependencies++;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
}
function removeRunDependency(id) {
  runDependencies--;
  if (Module["monitorRunDependencies"]) {
    Module["monitorRunDependencies"](runDependencies);
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback();
    }
  }
}
Module["preloadedImages"] = {};
Module["preloadedAudios"] = {};
var memoryInitializer = null;
var dataURIPrefix = "data:application/octet-stream;base64,";
function isDataURI(filename) {
  return String.prototype.startsWith
    ? filename.startsWith(dataURIPrefix)
    : filename.indexOf(dataURIPrefix) === 0;
}
var ASM_CONSTS = [];
STATIC_BASE = GLOBAL_BASE;
STATICTOP = STATIC_BASE + 2352;
__ATINIT__.push();
memoryInitializer =
  "data:application/octet-stream;base64,T2dnUwABAACAAAAAVgAAAEAAAAA+tOQzCZHzM4uyATQ8IAo0IxoTNGCpHDSn1yY0S68xNFA7PTRwh0k0I6BWNLiSZDRVbXM0iJ+BNPwLijSTBJM0aZKcNDK/pjQ/lbE0kx+9NORpyTStgNY0NnHkNKZJ8zSIjAE1wPcJNQbvEjV2exw1wKYmNTd7MTXaAz01XkxJNTthVjW5T2Q1/CVzNYp5gTWG44k1fNmSNYVknDVSjqY1M2GxNSXovDXcLsk1zkHWNUEu5DVXAvM1j2YBNk/PCTb1wxI2mE0cNuh1JjYyRzE2dMw8Nl4RSTZlIlY2zgxkNrjecjaXU4E2HLuJNnKukjavNpw2gV2mNjUtsTbHsLw25PPINgED1jZg6+M2HrvyNqJAATfrpgk38ZgSN8kfHDceRSY3PRMxNx6VPDdv1kg3ouNVN/fJYzeJl3I3ry2BN76SiTd0g5I35gicN74spjdH+bA3eXm8N/64yDdHxNU3kqjjN/hz8jfAGgE4k34JOPltEjgG8hs4YhQmOFbfMDjYXTw4kptIOPKkVTgzh2M4blByONMHgThraok4gliSOCrbmzgJ/KU4aMWwODtCvDgpfsg4oIXVONll4zjoLPI46fQAOUZWCTkOQxI5UcQbObXjJTl/qzA5oiY8OcVgSDlTZlU5g0RjOWgJcjkB4oA5JEKJOZ0tkjl7rZs5Y8ulOZmRsDkNC7w5ZkPIOQtH1TkyI+M57eXxOR3PADoFLgk6MBgSOqmWGzoVsyU6t3cwOnzvOzoKJkg6xydVOuYBYzp4wnE6O7yAOukZiTrGApI623+bOsuapTrYXbA679O7OrMIyDqICNU6n+DiOgef8TpcqQA70AUJO17tETsPaRs7hIIlO/1DMDtnuDs7YetHO03pVDtdv2I7nHtxO3+WgDu68Yg7+deRO0dSmztBaqU7JyqwO+KcuzsSzsc7F8rUOyCe4js1WPE7poMAPKfdCDyYwhE8gjsbPAFSJTxUEDA8YYE7PMiwRzzlqlQ86HxiPNQ0cTzPcIA8lsmIPDqtkTzAJJs8xTmlPIX2rzzlZbs8gpPHPLmL1Dy0W+I8eRHxPPtdAD2JtQg935cRPQIOGz2NISU9udwvPW1KOz1Adkc9kWxUPYU6Yj0i7nA9KkuAPX+hiD2IgpE9SPeaPVgJpT3ywq89+C67PQNZxz1tTdQ9XBniPdHK8D1bOAA+d40IPjNtET6Q4Bo+J/EkPi6pLz6HEzs+yjtHPk0uVD43+GE+hKdwPo8lgD5zeYg+4leRPtzJmj752KQ+bY+vPhv4uj6VHsc+Mw/UPhfX4T49hPA+xhIAP3JlCD+TQhE/K7MaP87AJD+xdS8/stw6P2UBRz8d8FM/+7VhP/tgcD8AAIA/Li9zdGJfdm9yYmlzLmMAZi0+YWxsb2MuYWxsb2NfYnVmZmVyX2xlbmd0aF9pbl9ieXRlcyA9PSBmLT50ZW1wX29mZnNldAB2b3JiaXNfZGVjb2RlX2luaXRpYWwAZi0+Ynl0ZXNfaW5fc2VnID4gMABnZXQ4X3BhY2tldF9yYXcAZi0+Ynl0ZXNfaW5fc2VnID09IDAAbmV4dF9zZWdtZW50AAABAgIDAwMDBAQEBAQEBAR2b3JiaXNfZGVjb2RlX3BhY2tldF9yZXN0ACFjLT5zcGFyc2UAY29kZWJvb2tfZGVjb2RlX3NjYWxhcl9yYXcAIWMtPnNwYXJzZSB8fCB6IDwgYy0+c29ydGVkX2VudHJpZXMAY29kZWJvb2tfZGVjb2RlX2RlaW50ZXJsZWF2ZV9yZXBlYXQAeiA8IGMtPnNvcnRlZF9lbnRyaWVzAGNvZGVib29rX2RlY29kZV9zdGFydAAobiAmIDMpID09IDAAaW1kY3Rfc3RlcDNfaXRlcjBfbG9vcAAwAGdldF93aW5kb3cAZi0+dGVtcF9vZmZzZXQgPT0gZi0+YWxsb2MuYWxsb2NfYnVmZmVyX2xlbmd0aF9pbl9ieXRlcwBzdGFydF9kZWNvZGVyAHZvcmJpc2MtPnNvcnRlZF9lbnRyaWVzID09IDAAY29tcHV0ZV9jb2Rld29yZHMAeiA+PSAwICYmIHogPCAzMgBsZW5baV0gPj0gMCAmJiBsZW5baV0gPCAzMgBhdmFpbGFibGVbeV0gPT0gMABrID09IGMtPnNvcnRlZF9lbnRyaWVzAGNvbXB1dGVfc29ydGVkX2h1ZmZtYW4AYy0+c29ydGVkX2NvZGV3b3Jkc1t4XSA9PSBjb2RlAGxlbiAhPSBOT19DT0RFAGluY2x1ZGVfaW5fc29ydABwb3coKGZsb2F0KSByKzEsIGRpbSkgPiBlbnRyaWVzAGxvb2t1cDFfdmFsdWVzAChpbnQpIGZsb29yKHBvdygoZmxvYXQpIHIsIGRpbSkpIDw9IGVudHJpZXM=";
var tempDoublePtr = STATICTOP;
STATICTOP += 16;
function copyTempFloat(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
}
function copyTempDouble(ptr) {
  HEAP8[tempDoublePtr] = HEAP8[ptr];
  HEAP8[tempDoublePtr + 1] = HEAP8[ptr + 1];
  HEAP8[tempDoublePtr + 2] = HEAP8[ptr + 2];
  HEAP8[tempDoublePtr + 3] = HEAP8[ptr + 3];
  HEAP8[tempDoublePtr + 4] = HEAP8[ptr + 4];
  HEAP8[tempDoublePtr + 5] = HEAP8[ptr + 5];
  HEAP8[tempDoublePtr + 6] = HEAP8[ptr + 6];
  HEAP8[tempDoublePtr + 7] = HEAP8[ptr + 7];
}
function ___assert_fail(condition, filename, line, func) {
  abort(
    "Assertion failed: " +
      Pointer_stringify(condition) +
      ", at: " +
      [
        filename ? Pointer_stringify(filename) : "unknown filename",
        line,
        func ? Pointer_stringify(func) : "unknown function",
      ]
  );
}
function _abort() {
  Module["abort"]();
}
var _llvm_floor_f64 = Math_floor;
var _llvm_pow_f64 = Math_pow;
function _llvm_stackrestore(p) {
  var self = _llvm_stacksave;
  var ret = self.LLVM_SAVEDSTACKS[p];
  self.LLVM_SAVEDSTACKS.splice(p, 1);
  stackRestore(ret);
}
function _llvm_stacksave() {
  var self = _llvm_stacksave;
  if (!self.LLVM_SAVEDSTACKS) {
    self.LLVM_SAVEDSTACKS = [];
  }
  self.LLVM_SAVEDSTACKS.push(stackSave());
  return self.LLVM_SAVEDSTACKS.length - 1;
}
function _emscripten_memcpy_big(dest, src, num) {
  HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
  return dest;
}
function ___setErrNo(value) {
  if (Module["___errno_location"])
    HEAP32[Module["___errno_location"]() >> 2] = value;
  return value;
}
DYNAMICTOP_PTR = staticAlloc(4);
STACK_BASE = STACKTOP = alignMemory(STATICTOP);
STACK_MAX = STACK_BASE + TOTAL_STACK;
DYNAMIC_BASE = alignMemory(STACK_MAX);
HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
staticSealed = true;
var ASSERTIONS = false;
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 255) {
      if (ASSERTIONS) {
        assert(
          false,
          "Character code " +
            chr +
            " (" +
            String.fromCharCode(chr) +
            ")  at offset " +
            i +
            " not in 0x00-0xFF."
        );
      }
      chr &= 255;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join("");
}
var decodeBase64 =
  typeof atob === "function"
    ? atob
    : function (input) {
        var keyStr =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;
        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        do {
          enc1 = keyStr.indexOf(input.charAt(i++));
          enc2 = keyStr.indexOf(input.charAt(i++));
          enc3 = keyStr.indexOf(input.charAt(i++));
          enc4 = keyStr.indexOf(input.charAt(i++));
          chr1 = (enc1 << 2) | (enc2 >> 4);
          chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
          chr3 = ((enc3 & 3) << 6) | enc4;
          output = output + String.fromCharCode(chr1);
          if (enc3 !== 64) {
            output = output + String.fromCharCode(chr2);
          }
          if (enc4 !== 64) {
            output = output + String.fromCharCode(chr3);
          }
        } while (i < input.length);
        return output;
      };
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === "boolean" && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, "base64");
    } catch (_) {
      buf = new Buffer(s, "base64");
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0; i < decoded.length; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error("Converting base64 string to bytes failed.");
  }
}
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }
  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}
function invoke_iii(index, a1, a2) {
  try {
    return Module["dynCall_iii"](index, a1, a2);
  } catch (e) {
    if (typeof e !== "number" && e !== "longjmp") throw e;
    Module["setThrew"](1, 0);
  }
}
Module.asmGlobalArg = {
  Math: Math,
  Int8Array: Int8Array,
  Int16Array: Int16Array,
  Int32Array: Int32Array,
  Uint8Array: Uint8Array,
  Uint16Array: Uint16Array,
  Uint32Array: Uint32Array,
  Float32Array: Float32Array,
  Float64Array: Float64Array,
  NaN: NaN,
  Infinity: Infinity,
  byteLength: byteLength,
};
Module.asmLibraryArg = {
  abort: abort,
  assert: assert,
  enlargeMemory: enlargeMemory,
  getTotalMemory: getTotalMemory,
  abortOnCannotGrowMemory: abortOnCannotGrowMemory,
  invoke_iii: invoke_iii,
  ___assert_fail: ___assert_fail,
  ___setErrNo: ___setErrNo,
  _abort: _abort,
  _emscripten_memcpy_big: _emscripten_memcpy_big,
  _llvm_floor_f64: _llvm_floor_f64,
  _llvm_pow_f64: _llvm_pow_f64,
  _llvm_stackrestore: _llvm_stackrestore,
  _llvm_stacksave: _llvm_stacksave,
  DYNAMICTOP_PTR: DYNAMICTOP_PTR,
  tempDoublePtr: tempDoublePtr,
  ABORT: ABORT,
  STACKTOP: STACKTOP,
  STACK_MAX: STACK_MAX,
};
var asm = (function (global, env, buffer) {
  "almost asm";
  var Int8View = global.Int8Array;
  var HEAP8 = new Int8View(buffer);
  var Int16View = global.Int16Array;
  var HEAP16 = new Int16View(buffer);
  var Int32View = global.Int32Array;
  var HEAP32 = new Int32View(buffer);
  var Uint8View = global.Uint8Array;
  var HEAPU8 = new Uint8View(buffer);
  var Uint16View = global.Uint16Array;
  var HEAPU16 = new Uint16View(buffer);
  var Uint32View = global.Uint32Array;
  var HEAPU32 = new Uint32View(buffer);
  var Float32View = global.Float32Array;
  var HEAPF32 = new Float32View(buffer);
  var Float64View = global.Float64Array;
  var HEAPF64 = new Float64View(buffer);
  var byteLength = global.byteLength;
  var DYNAMICTOP_PTR = env.DYNAMICTOP_PTR | 0;
  var tempDoublePtr = env.tempDoublePtr | 0;
  var ABORT = env.ABORT | 0;
  var STACKTOP = env.STACKTOP | 0;
  var STACK_MAX = env.STACK_MAX | 0;
  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN,
    inf = global.Infinity;
  var tempInt = 0,
    tempBigInt = 0,
    tempBigIntS = 0,
    tempValue = 0,
    tempDouble = 0;
  var tempRet0 = 0;
  var Math_floor = global.Math.floor;
  var Math_abs = global.Math.abs;
  var Math_sqrt = global.Math.sqrt;
  var Math_pow = global.Math.pow;
  var Math_cos = global.Math.cos;
  var Math_sin = global.Math.sin;
  var Math_tan = global.Math.tan;
  var Math_acos = global.Math.acos;
  var Math_asin = global.Math.asin;
  var Math_atan = global.Math.atan;
  var Math_atan2 = global.Math.atan2;
  var Math_exp = global.Math.exp;
  var Math_log = global.Math.log;
  var Math_ceil = global.Math.ceil;
  var Math_imul = global.Math.imul;
  var Math_min = global.Math.min;
  var Math_max = global.Math.max;
  var Math_clz32 = global.Math.clz32;
  var abort = env.abort;
  var assert = env.assert;
  var enlargeMemory = env.enlargeMemory;
  var getTotalMemory = env.getTotalMemory;
  var abortOnCannotGrowMemory = env.abortOnCannotGrowMemory;
  var invoke_iii = env.invoke_iii;
  var ___assert_fail = env.___assert_fail;
  var ___setErrNo = env.___setErrNo;
  var _abort = env._abort;
  var _emscripten_memcpy_big = env._emscripten_memcpy_big;
  var _llvm_floor_f64 = env._llvm_floor_f64;
  var _llvm_pow_f64 = env._llvm_pow_f64;
  var _llvm_stackrestore = env._llvm_stackrestore;
  var _llvm_stacksave = env._llvm_stacksave;
  var tempFloat = 0;
  function _emscripten_replace_memory(newBuffer) {
    if (
      byteLength(newBuffer) & 16777215 ||
      byteLength(newBuffer) <= 16777215 ||
      byteLength(newBuffer) > 2147483648
    )
      return false;
    HEAP8 = new Int8View(newBuffer);
    HEAP16 = new Int16View(newBuffer);
    HEAP32 = new Int32View(newBuffer);
    HEAPU8 = new Uint8View(newBuffer);
    HEAPU16 = new Uint16View(newBuffer);
    HEAPU32 = new Uint32View(newBuffer);
    HEAPF32 = new Float32View(newBuffer);
    HEAPF64 = new Float64View(newBuffer);
    buffer = newBuffer;
    return true;
  }
  function _malloc($0) {
    $0 = $0 | 0;
    var $$$0192$i = 0,
      $$$0193$i = 0,
      $$$4351$i = 0,
      $$$i = 0,
      $$0 = 0,
      $$0$i$i = 0,
      $$0$i$i$i = 0,
      $$0$i17$i = 0,
      $$0189$i = 0,
      $$0192$lcssa$i = 0,
      $$01926$i = 0,
      $$0193$lcssa$i = 0,
      $$01935$i = 0,
      $$0197 = 0,
      $$0199 = 0,
      $$0206$i$i = 0,
      $$0207$i$i = 0,
      $$0211$i$i = 0,
      $$0212$i$i = 0,
      $$024367$i = 0,
      $$0287$i$i = 0,
      $$0288$i$i = 0,
      $$0289$i$i = 0,
      $$0295$i$i = 0,
      $$0296$i$i = 0,
      $$0342$i = 0,
      $$0344$i = 0,
      $$0345$i = 0,
      $$0347$i = 0,
      $$0353$i = 0,
      $$0358$i = 0,
      $$0359$i = 0,
      $$0361$i = 0,
      $$0362$i = 0,
      $$0368$i = 0,
      $$1196$i = 0,
      $$1198$i = 0,
      $$124466$i = 0,
      $$1291$i$i = 0,
      $$1293$i$i = 0,
      $$1343$i = 0,
      $$1348$i = 0,
      $$1363$i = 0,
      $$1370$i = 0,
      $$1374$i = 0,
      $$2234243136$i = 0,
      $$2247$ph$i = 0,
      $$2253$ph$i = 0,
      $$2355$i = 0,
      $$3$i = 0,
      $$3$i$i = 0,
      $$3$i203 = 0,
      $$3350$i = 0,
      $$3372$i = 0,
      $$4$lcssa$i = 0,
      $$4$ph$i = 0,
      $$414$i = 0,
      $$4236$i = 0,
      $$4351$lcssa$i = 0,
      $$435113$i = 0,
      $$4357$$4$i = 0,
      $$4357$ph$i = 0,
      $$435712$i = 0,
      $$723947$i = 0,
      $$748$i = 0,
      $$pre$phi$i$iZ2D = 0,
      $$pre$phi$i19$iZ2D = 0,
      $$pre$phi$i211Z2D = 0,
      $$pre$phi$iZ2D = 0,
      $$pre$phi11$i$iZ2D = 0,
      $$pre$phiZ2D = 0,
      $1 = 0,
      $1004 = 0,
      $101 = 0,
      $1010 = 0,
      $1013 = 0,
      $1014 = 0,
      $102 = 0,
      $1032 = 0,
      $1034 = 0,
      $1041 = 0,
      $1042 = 0,
      $1043 = 0,
      $1052 = 0,
      $1054 = 0,
      $1055 = 0,
      $1056 = 0,
      $1062 = 0,
      $108 = 0,
      $112 = 0,
      $114 = 0,
      $115 = 0,
      $117 = 0,
      $119 = 0,
      $121 = 0,
      $123 = 0,
      $125 = 0,
      $127 = 0,
      $129 = 0,
      $134 = 0,
      $138 = 0,
      $14 = 0,
      $143 = 0,
      $146 = 0,
      $149 = 0,
      $150 = 0,
      $157 = 0,
      $159 = 0,
      $16 = 0,
      $162 = 0,
      $164 = 0,
      $167 = 0,
      $169 = 0,
      $17 = 0,
      $172 = 0,
      $175 = 0,
      $176 = 0,
      $178 = 0,
      $179 = 0,
      $18 = 0,
      $181 = 0,
      $182 = 0,
      $184 = 0,
      $185 = 0,
      $19 = 0,
      $190 = 0,
      $191 = 0,
      $20 = 0,
      $204 = 0,
      $208 = 0,
      $214 = 0,
      $221 = 0,
      $225 = 0,
      $234 = 0,
      $235 = 0,
      $237 = 0,
      $238 = 0,
      $242 = 0,
      $243 = 0,
      $251 = 0,
      $252 = 0,
      $253 = 0,
      $255 = 0,
      $256 = 0,
      $261 = 0,
      $262 = 0,
      $265 = 0,
      $267 = 0,
      $27 = 0,
      $270 = 0,
      $275 = 0,
      $282 = 0,
      $292 = 0,
      $296 = 0,
      $30 = 0,
      $302 = 0,
      $306 = 0,
      $309 = 0,
      $313 = 0,
      $315 = 0,
      $316 = 0,
      $318 = 0,
      $320 = 0,
      $322 = 0,
      $324 = 0,
      $326 = 0,
      $328 = 0,
      $330 = 0,
      $34 = 0,
      $340 = 0,
      $341 = 0,
      $352 = 0,
      $354 = 0,
      $357 = 0,
      $359 = 0,
      $362 = 0,
      $364 = 0,
      $367 = 0,
      $37 = 0,
      $370 = 0,
      $371 = 0,
      $373 = 0,
      $374 = 0,
      $376 = 0,
      $377 = 0,
      $379 = 0,
      $380 = 0,
      $385 = 0,
      $386 = 0,
      $391 = 0,
      $399 = 0,
      $403 = 0,
      $409 = 0,
      $41 = 0,
      $416 = 0,
      $420 = 0,
      $428 = 0,
      $431 = 0,
      $432 = 0,
      $433 = 0,
      $437 = 0,
      $438 = 0,
      $44 = 0,
      $444 = 0,
      $449 = 0,
      $450 = 0,
      $453 = 0,
      $455 = 0,
      $458 = 0,
      $463 = 0,
      $469 = 0,
      $47 = 0,
      $471 = 0,
      $473 = 0,
      $475 = 0,
      $49 = 0,
      $492 = 0,
      $494 = 0,
      $50 = 0,
      $501 = 0,
      $502 = 0,
      $503 = 0,
      $512 = 0,
      $514 = 0,
      $515 = 0,
      $517 = 0,
      $52 = 0,
      $526 = 0,
      $530 = 0,
      $532 = 0,
      $533 = 0,
      $534 = 0,
      $54 = 0,
      $545 = 0,
      $546 = 0,
      $547 = 0,
      $548 = 0,
      $549 = 0,
      $550 = 0,
      $552 = 0,
      $554 = 0,
      $555 = 0,
      $56 = 0,
      $561 = 0,
      $563 = 0,
      $565 = 0,
      $570 = 0,
      $572 = 0,
      $574 = 0,
      $575 = 0,
      $576 = 0,
      $58 = 0,
      $584 = 0,
      $585 = 0,
      $588 = 0,
      $592 = 0,
      $595 = 0,
      $597 = 0,
      $6 = 0,
      $60 = 0,
      $603 = 0,
      $607 = 0,
      $611 = 0,
      $62 = 0,
      $620 = 0,
      $621 = 0,
      $627 = 0,
      $629 = 0,
      $633 = 0,
      $636 = 0,
      $638 = 0,
      $64 = 0,
      $642 = 0,
      $644 = 0,
      $649 = 0,
      $650 = 0,
      $651 = 0,
      $657 = 0,
      $658 = 0,
      $659 = 0,
      $663 = 0,
      $67 = 0,
      $673 = 0,
      $675 = 0,
      $680 = 0,
      $681 = 0,
      $682 = 0,
      $688 = 0,
      $69 = 0,
      $690 = 0,
      $694 = 0,
      $7 = 0,
      $70 = 0,
      $700 = 0,
      $704 = 0,
      $71 = 0,
      $710 = 0,
      $712 = 0,
      $718 = 0,
      $72 = 0,
      $722 = 0,
      $723 = 0,
      $728 = 0,
      $73 = 0,
      $734 = 0,
      $739 = 0,
      $742 = 0,
      $743 = 0,
      $746 = 0,
      $748 = 0,
      $750 = 0,
      $752 = 0,
      $764 = 0,
      $769 = 0,
      $77 = 0,
      $771 = 0,
      $774 = 0,
      $776 = 0,
      $779 = 0,
      $782 = 0,
      $783 = 0,
      $784 = 0,
      $786 = 0,
      $788 = 0,
      $789 = 0,
      $791 = 0,
      $792 = 0,
      $797 = 0,
      $798 = 0,
      $8 = 0,
      $80 = 0,
      $812 = 0,
      $815 = 0,
      $816 = 0,
      $822 = 0,
      $83 = 0,
      $830 = 0,
      $836 = 0,
      $839 = 0,
      $84 = 0,
      $840 = 0,
      $841 = 0,
      $845 = 0,
      $846 = 0,
      $852 = 0,
      $857 = 0,
      $858 = 0,
      $861 = 0,
      $863 = 0,
      $866 = 0,
      $87 = 0,
      $871 = 0,
      $877 = 0,
      $879 = 0,
      $881 = 0,
      $882 = 0,
      $9 = 0,
      $900 = 0,
      $902 = 0,
      $909 = 0,
      $910 = 0,
      $911 = 0,
      $919 = 0,
      $92 = 0,
      $923 = 0,
      $927 = 0,
      $929 = 0,
      $93 = 0,
      $935 = 0,
      $936 = 0,
      $938 = 0,
      $939 = 0,
      $941 = 0,
      $943 = 0,
      $948 = 0,
      $949 = 0,
      $95 = 0,
      $950 = 0,
      $956 = 0,
      $958 = 0,
      $96 = 0,
      $964 = 0,
      $969 = 0,
      $972 = 0,
      $973 = 0,
      $974 = 0,
      $978 = 0,
      $979 = 0,
      $98 = 0,
      $985 = 0,
      $990 = 0,
      $991 = 0,
      $994 = 0,
      $996 = 0,
      $999 = 0,
      label = 0,
      sp = 0,
      $958$looptemp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 16) | 0;
    $1 = sp;
    do {
      if ($0 >>> 0 < 245) {
        $6 = $0 >>> 0 < 11 ? 16 : ($0 + 11) & -8;
        $7 = $6 >>> 3;
        $8 = HEAP32[460] | 0;
        $9 = $8 >>> $7;
        if (($9 & 3) | 0) {
          $14 = ((($9 & 1) ^ 1) + $7) | 0;
          $16 = (1880 + (($14 << 1) << 2)) | 0;
          $17 = ($16 + 8) | 0;
          $18 = HEAP32[$17 >> 2] | 0;
          $19 = ($18 + 8) | 0;
          $20 = HEAP32[$19 >> 2] | 0;
          do {
            if (($20 | 0) == ($16 | 0)) HEAP32[460] = $8 & ~(1 << $14);
            else {
              if ((HEAP32[464] | 0) >>> 0 > $20 >>> 0) _abort();
              $27 = ($20 + 12) | 0;
              if ((HEAP32[$27 >> 2] | 0) == ($18 | 0)) {
                HEAP32[$27 >> 2] = $16;
                HEAP32[$17 >> 2] = $20;
                break;
              } else _abort();
            }
          } while (0);
          $30 = $14 << 3;
          HEAP32[($18 + 4) >> 2] = $30 | 3;
          $34 = ($18 + $30 + 4) | 0;
          HEAP32[$34 >> 2] = HEAP32[$34 >> 2] | 1;
          $$0 = $19;
          STACKTOP = sp;
          return $$0 | 0;
        }
        $37 = HEAP32[462] | 0;
        if ($6 >>> 0 > $37 >>> 0) {
          if ($9 | 0) {
            $41 = 2 << $7;
            $44 = ($9 << $7) & ($41 | (0 - $41));
            $47 = (($44 & (0 - $44)) + -1) | 0;
            $49 = ($47 >>> 12) & 16;
            $50 = $47 >>> $49;
            $52 = ($50 >>> 5) & 8;
            $54 = $50 >>> $52;
            $56 = ($54 >>> 2) & 4;
            $58 = $54 >>> $56;
            $60 = ($58 >>> 1) & 2;
            $62 = $58 >>> $60;
            $64 = ($62 >>> 1) & 1;
            $67 = (($52 | $49 | $56 | $60 | $64) + ($62 >>> $64)) | 0;
            $69 = (1880 + (($67 << 1) << 2)) | 0;
            $70 = ($69 + 8) | 0;
            $71 = HEAP32[$70 >> 2] | 0;
            $72 = ($71 + 8) | 0;
            $73 = HEAP32[$72 >> 2] | 0;
            do {
              if (($73 | 0) == ($69 | 0)) {
                $77 = $8 & ~(1 << $67);
                HEAP32[460] = $77;
                $98 = $77;
              } else {
                if ((HEAP32[464] | 0) >>> 0 > $73 >>> 0) _abort();
                $80 = ($73 + 12) | 0;
                if ((HEAP32[$80 >> 2] | 0) == ($71 | 0)) {
                  HEAP32[$80 >> 2] = $69;
                  HEAP32[$70 >> 2] = $73;
                  $98 = $8;
                  break;
                } else _abort();
              }
            } while (0);
            $83 = $67 << 3;
            $84 = ($83 - $6) | 0;
            HEAP32[($71 + 4) >> 2] = $6 | 3;
            $87 = ($71 + $6) | 0;
            HEAP32[($87 + 4) >> 2] = $84 | 1;
            HEAP32[($71 + $83) >> 2] = $84;
            if ($37 | 0) {
              $92 = HEAP32[465] | 0;
              $93 = $37 >>> 3;
              $95 = (1880 + (($93 << 1) << 2)) | 0;
              $96 = 1 << $93;
              if (!($98 & $96)) {
                HEAP32[460] = $98 | $96;
                $$0199 = $95;
                $$pre$phiZ2D = ($95 + 8) | 0;
              } else {
                $101 = ($95 + 8) | 0;
                $102 = HEAP32[$101 >> 2] | 0;
                if ((HEAP32[464] | 0) >>> 0 > $102 >>> 0) _abort();
                else {
                  $$0199 = $102;
                  $$pre$phiZ2D = $101;
                }
              }
              HEAP32[$$pre$phiZ2D >> 2] = $92;
              HEAP32[($$0199 + 12) >> 2] = $92;
              HEAP32[($92 + 8) >> 2] = $$0199;
              HEAP32[($92 + 12) >> 2] = $95;
            }
            HEAP32[462] = $84;
            HEAP32[465] = $87;
            $$0 = $72;
            STACKTOP = sp;
            return $$0 | 0;
          }
          $108 = HEAP32[461] | 0;
          if (!$108) $$0197 = $6;
          else {
            $112 = (($108 & (0 - $108)) + -1) | 0;
            $114 = ($112 >>> 12) & 16;
            $115 = $112 >>> $114;
            $117 = ($115 >>> 5) & 8;
            $119 = $115 >>> $117;
            $121 = ($119 >>> 2) & 4;
            $123 = $119 >>> $121;
            $125 = ($123 >>> 1) & 2;
            $127 = $123 >>> $125;
            $129 = ($127 >>> 1) & 1;
            $134 =
              HEAP32[
                (2144 +
                  ((($117 | $114 | $121 | $125 | $129) + ($127 >>> $129)) <<
                    2)) >>
                  2
              ] | 0;
            $138 = ((HEAP32[($134 + 4) >> 2] & -8) - $6) | 0;
            $143 =
              HEAP32[
                ($134 +
                  16 +
                  ((((HEAP32[($134 + 16) >> 2] | 0) == 0) & 1) << 2)) >>
                  2
              ] | 0;
            if (!$143) {
              $$0192$lcssa$i = $134;
              $$0193$lcssa$i = $138;
            } else {
              $$01926$i = $134;
              $$01935$i = $138;
              $146 = $143;
              while (1) {
                $149 = ((HEAP32[($146 + 4) >> 2] & -8) - $6) | 0;
                $150 = $149 >>> 0 < $$01935$i >>> 0;
                $$$0193$i = $150 ? $149 : $$01935$i;
                $$$0192$i = $150 ? $146 : $$01926$i;
                $146 =
                  HEAP32[
                    ($146 +
                      16 +
                      ((((HEAP32[($146 + 16) >> 2] | 0) == 0) & 1) << 2)) >>
                      2
                  ] | 0;
                if (!$146) {
                  $$0192$lcssa$i = $$$0192$i;
                  $$0193$lcssa$i = $$$0193$i;
                  break;
                } else {
                  $$01926$i = $$$0192$i;
                  $$01935$i = $$$0193$i;
                }
              }
            }
            $157 = HEAP32[464] | 0;
            if ($157 >>> 0 > $$0192$lcssa$i >>> 0) _abort();
            $159 = ($$0192$lcssa$i + $6) | 0;
            if ($159 >>> 0 <= $$0192$lcssa$i >>> 0) _abort();
            $162 = HEAP32[($$0192$lcssa$i + 24) >> 2] | 0;
            $164 = HEAP32[($$0192$lcssa$i + 12) >> 2] | 0;
            do {
              if (($164 | 0) == ($$0192$lcssa$i | 0)) {
                $175 = ($$0192$lcssa$i + 20) | 0;
                $176 = HEAP32[$175 >> 2] | 0;
                if (!$176) {
                  $178 = ($$0192$lcssa$i + 16) | 0;
                  $179 = HEAP32[$178 >> 2] | 0;
                  if (!$179) {
                    $$3$i = 0;
                    break;
                  } else {
                    $$1196$i = $179;
                    $$1198$i = $178;
                  }
                } else {
                  $$1196$i = $176;
                  $$1198$i = $175;
                }
                while (1) {
                  $181 = ($$1196$i + 20) | 0;
                  $182 = HEAP32[$181 >> 2] | 0;
                  if ($182 | 0) {
                    $$1196$i = $182;
                    $$1198$i = $181;
                    continue;
                  }
                  $184 = ($$1196$i + 16) | 0;
                  $185 = HEAP32[$184 >> 2] | 0;
                  if (!$185) break;
                  else {
                    $$1196$i = $185;
                    $$1198$i = $184;
                  }
                }
                if ($157 >>> 0 > $$1198$i >>> 0) _abort();
                else {
                  HEAP32[$$1198$i >> 2] = 0;
                  $$3$i = $$1196$i;
                  break;
                }
              } else {
                $167 = HEAP32[($$0192$lcssa$i + 8) >> 2] | 0;
                if ($157 >>> 0 > $167 >>> 0) _abort();
                $169 = ($167 + 12) | 0;
                if ((HEAP32[$169 >> 2] | 0) != ($$0192$lcssa$i | 0)) _abort();
                $172 = ($164 + 8) | 0;
                if ((HEAP32[$172 >> 2] | 0) == ($$0192$lcssa$i | 0)) {
                  HEAP32[$169 >> 2] = $164;
                  HEAP32[$172 >> 2] = $167;
                  $$3$i = $164;
                  break;
                } else _abort();
              }
            } while (0);
            L73: do {
              if ($162 | 0) {
                $190 = HEAP32[($$0192$lcssa$i + 28) >> 2] | 0;
                $191 = (2144 + ($190 << 2)) | 0;
                do {
                  if (($$0192$lcssa$i | 0) == (HEAP32[$191 >> 2] | 0)) {
                    HEAP32[$191 >> 2] = $$3$i;
                    if (!$$3$i) {
                      HEAP32[461] = $108 & ~(1 << $190);
                      break L73;
                    }
                  } else if ((HEAP32[464] | 0) >>> 0 > $162 >>> 0) _abort();
                  else {
                    HEAP32[
                      ($162 +
                        16 +
                        ((((HEAP32[($162 + 16) >> 2] | 0) !=
                          ($$0192$lcssa$i | 0)) &
                          1) <<
                          2)) >>
                        2
                    ] = $$3$i;
                    if (!$$3$i) break L73;
                    else break;
                  }
                } while (0);
                $204 = HEAP32[464] | 0;
                if ($204 >>> 0 > $$3$i >>> 0) _abort();
                HEAP32[($$3$i + 24) >> 2] = $162;
                $208 = HEAP32[($$0192$lcssa$i + 16) >> 2] | 0;
                do {
                  if ($208 | 0)
                    if ($204 >>> 0 > $208 >>> 0) _abort();
                    else {
                      HEAP32[($$3$i + 16) >> 2] = $208;
                      HEAP32[($208 + 24) >> 2] = $$3$i;
                      break;
                    }
                } while (0);
                $214 = HEAP32[($$0192$lcssa$i + 20) >> 2] | 0;
                if ($214 | 0)
                  if ((HEAP32[464] | 0) >>> 0 > $214 >>> 0) _abort();
                  else {
                    HEAP32[($$3$i + 20) >> 2] = $214;
                    HEAP32[($214 + 24) >> 2] = $$3$i;
                    break;
                  }
              }
            } while (0);
            if ($$0193$lcssa$i >>> 0 < 16) {
              $221 = ($$0193$lcssa$i + $6) | 0;
              HEAP32[($$0192$lcssa$i + 4) >> 2] = $221 | 3;
              $225 = ($$0192$lcssa$i + $221 + 4) | 0;
              HEAP32[$225 >> 2] = HEAP32[$225 >> 2] | 1;
            } else {
              HEAP32[($$0192$lcssa$i + 4) >> 2] = $6 | 3;
              HEAP32[($159 + 4) >> 2] = $$0193$lcssa$i | 1;
              HEAP32[($159 + $$0193$lcssa$i) >> 2] = $$0193$lcssa$i;
              if ($37 | 0) {
                $234 = HEAP32[465] | 0;
                $235 = $37 >>> 3;
                $237 = (1880 + (($235 << 1) << 2)) | 0;
                $238 = 1 << $235;
                if (!($8 & $238)) {
                  HEAP32[460] = $8 | $238;
                  $$0189$i = $237;
                  $$pre$phi$iZ2D = ($237 + 8) | 0;
                } else {
                  $242 = ($237 + 8) | 0;
                  $243 = HEAP32[$242 >> 2] | 0;
                  if ((HEAP32[464] | 0) >>> 0 > $243 >>> 0) _abort();
                  else {
                    $$0189$i = $243;
                    $$pre$phi$iZ2D = $242;
                  }
                }
                HEAP32[$$pre$phi$iZ2D >> 2] = $234;
                HEAP32[($$0189$i + 12) >> 2] = $234;
                HEAP32[($234 + 8) >> 2] = $$0189$i;
                HEAP32[($234 + 12) >> 2] = $237;
              }
              HEAP32[462] = $$0193$lcssa$i;
              HEAP32[465] = $159;
            }
            $$0 = ($$0192$lcssa$i + 8) | 0;
            STACKTOP = sp;
            return $$0 | 0;
          }
        } else $$0197 = $6;
      } else if ($0 >>> 0 > 4294967231) $$0197 = -1;
      else {
        $251 = ($0 + 11) | 0;
        $252 = $251 & -8;
        $253 = HEAP32[461] | 0;
        if (!$253) $$0197 = $252;
        else {
          $255 = (0 - $252) | 0;
          $256 = $251 >>> 8;
          if (!$256) $$0358$i = 0;
          else if ($252 >>> 0 > 16777215) $$0358$i = 31;
          else {
            $261 = ((($256 + 1048320) | 0) >>> 16) & 8;
            $262 = $256 << $261;
            $265 = ((($262 + 520192) | 0) >>> 16) & 4;
            $267 = $262 << $265;
            $270 = ((($267 + 245760) | 0) >>> 16) & 2;
            $275 = (14 - ($265 | $261 | $270) + (($267 << $270) >>> 15)) | 0;
            $$0358$i = (($252 >>> (($275 + 7) | 0)) & 1) | ($275 << 1);
          }
          $282 = HEAP32[(2144 + ($$0358$i << 2)) >> 2] | 0;
          L117: do {
            if (!$282) {
              $$2355$i = 0;
              $$3$i203 = 0;
              $$3350$i = $255;
              label = 81;
            } else {
              $$0342$i = 0;
              $$0347$i = $255;
              $$0353$i = $282;
              $$0359$i =
                $252 <<
                (($$0358$i | 0) == 31 ? 0 : (25 - ($$0358$i >>> 1)) | 0);
              $$0362$i = 0;
              while (1) {
                $292 = ((HEAP32[($$0353$i + 4) >> 2] & -8) - $252) | 0;
                if ($292 >>> 0 < $$0347$i >>> 0)
                  if (!$292) {
                    $$414$i = $$0353$i;
                    $$435113$i = 0;
                    $$435712$i = $$0353$i;
                    label = 85;
                    break L117;
                  } else {
                    $$1343$i = $$0353$i;
                    $$1348$i = $292;
                  }
                else {
                  $$1343$i = $$0342$i;
                  $$1348$i = $$0347$i;
                }
                $296 = HEAP32[($$0353$i + 20) >> 2] | 0;
                $$0353$i =
                  HEAP32[($$0353$i + 16 + (($$0359$i >>> 31) << 2)) >> 2] | 0;
                $$1363$i =
                  (($296 | 0) == 0) | (($296 | 0) == ($$0353$i | 0))
                    ? $$0362$i
                    : $296;
                $302 = ($$0353$i | 0) == 0;
                if ($302) {
                  $$2355$i = $$1363$i;
                  $$3$i203 = $$1343$i;
                  $$3350$i = $$1348$i;
                  label = 81;
                  break;
                } else {
                  $$0342$i = $$1343$i;
                  $$0347$i = $$1348$i;
                  $$0359$i = $$0359$i << (($302 ^ 1) & 1);
                  $$0362$i = $$1363$i;
                }
              }
            }
          } while (0);
          if ((label | 0) == 81) {
            if ((($$2355$i | 0) == 0) & (($$3$i203 | 0) == 0)) {
              $306 = 2 << $$0358$i;
              $309 = $253 & ($306 | (0 - $306));
              if (!$309) {
                $$0197 = $252;
                break;
              }
              $313 = (($309 & (0 - $309)) + -1) | 0;
              $315 = ($313 >>> 12) & 16;
              $316 = $313 >>> $315;
              $318 = ($316 >>> 5) & 8;
              $320 = $316 >>> $318;
              $322 = ($320 >>> 2) & 4;
              $324 = $320 >>> $322;
              $326 = ($324 >>> 1) & 2;
              $328 = $324 >>> $326;
              $330 = ($328 >>> 1) & 1;
              $$4$ph$i = 0;
              $$4357$ph$i =
                HEAP32[
                  (2144 +
                    ((($318 | $315 | $322 | $326 | $330) + ($328 >>> $330)) <<
                      2)) >>
                    2
                ] | 0;
            } else {
              $$4$ph$i = $$3$i203;
              $$4357$ph$i = $$2355$i;
            }
            if (!$$4357$ph$i) {
              $$4$lcssa$i = $$4$ph$i;
              $$4351$lcssa$i = $$3350$i;
            } else {
              $$414$i = $$4$ph$i;
              $$435113$i = $$3350$i;
              $$435712$i = $$4357$ph$i;
              label = 85;
            }
          }
          if ((label | 0) == 85)
            while (1) {
              label = 0;
              $340 = ((HEAP32[($$435712$i + 4) >> 2] & -8) - $252) | 0;
              $341 = $340 >>> 0 < $$435113$i >>> 0;
              $$$4351$i = $341 ? $340 : $$435113$i;
              $$4357$$4$i = $341 ? $$435712$i : $$414$i;
              $$435712$i =
                HEAP32[
                  ($$435712$i +
                    16 +
                    ((((HEAP32[($$435712$i + 16) >> 2] | 0) == 0) & 1) << 2)) >>
                    2
                ] | 0;
              if (!$$435712$i) {
                $$4$lcssa$i = $$4357$$4$i;
                $$4351$lcssa$i = $$$4351$i;
                break;
              } else {
                $$414$i = $$4357$$4$i;
                $$435113$i = $$$4351$i;
                label = 85;
              }
            }
          if (!$$4$lcssa$i) $$0197 = $252;
          else if (
            $$4351$lcssa$i >>> 0 <
            (((HEAP32[462] | 0) - $252) | 0) >>> 0
          ) {
            $352 = HEAP32[464] | 0;
            if ($352 >>> 0 > $$4$lcssa$i >>> 0) _abort();
            $354 = ($$4$lcssa$i + $252) | 0;
            if ($354 >>> 0 <= $$4$lcssa$i >>> 0) _abort();
            $357 = HEAP32[($$4$lcssa$i + 24) >> 2] | 0;
            $359 = HEAP32[($$4$lcssa$i + 12) >> 2] | 0;
            do {
              if (($359 | 0) == ($$4$lcssa$i | 0)) {
                $370 = ($$4$lcssa$i + 20) | 0;
                $371 = HEAP32[$370 >> 2] | 0;
                if (!$371) {
                  $373 = ($$4$lcssa$i + 16) | 0;
                  $374 = HEAP32[$373 >> 2] | 0;
                  if (!$374) {
                    $$3372$i = 0;
                    break;
                  } else {
                    $$1370$i = $374;
                    $$1374$i = $373;
                  }
                } else {
                  $$1370$i = $371;
                  $$1374$i = $370;
                }
                while (1) {
                  $376 = ($$1370$i + 20) | 0;
                  $377 = HEAP32[$376 >> 2] | 0;
                  if ($377 | 0) {
                    $$1370$i = $377;
                    $$1374$i = $376;
                    continue;
                  }
                  $379 = ($$1370$i + 16) | 0;
                  $380 = HEAP32[$379 >> 2] | 0;
                  if (!$380) break;
                  else {
                    $$1370$i = $380;
                    $$1374$i = $379;
                  }
                }
                if ($352 >>> 0 > $$1374$i >>> 0) _abort();
                else {
                  HEAP32[$$1374$i >> 2] = 0;
                  $$3372$i = $$1370$i;
                  break;
                }
              } else {
                $362 = HEAP32[($$4$lcssa$i + 8) >> 2] | 0;
                if ($352 >>> 0 > $362 >>> 0) _abort();
                $364 = ($362 + 12) | 0;
                if ((HEAP32[$364 >> 2] | 0) != ($$4$lcssa$i | 0)) _abort();
                $367 = ($359 + 8) | 0;
                if ((HEAP32[$367 >> 2] | 0) == ($$4$lcssa$i | 0)) {
                  HEAP32[$364 >> 2] = $359;
                  HEAP32[$367 >> 2] = $362;
                  $$3372$i = $359;
                  break;
                } else _abort();
              }
            } while (0);
            L164: do {
              if (!$357) $475 = $253;
              else {
                $385 = HEAP32[($$4$lcssa$i + 28) >> 2] | 0;
                $386 = (2144 + ($385 << 2)) | 0;
                do {
                  if (($$4$lcssa$i | 0) == (HEAP32[$386 >> 2] | 0)) {
                    HEAP32[$386 >> 2] = $$3372$i;
                    if (!$$3372$i) {
                      $391 = $253 & ~(1 << $385);
                      HEAP32[461] = $391;
                      $475 = $391;
                      break L164;
                    }
                  } else if ((HEAP32[464] | 0) >>> 0 > $357 >>> 0) _abort();
                  else {
                    HEAP32[
                      ($357 +
                        16 +
                        ((((HEAP32[($357 + 16) >> 2] | 0) !=
                          ($$4$lcssa$i | 0)) &
                          1) <<
                          2)) >>
                        2
                    ] = $$3372$i;
                    if (!$$3372$i) {
                      $475 = $253;
                      break L164;
                    } else break;
                  }
                } while (0);
                $399 = HEAP32[464] | 0;
                if ($399 >>> 0 > $$3372$i >>> 0) _abort();
                HEAP32[($$3372$i + 24) >> 2] = $357;
                $403 = HEAP32[($$4$lcssa$i + 16) >> 2] | 0;
                do {
                  if ($403 | 0)
                    if ($399 >>> 0 > $403 >>> 0) _abort();
                    else {
                      HEAP32[($$3372$i + 16) >> 2] = $403;
                      HEAP32[($403 + 24) >> 2] = $$3372$i;
                      break;
                    }
                } while (0);
                $409 = HEAP32[($$4$lcssa$i + 20) >> 2] | 0;
                if (!$409) $475 = $253;
                else if ((HEAP32[464] | 0) >>> 0 > $409 >>> 0) _abort();
                else {
                  HEAP32[($$3372$i + 20) >> 2] = $409;
                  HEAP32[($409 + 24) >> 2] = $$3372$i;
                  $475 = $253;
                  break;
                }
              }
            } while (0);
            do {
              if ($$4351$lcssa$i >>> 0 < 16) {
                $416 = ($$4351$lcssa$i + $252) | 0;
                HEAP32[($$4$lcssa$i + 4) >> 2] = $416 | 3;
                $420 = ($$4$lcssa$i + $416 + 4) | 0;
                HEAP32[$420 >> 2] = HEAP32[$420 >> 2] | 1;
              } else {
                HEAP32[($$4$lcssa$i + 4) >> 2] = $252 | 3;
                HEAP32[($354 + 4) >> 2] = $$4351$lcssa$i | 1;
                HEAP32[($354 + $$4351$lcssa$i) >> 2] = $$4351$lcssa$i;
                $428 = $$4351$lcssa$i >>> 3;
                if ($$4351$lcssa$i >>> 0 < 256) {
                  $431 = (1880 + (($428 << 1) << 2)) | 0;
                  $432 = HEAP32[460] | 0;
                  $433 = 1 << $428;
                  if (!($432 & $433)) {
                    HEAP32[460] = $432 | $433;
                    $$0368$i = $431;
                    $$pre$phi$i211Z2D = ($431 + 8) | 0;
                  } else {
                    $437 = ($431 + 8) | 0;
                    $438 = HEAP32[$437 >> 2] | 0;
                    if ((HEAP32[464] | 0) >>> 0 > $438 >>> 0) _abort();
                    else {
                      $$0368$i = $438;
                      $$pre$phi$i211Z2D = $437;
                    }
                  }
                  HEAP32[$$pre$phi$i211Z2D >> 2] = $354;
                  HEAP32[($$0368$i + 12) >> 2] = $354;
                  HEAP32[($354 + 8) >> 2] = $$0368$i;
                  HEAP32[($354 + 12) >> 2] = $431;
                  break;
                }
                $444 = $$4351$lcssa$i >>> 8;
                if (!$444) $$0361$i = 0;
                else if ($$4351$lcssa$i >>> 0 > 16777215) $$0361$i = 31;
                else {
                  $449 = ((($444 + 1048320) | 0) >>> 16) & 8;
                  $450 = $444 << $449;
                  $453 = ((($450 + 520192) | 0) >>> 16) & 4;
                  $455 = $450 << $453;
                  $458 = ((($455 + 245760) | 0) >>> 16) & 2;
                  $463 =
                    (14 - ($453 | $449 | $458) + (($455 << $458) >>> 15)) | 0;
                  $$0361$i =
                    (($$4351$lcssa$i >>> (($463 + 7) | 0)) & 1) | ($463 << 1);
                }
                $469 = (2144 + ($$0361$i << 2)) | 0;
                HEAP32[($354 + 28) >> 2] = $$0361$i;
                $471 = ($354 + 16) | 0;
                HEAP32[($471 + 4) >> 2] = 0;
                HEAP32[$471 >> 2] = 0;
                $473 = 1 << $$0361$i;
                if (!($475 & $473)) {
                  HEAP32[461] = $475 | $473;
                  HEAP32[$469 >> 2] = $354;
                  HEAP32[($354 + 24) >> 2] = $469;
                  HEAP32[($354 + 12) >> 2] = $354;
                  HEAP32[($354 + 8) >> 2] = $354;
                  break;
                }
                $$0344$i =
                  $$4351$lcssa$i <<
                  (($$0361$i | 0) == 31 ? 0 : (25 - ($$0361$i >>> 1)) | 0);
                $$0345$i = HEAP32[$469 >> 2] | 0;
                while (1) {
                  if (
                    ((HEAP32[($$0345$i + 4) >> 2] & -8) | 0) ==
                    ($$4351$lcssa$i | 0)
                  ) {
                    label = 139;
                    break;
                  }
                  $492 = ($$0345$i + 16 + (($$0344$i >>> 31) << 2)) | 0;
                  $494 = HEAP32[$492 >> 2] | 0;
                  if (!$494) {
                    label = 136;
                    break;
                  } else {
                    $$0344$i = $$0344$i << 1;
                    $$0345$i = $494;
                  }
                }
                if ((label | 0) == 136)
                  if ((HEAP32[464] | 0) >>> 0 > $492 >>> 0) _abort();
                  else {
                    HEAP32[$492 >> 2] = $354;
                    HEAP32[($354 + 24) >> 2] = $$0345$i;
                    HEAP32[($354 + 12) >> 2] = $354;
                    HEAP32[($354 + 8) >> 2] = $354;
                    break;
                  }
                else if ((label | 0) == 139) {
                  $501 = ($$0345$i + 8) | 0;
                  $502 = HEAP32[$501 >> 2] | 0;
                  $503 = HEAP32[464] | 0;
                  if (
                    ($503 >>> 0 <= $502 >>> 0) &
                    ($503 >>> 0 <= $$0345$i >>> 0)
                  ) {
                    HEAP32[($502 + 12) >> 2] = $354;
                    HEAP32[$501 >> 2] = $354;
                    HEAP32[($354 + 8) >> 2] = $502;
                    HEAP32[($354 + 12) >> 2] = $$0345$i;
                    HEAP32[($354 + 24) >> 2] = 0;
                    break;
                  } else _abort();
                }
              }
            } while (0);
            $$0 = ($$4$lcssa$i + 8) | 0;
            STACKTOP = sp;
            return $$0 | 0;
          } else $$0197 = $252;
        }
      }
    } while (0);
    $512 = HEAP32[462] | 0;
    if ($512 >>> 0 >= $$0197 >>> 0) {
      $514 = ($512 - $$0197) | 0;
      $515 = HEAP32[465] | 0;
      if ($514 >>> 0 > 15) {
        $517 = ($515 + $$0197) | 0;
        HEAP32[465] = $517;
        HEAP32[462] = $514;
        HEAP32[($517 + 4) >> 2] = $514 | 1;
        HEAP32[($515 + $512) >> 2] = $514;
        HEAP32[($515 + 4) >> 2] = $$0197 | 3;
      } else {
        HEAP32[462] = 0;
        HEAP32[465] = 0;
        HEAP32[($515 + 4) >> 2] = $512 | 3;
        $526 = ($515 + $512 + 4) | 0;
        HEAP32[$526 >> 2] = HEAP32[$526 >> 2] | 1;
      }
      $$0 = ($515 + 8) | 0;
      STACKTOP = sp;
      return $$0 | 0;
    }
    $530 = HEAP32[463] | 0;
    if ($530 >>> 0 > $$0197 >>> 0) {
      $532 = ($530 - $$0197) | 0;
      HEAP32[463] = $532;
      $533 = HEAP32[466] | 0;
      $534 = ($533 + $$0197) | 0;
      HEAP32[466] = $534;
      HEAP32[($534 + 4) >> 2] = $532 | 1;
      HEAP32[($533 + 4) >> 2] = $$0197 | 3;
      $$0 = ($533 + 8) | 0;
      STACKTOP = sp;
      return $$0 | 0;
    }
    if (!(HEAP32[578] | 0)) {
      HEAP32[580] = 4096;
      HEAP32[579] = 4096;
      HEAP32[581] = -1;
      HEAP32[582] = -1;
      HEAP32[583] = 0;
      HEAP32[571] = 0;
      HEAP32[578] = ($1 & -16) ^ 1431655768;
      $548 = 4096;
    } else $548 = HEAP32[580] | 0;
    $545 = ($$0197 + 48) | 0;
    $546 = ($$0197 + 47) | 0;
    $547 = ($548 + $546) | 0;
    $549 = (0 - $548) | 0;
    $550 = $547 & $549;
    if ($550 >>> 0 <= $$0197 >>> 0) {
      $$0 = 0;
      STACKTOP = sp;
      return $$0 | 0;
    }
    $552 = HEAP32[570] | 0;
    if ($552 | 0) {
      $554 = HEAP32[568] | 0;
      $555 = ($554 + $550) | 0;
      if (($555 >>> 0 <= $554 >>> 0) | ($555 >>> 0 > $552 >>> 0)) {
        $$0 = 0;
        STACKTOP = sp;
        return $$0 | 0;
      }
    }
    L244: do {
      if (!(HEAP32[571] & 4)) {
        $561 = HEAP32[466] | 0;
        L246: do {
          if (!$561) label = 163;
          else {
            $$0$i$i = 2288;
            while (1) {
              $563 = HEAP32[$$0$i$i >> 2] | 0;
              if ($563 >>> 0 <= $561 >>> 0) {
                $565 = ($$0$i$i + 4) | 0;
                if ((($563 + (HEAP32[$565 >> 2] | 0)) | 0) >>> 0 > $561 >>> 0)
                  break;
              }
              $570 = HEAP32[($$0$i$i + 8) >> 2] | 0;
              if (!$570) {
                label = 163;
                break L246;
              } else $$0$i$i = $570;
            }
            $595 = ($547 - $530) & $549;
            if ($595 >>> 0 < 2147483647) {
              $597 = _sbrk($595 | 0) | 0;
              if (
                ($597 | 0) ==
                (((HEAP32[$$0$i$i >> 2] | 0) + (HEAP32[$565 >> 2] | 0)) | 0)
              )
                if (($597 | 0) == (-1 | 0)) $$2234243136$i = $595;
                else {
                  $$723947$i = $595;
                  $$748$i = $597;
                  label = 180;
                  break L244;
                }
              else {
                $$2247$ph$i = $597;
                $$2253$ph$i = $595;
                label = 171;
              }
            } else $$2234243136$i = 0;
          }
        } while (0);
        do {
          if ((label | 0) == 163) {
            $572 = _sbrk(0) | 0;
            if (($572 | 0) == (-1 | 0)) $$2234243136$i = 0;
            else {
              $574 = $572;
              $575 = HEAP32[579] | 0;
              $576 = ($575 + -1) | 0;
              $$$i =
                (((($576 & $574) | 0) == 0
                  ? 0
                  : ((($576 + $574) & (0 - $575)) - $574) | 0) +
                  $550) |
                0;
              $584 = HEAP32[568] | 0;
              $585 = ($$$i + $584) | 0;
              if (($$$i >>> 0 > $$0197 >>> 0) & ($$$i >>> 0 < 2147483647)) {
                $588 = HEAP32[570] | 0;
                if ($588 | 0)
                  if (($585 >>> 0 <= $584 >>> 0) | ($585 >>> 0 > $588 >>> 0)) {
                    $$2234243136$i = 0;
                    break;
                  }
                $592 = _sbrk($$$i | 0) | 0;
                if (($592 | 0) == ($572 | 0)) {
                  $$723947$i = $$$i;
                  $$748$i = $572;
                  label = 180;
                  break L244;
                } else {
                  $$2247$ph$i = $592;
                  $$2253$ph$i = $$$i;
                  label = 171;
                }
              } else $$2234243136$i = 0;
            }
          }
        } while (0);
        do {
          if ((label | 0) == 171) {
            $603 = (0 - $$2253$ph$i) | 0;
            if (
              !(
                ($545 >>> 0 > $$2253$ph$i >>> 0) &
                (($$2253$ph$i >>> 0 < 2147483647) &
                  (($$2247$ph$i | 0) != (-1 | 0)))
              )
            )
              if (($$2247$ph$i | 0) == (-1 | 0)) {
                $$2234243136$i = 0;
                break;
              } else {
                $$723947$i = $$2253$ph$i;
                $$748$i = $$2247$ph$i;
                label = 180;
                break L244;
              }
            $607 = HEAP32[580] | 0;
            $611 = ($546 - $$2253$ph$i + $607) & (0 - $607);
            if ($611 >>> 0 >= 2147483647) {
              $$723947$i = $$2253$ph$i;
              $$748$i = $$2247$ph$i;
              label = 180;
              break L244;
            }
            if ((_sbrk($611 | 0) | 0) == (-1 | 0)) {
              _sbrk($603 | 0) | 0;
              $$2234243136$i = 0;
              break;
            } else {
              $$723947$i = ($611 + $$2253$ph$i) | 0;
              $$748$i = $$2247$ph$i;
              label = 180;
              break L244;
            }
          }
        } while (0);
        HEAP32[571] = HEAP32[571] | 4;
        $$4236$i = $$2234243136$i;
        label = 178;
      } else {
        $$4236$i = 0;
        label = 178;
      }
    } while (0);
    if ((label | 0) == 178)
      if ($550 >>> 0 < 2147483647) {
        $620 = _sbrk($550 | 0) | 0;
        $621 = _sbrk(0) | 0;
        $627 = ($621 - $620) | 0;
        $629 = $627 >>> 0 > (($$0197 + 40) | 0) >>> 0;
        if (
          !(
            (($620 | 0) == (-1 | 0)) |
            ($629 ^ 1) |
            ((($620 >>> 0 < $621 >>> 0) &
              ((($620 | 0) != (-1 | 0)) & (($621 | 0) != (-1 | 0)))) ^
              1)
          )
        ) {
          $$723947$i = $629 ? $627 : $$4236$i;
          $$748$i = $620;
          label = 180;
        }
      }
    if ((label | 0) == 180) {
      $633 = ((HEAP32[568] | 0) + $$723947$i) | 0;
      HEAP32[568] = $633;
      if ($633 >>> 0 > (HEAP32[569] | 0) >>> 0) HEAP32[569] = $633;
      $636 = HEAP32[466] | 0;
      do {
        if (!$636) {
          $638 = HEAP32[464] | 0;
          if ((($638 | 0) == 0) | ($$748$i >>> 0 < $638 >>> 0))
            HEAP32[464] = $$748$i;
          HEAP32[572] = $$748$i;
          HEAP32[573] = $$723947$i;
          HEAP32[575] = 0;
          HEAP32[469] = HEAP32[578];
          HEAP32[468] = -1;
          HEAP32[473] = 1880;
          HEAP32[472] = 1880;
          HEAP32[475] = 1888;
          HEAP32[474] = 1888;
          HEAP32[477] = 1896;
          HEAP32[476] = 1896;
          HEAP32[479] = 1904;
          HEAP32[478] = 1904;
          HEAP32[481] = 1912;
          HEAP32[480] = 1912;
          HEAP32[483] = 1920;
          HEAP32[482] = 1920;
          HEAP32[485] = 1928;
          HEAP32[484] = 1928;
          HEAP32[487] = 1936;
          HEAP32[486] = 1936;
          HEAP32[489] = 1944;
          HEAP32[488] = 1944;
          HEAP32[491] = 1952;
          HEAP32[490] = 1952;
          HEAP32[493] = 1960;
          HEAP32[492] = 1960;
          HEAP32[495] = 1968;
          HEAP32[494] = 1968;
          HEAP32[497] = 1976;
          HEAP32[496] = 1976;
          HEAP32[499] = 1984;
          HEAP32[498] = 1984;
          HEAP32[501] = 1992;
          HEAP32[500] = 1992;
          HEAP32[503] = 2e3;
          HEAP32[502] = 2e3;
          HEAP32[505] = 2008;
          HEAP32[504] = 2008;
          HEAP32[507] = 2016;
          HEAP32[506] = 2016;
          HEAP32[509] = 2024;
          HEAP32[508] = 2024;
          HEAP32[511] = 2032;
          HEAP32[510] = 2032;
          HEAP32[513] = 2040;
          HEAP32[512] = 2040;
          HEAP32[515] = 2048;
          HEAP32[514] = 2048;
          HEAP32[517] = 2056;
          HEAP32[516] = 2056;
          HEAP32[519] = 2064;
          HEAP32[518] = 2064;
          HEAP32[521] = 2072;
          HEAP32[520] = 2072;
          HEAP32[523] = 2080;
          HEAP32[522] = 2080;
          HEAP32[525] = 2088;
          HEAP32[524] = 2088;
          HEAP32[527] = 2096;
          HEAP32[526] = 2096;
          HEAP32[529] = 2104;
          HEAP32[528] = 2104;
          HEAP32[531] = 2112;
          HEAP32[530] = 2112;
          HEAP32[533] = 2120;
          HEAP32[532] = 2120;
          HEAP32[535] = 2128;
          HEAP32[534] = 2128;
          $642 = ($$723947$i + -40) | 0;
          $644 = ($$748$i + 8) | 0;
          $649 = (($644 & 7) | 0) == 0 ? 0 : (0 - $644) & 7;
          $650 = ($$748$i + $649) | 0;
          $651 = ($642 - $649) | 0;
          HEAP32[466] = $650;
          HEAP32[463] = $651;
          HEAP32[($650 + 4) >> 2] = $651 | 1;
          HEAP32[($$748$i + $642 + 4) >> 2] = 40;
          HEAP32[467] = HEAP32[582];
        } else {
          $$024367$i = 2288;
          while (1) {
            $657 = HEAP32[$$024367$i >> 2] | 0;
            $658 = ($$024367$i + 4) | 0;
            $659 = HEAP32[$658 >> 2] | 0;
            if (($$748$i | 0) == (($657 + $659) | 0)) {
              label = 188;
              break;
            }
            $663 = HEAP32[($$024367$i + 8) >> 2] | 0;
            if (!$663) break;
            else $$024367$i = $663;
          }
          if ((label | 0) == 188)
            if (!(HEAP32[($$024367$i + 12) >> 2] & 8))
              if (($$748$i >>> 0 > $636 >>> 0) & ($657 >>> 0 <= $636 >>> 0)) {
                HEAP32[$658 >> 2] = $659 + $$723947$i;
                $673 = ((HEAP32[463] | 0) + $$723947$i) | 0;
                $675 = ($636 + 8) | 0;
                $680 = (($675 & 7) | 0) == 0 ? 0 : (0 - $675) & 7;
                $681 = ($636 + $680) | 0;
                $682 = ($673 - $680) | 0;
                HEAP32[466] = $681;
                HEAP32[463] = $682;
                HEAP32[($681 + 4) >> 2] = $682 | 1;
                HEAP32[($636 + $673 + 4) >> 2] = 40;
                HEAP32[467] = HEAP32[582];
                break;
              }
          $688 = HEAP32[464] | 0;
          if ($$748$i >>> 0 < $688 >>> 0) {
            HEAP32[464] = $$748$i;
            $752 = $$748$i;
          } else $752 = $688;
          $690 = ($$748$i + $$723947$i) | 0;
          $$124466$i = 2288;
          while (1) {
            if ((HEAP32[$$124466$i >> 2] | 0) == ($690 | 0)) {
              label = 196;
              break;
            }
            $694 = HEAP32[($$124466$i + 8) >> 2] | 0;
            if (!$694) {
              $$0$i$i$i = 2288;
              break;
            } else $$124466$i = $694;
          }
          if ((label | 0) == 196)
            if (!(HEAP32[($$124466$i + 12) >> 2] & 8)) {
              HEAP32[$$124466$i >> 2] = $$748$i;
              $700 = ($$124466$i + 4) | 0;
              HEAP32[$700 >> 2] = (HEAP32[$700 >> 2] | 0) + $$723947$i;
              $704 = ($$748$i + 8) | 0;
              $710 =
                ($$748$i + ((($704 & 7) | 0) == 0 ? 0 : (0 - $704) & 7)) | 0;
              $712 = ($690 + 8) | 0;
              $718 = ($690 + ((($712 & 7) | 0) == 0 ? 0 : (0 - $712) & 7)) | 0;
              $722 = ($710 + $$0197) | 0;
              $723 = ($718 - $710 - $$0197) | 0;
              HEAP32[($710 + 4) >> 2] = $$0197 | 3;
              do {
                if (($636 | 0) == ($718 | 0)) {
                  $728 = ((HEAP32[463] | 0) + $723) | 0;
                  HEAP32[463] = $728;
                  HEAP32[466] = $722;
                  HEAP32[($722 + 4) >> 2] = $728 | 1;
                } else {
                  if ((HEAP32[465] | 0) == ($718 | 0)) {
                    $734 = ((HEAP32[462] | 0) + $723) | 0;
                    HEAP32[462] = $734;
                    HEAP32[465] = $722;
                    HEAP32[($722 + 4) >> 2] = $734 | 1;
                    HEAP32[($722 + $734) >> 2] = $734;
                    break;
                  }
                  $739 = HEAP32[($718 + 4) >> 2] | 0;
                  if ((($739 & 3) | 0) == 1) {
                    $742 = $739 & -8;
                    $743 = $739 >>> 3;
                    L311: do {
                      if ($739 >>> 0 < 256) {
                        $746 = HEAP32[($718 + 8) >> 2] | 0;
                        $748 = HEAP32[($718 + 12) >> 2] | 0;
                        $750 = (1880 + (($743 << 1) << 2)) | 0;
                        do {
                          if (($746 | 0) != ($750 | 0)) {
                            if ($752 >>> 0 > $746 >>> 0) _abort();
                            if ((HEAP32[($746 + 12) >> 2] | 0) == ($718 | 0))
                              break;
                            _abort();
                          }
                        } while (0);
                        if (($748 | 0) == ($746 | 0)) {
                          HEAP32[460] = HEAP32[460] & ~(1 << $743);
                          break;
                        }
                        do {
                          if (($748 | 0) == ($750 | 0))
                            $$pre$phi11$i$iZ2D = ($748 + 8) | 0;
                          else {
                            if ($752 >>> 0 > $748 >>> 0) _abort();
                            $764 = ($748 + 8) | 0;
                            if ((HEAP32[$764 >> 2] | 0) == ($718 | 0)) {
                              $$pre$phi11$i$iZ2D = $764;
                              break;
                            }
                            _abort();
                          }
                        } while (0);
                        HEAP32[($746 + 12) >> 2] = $748;
                        HEAP32[$$pre$phi11$i$iZ2D >> 2] = $746;
                      } else {
                        $769 = HEAP32[($718 + 24) >> 2] | 0;
                        $771 = HEAP32[($718 + 12) >> 2] | 0;
                        do {
                          if (($771 | 0) == ($718 | 0)) {
                            $782 = ($718 + 16) | 0;
                            $783 = ($782 + 4) | 0;
                            $784 = HEAP32[$783 >> 2] | 0;
                            if (!$784) {
                              $786 = HEAP32[$782 >> 2] | 0;
                              if (!$786) {
                                $$3$i$i = 0;
                                break;
                              } else {
                                $$1291$i$i = $786;
                                $$1293$i$i = $782;
                              }
                            } else {
                              $$1291$i$i = $784;
                              $$1293$i$i = $783;
                            }
                            while (1) {
                              $788 = ($$1291$i$i + 20) | 0;
                              $789 = HEAP32[$788 >> 2] | 0;
                              if ($789 | 0) {
                                $$1291$i$i = $789;
                                $$1293$i$i = $788;
                                continue;
                              }
                              $791 = ($$1291$i$i + 16) | 0;
                              $792 = HEAP32[$791 >> 2] | 0;
                              if (!$792) break;
                              else {
                                $$1291$i$i = $792;
                                $$1293$i$i = $791;
                              }
                            }
                            if ($752 >>> 0 > $$1293$i$i >>> 0) _abort();
                            else {
                              HEAP32[$$1293$i$i >> 2] = 0;
                              $$3$i$i = $$1291$i$i;
                              break;
                            }
                          } else {
                            $774 = HEAP32[($718 + 8) >> 2] | 0;
                            if ($752 >>> 0 > $774 >>> 0) _abort();
                            $776 = ($774 + 12) | 0;
                            if ((HEAP32[$776 >> 2] | 0) != ($718 | 0)) _abort();
                            $779 = ($771 + 8) | 0;
                            if ((HEAP32[$779 >> 2] | 0) == ($718 | 0)) {
                              HEAP32[$776 >> 2] = $771;
                              HEAP32[$779 >> 2] = $774;
                              $$3$i$i = $771;
                              break;
                            } else _abort();
                          }
                        } while (0);
                        if (!$769) break;
                        $797 = HEAP32[($718 + 28) >> 2] | 0;
                        $798 = (2144 + ($797 << 2)) | 0;
                        do {
                          if ((HEAP32[$798 >> 2] | 0) == ($718 | 0)) {
                            HEAP32[$798 >> 2] = $$3$i$i;
                            if ($$3$i$i | 0) break;
                            HEAP32[461] = HEAP32[461] & ~(1 << $797);
                            break L311;
                          } else if ((HEAP32[464] | 0) >>> 0 > $769 >>> 0)
                            _abort();
                          else {
                            HEAP32[
                              ($769 +
                                16 +
                                ((((HEAP32[($769 + 16) >> 2] | 0) !=
                                  ($718 | 0)) &
                                  1) <<
                                  2)) >>
                                2
                            ] = $$3$i$i;
                            if (!$$3$i$i) break L311;
                            else break;
                          }
                        } while (0);
                        $812 = HEAP32[464] | 0;
                        if ($812 >>> 0 > $$3$i$i >>> 0) _abort();
                        HEAP32[($$3$i$i + 24) >> 2] = $769;
                        $815 = ($718 + 16) | 0;
                        $816 = HEAP32[$815 >> 2] | 0;
                        do {
                          if ($816 | 0)
                            if ($812 >>> 0 > $816 >>> 0) _abort();
                            else {
                              HEAP32[($$3$i$i + 16) >> 2] = $816;
                              HEAP32[($816 + 24) >> 2] = $$3$i$i;
                              break;
                            }
                        } while (0);
                        $822 = HEAP32[($815 + 4) >> 2] | 0;
                        if (!$822) break;
                        if ((HEAP32[464] | 0) >>> 0 > $822 >>> 0) _abort();
                        else {
                          HEAP32[($$3$i$i + 20) >> 2] = $822;
                          HEAP32[($822 + 24) >> 2] = $$3$i$i;
                          break;
                        }
                      }
                    } while (0);
                    $$0$i17$i = ($718 + $742) | 0;
                    $$0287$i$i = ($742 + $723) | 0;
                  } else {
                    $$0$i17$i = $718;
                    $$0287$i$i = $723;
                  }
                  $830 = ($$0$i17$i + 4) | 0;
                  HEAP32[$830 >> 2] = HEAP32[$830 >> 2] & -2;
                  HEAP32[($722 + 4) >> 2] = $$0287$i$i | 1;
                  HEAP32[($722 + $$0287$i$i) >> 2] = $$0287$i$i;
                  $836 = $$0287$i$i >>> 3;
                  if ($$0287$i$i >>> 0 < 256) {
                    $839 = (1880 + (($836 << 1) << 2)) | 0;
                    $840 = HEAP32[460] | 0;
                    $841 = 1 << $836;
                    do {
                      if (!($840 & $841)) {
                        HEAP32[460] = $840 | $841;
                        $$0295$i$i = $839;
                        $$pre$phi$i19$iZ2D = ($839 + 8) | 0;
                      } else {
                        $845 = ($839 + 8) | 0;
                        $846 = HEAP32[$845 >> 2] | 0;
                        if ((HEAP32[464] | 0) >>> 0 <= $846 >>> 0) {
                          $$0295$i$i = $846;
                          $$pre$phi$i19$iZ2D = $845;
                          break;
                        }
                        _abort();
                      }
                    } while (0);
                    HEAP32[$$pre$phi$i19$iZ2D >> 2] = $722;
                    HEAP32[($$0295$i$i + 12) >> 2] = $722;
                    HEAP32[($722 + 8) >> 2] = $$0295$i$i;
                    HEAP32[($722 + 12) >> 2] = $839;
                    break;
                  }
                  $852 = $$0287$i$i >>> 8;
                  do {
                    if (!$852) $$0296$i$i = 0;
                    else {
                      if ($$0287$i$i >>> 0 > 16777215) {
                        $$0296$i$i = 31;
                        break;
                      }
                      $857 = ((($852 + 1048320) | 0) >>> 16) & 8;
                      $858 = $852 << $857;
                      $861 = ((($858 + 520192) | 0) >>> 16) & 4;
                      $863 = $858 << $861;
                      $866 = ((($863 + 245760) | 0) >>> 16) & 2;
                      $871 =
                        (14 - ($861 | $857 | $866) + (($863 << $866) >>> 15)) |
                        0;
                      $$0296$i$i =
                        (($$0287$i$i >>> (($871 + 7) | 0)) & 1) | ($871 << 1);
                    }
                  } while (0);
                  $877 = (2144 + ($$0296$i$i << 2)) | 0;
                  HEAP32[($722 + 28) >> 2] = $$0296$i$i;
                  $879 = ($722 + 16) | 0;
                  HEAP32[($879 + 4) >> 2] = 0;
                  HEAP32[$879 >> 2] = 0;
                  $881 = HEAP32[461] | 0;
                  $882 = 1 << $$0296$i$i;
                  if (!($881 & $882)) {
                    HEAP32[461] = $881 | $882;
                    HEAP32[$877 >> 2] = $722;
                    HEAP32[($722 + 24) >> 2] = $877;
                    HEAP32[($722 + 12) >> 2] = $722;
                    HEAP32[($722 + 8) >> 2] = $722;
                    break;
                  }
                  $$0288$i$i =
                    $$0287$i$i <<
                    (($$0296$i$i | 0) == 31
                      ? 0
                      : (25 - ($$0296$i$i >>> 1)) | 0);
                  $$0289$i$i = HEAP32[$877 >> 2] | 0;
                  while (1) {
                    if (
                      ((HEAP32[($$0289$i$i + 4) >> 2] & -8) | 0) ==
                      ($$0287$i$i | 0)
                    ) {
                      label = 263;
                      break;
                    }
                    $900 = ($$0289$i$i + 16 + (($$0288$i$i >>> 31) << 2)) | 0;
                    $902 = HEAP32[$900 >> 2] | 0;
                    if (!$902) {
                      label = 260;
                      break;
                    } else {
                      $$0288$i$i = $$0288$i$i << 1;
                      $$0289$i$i = $902;
                    }
                  }
                  if ((label | 0) == 260)
                    if ((HEAP32[464] | 0) >>> 0 > $900 >>> 0) _abort();
                    else {
                      HEAP32[$900 >> 2] = $722;
                      HEAP32[($722 + 24) >> 2] = $$0289$i$i;
                      HEAP32[($722 + 12) >> 2] = $722;
                      HEAP32[($722 + 8) >> 2] = $722;
                      break;
                    }
                  else if ((label | 0) == 263) {
                    $909 = ($$0289$i$i + 8) | 0;
                    $910 = HEAP32[$909 >> 2] | 0;
                    $911 = HEAP32[464] | 0;
                    if (
                      ($911 >>> 0 <= $910 >>> 0) &
                      ($911 >>> 0 <= $$0289$i$i >>> 0)
                    ) {
                      HEAP32[($910 + 12) >> 2] = $722;
                      HEAP32[$909 >> 2] = $722;
                      HEAP32[($722 + 8) >> 2] = $910;
                      HEAP32[($722 + 12) >> 2] = $$0289$i$i;
                      HEAP32[($722 + 24) >> 2] = 0;
                      break;
                    } else _abort();
                  }
                }
              } while (0);
              $$0 = ($710 + 8) | 0;
              STACKTOP = sp;
              return $$0 | 0;
            } else $$0$i$i$i = 2288;
          while (1) {
            $919 = HEAP32[$$0$i$i$i >> 2] | 0;
            if ($919 >>> 0 <= $636 >>> 0) {
              $923 = ($919 + (HEAP32[($$0$i$i$i + 4) >> 2] | 0)) | 0;
              if ($923 >>> 0 > $636 >>> 0) break;
            }
            $$0$i$i$i = HEAP32[($$0$i$i$i + 8) >> 2] | 0;
          }
          $927 = ($923 + -47) | 0;
          $929 = ($927 + 8) | 0;
          $935 = ($927 + ((($929 & 7) | 0) == 0 ? 0 : (0 - $929) & 7)) | 0;
          $936 = ($636 + 16) | 0;
          $938 = $935 >>> 0 < $936 >>> 0 ? $636 : $935;
          $939 = ($938 + 8) | 0;
          $941 = ($$723947$i + -40) | 0;
          $943 = ($$748$i + 8) | 0;
          $948 = (($943 & 7) | 0) == 0 ? 0 : (0 - $943) & 7;
          $949 = ($$748$i + $948) | 0;
          $950 = ($941 - $948) | 0;
          HEAP32[466] = $949;
          HEAP32[463] = $950;
          HEAP32[($949 + 4) >> 2] = $950 | 1;
          HEAP32[($$748$i + $941 + 4) >> 2] = 40;
          HEAP32[467] = HEAP32[582];
          $956 = ($938 + 4) | 0;
          HEAP32[$956 >> 2] = 27;
          HEAP32[$939 >> 2] = HEAP32[572];
          HEAP32[($939 + 4) >> 2] = HEAP32[573];
          HEAP32[($939 + 8) >> 2] = HEAP32[574];
          HEAP32[($939 + 12) >> 2] = HEAP32[575];
          HEAP32[572] = $$748$i;
          HEAP32[573] = $$723947$i;
          HEAP32[575] = 0;
          HEAP32[574] = $939;
          $958 = ($938 + 24) | 0;
          do {
            $958$looptemp = $958;
            $958 = ($958 + 4) | 0;
            HEAP32[$958 >> 2] = 7;
          } while ((($958$looptemp + 8) | 0) >>> 0 < $923 >>> 0);
          if (($938 | 0) != ($636 | 0)) {
            $964 = ($938 - $636) | 0;
            HEAP32[$956 >> 2] = HEAP32[$956 >> 2] & -2;
            HEAP32[($636 + 4) >> 2] = $964 | 1;
            HEAP32[$938 >> 2] = $964;
            $969 = $964 >>> 3;
            if ($964 >>> 0 < 256) {
              $972 = (1880 + (($969 << 1) << 2)) | 0;
              $973 = HEAP32[460] | 0;
              $974 = 1 << $969;
              if (!($973 & $974)) {
                HEAP32[460] = $973 | $974;
                $$0211$i$i = $972;
                $$pre$phi$i$iZ2D = ($972 + 8) | 0;
              } else {
                $978 = ($972 + 8) | 0;
                $979 = HEAP32[$978 >> 2] | 0;
                if ((HEAP32[464] | 0) >>> 0 > $979 >>> 0) _abort();
                else {
                  $$0211$i$i = $979;
                  $$pre$phi$i$iZ2D = $978;
                }
              }
              HEAP32[$$pre$phi$i$iZ2D >> 2] = $636;
              HEAP32[($$0211$i$i + 12) >> 2] = $636;
              HEAP32[($636 + 8) >> 2] = $$0211$i$i;
              HEAP32[($636 + 12) >> 2] = $972;
              break;
            }
            $985 = $964 >>> 8;
            if (!$985) $$0212$i$i = 0;
            else if ($964 >>> 0 > 16777215) $$0212$i$i = 31;
            else {
              $990 = ((($985 + 1048320) | 0) >>> 16) & 8;
              $991 = $985 << $990;
              $994 = ((($991 + 520192) | 0) >>> 16) & 4;
              $996 = $991 << $994;
              $999 = ((($996 + 245760) | 0) >>> 16) & 2;
              $1004 = (14 - ($994 | $990 | $999) + (($996 << $999) >>> 15)) | 0;
              $$0212$i$i = (($964 >>> (($1004 + 7) | 0)) & 1) | ($1004 << 1);
            }
            $1010 = (2144 + ($$0212$i$i << 2)) | 0;
            HEAP32[($636 + 28) >> 2] = $$0212$i$i;
            HEAP32[($636 + 20) >> 2] = 0;
            HEAP32[$936 >> 2] = 0;
            $1013 = HEAP32[461] | 0;
            $1014 = 1 << $$0212$i$i;
            if (!($1013 & $1014)) {
              HEAP32[461] = $1013 | $1014;
              HEAP32[$1010 >> 2] = $636;
              HEAP32[($636 + 24) >> 2] = $1010;
              HEAP32[($636 + 12) >> 2] = $636;
              HEAP32[($636 + 8) >> 2] = $636;
              break;
            }
            $$0206$i$i =
              $964 <<
              (($$0212$i$i | 0) == 31 ? 0 : (25 - ($$0212$i$i >>> 1)) | 0);
            $$0207$i$i = HEAP32[$1010 >> 2] | 0;
            while (1) {
              if (((HEAP32[($$0207$i$i + 4) >> 2] & -8) | 0) == ($964 | 0)) {
                label = 289;
                break;
              }
              $1032 = ($$0207$i$i + 16 + (($$0206$i$i >>> 31) << 2)) | 0;
              $1034 = HEAP32[$1032 >> 2] | 0;
              if (!$1034) {
                label = 286;
                break;
              } else {
                $$0206$i$i = $$0206$i$i << 1;
                $$0207$i$i = $1034;
              }
            }
            if ((label | 0) == 286)
              if ((HEAP32[464] | 0) >>> 0 > $1032 >>> 0) _abort();
              else {
                HEAP32[$1032 >> 2] = $636;
                HEAP32[($636 + 24) >> 2] = $$0207$i$i;
                HEAP32[($636 + 12) >> 2] = $636;
                HEAP32[($636 + 8) >> 2] = $636;
                break;
              }
            else if ((label | 0) == 289) {
              $1041 = ($$0207$i$i + 8) | 0;
              $1042 = HEAP32[$1041 >> 2] | 0;
              $1043 = HEAP32[464] | 0;
              if (
                ($1043 >>> 0 <= $1042 >>> 0) &
                ($1043 >>> 0 <= $$0207$i$i >>> 0)
              ) {
                HEAP32[($1042 + 12) >> 2] = $636;
                HEAP32[$1041 >> 2] = $636;
                HEAP32[($636 + 8) >> 2] = $1042;
                HEAP32[($636 + 12) >> 2] = $$0207$i$i;
                HEAP32[($636 + 24) >> 2] = 0;
                break;
              } else _abort();
            }
          }
        }
      } while (0);
      $1052 = HEAP32[463] | 0;
      if ($1052 >>> 0 > $$0197 >>> 0) {
        $1054 = ($1052 - $$0197) | 0;
        HEAP32[463] = $1054;
        $1055 = HEAP32[466] | 0;
        $1056 = ($1055 + $$0197) | 0;
        HEAP32[466] = $1056;
        HEAP32[($1056 + 4) >> 2] = $1054 | 1;
        HEAP32[($1055 + 4) >> 2] = $$0197 | 3;
        $$0 = ($1055 + 8) | 0;
        STACKTOP = sp;
        return $$0 | 0;
      }
    }
    $1062 = ___errno_location() | 0;
    HEAP32[$1062 >> 2] = 12;
    $$0 = 0;
    STACKTOP = sp;
    return $$0 | 0;
  }
  function _start_decoder($0) {
    $0 = $0 | 0;
    var $$09091264 = 0,
      $$09171233 = 0,
      $$0935 = 0,
      $$0935$ph = 0,
      $$0944$lcssa = 0,
      $$09441143 = 0,
      $$09461142 = 0,
      $$0947$lcssa = 0,
      $$09471222 = 0,
      $$0968 = 0,
      $$0971$lcssa = 0,
      $$09711239 = 0,
      $$09741232 = 0,
      $$097811791460 = 0,
      $$0979 = 0,
      $$09811236 = 0,
      $$0983 = 0,
      $$09861250 = 0,
      $$09901192 = 0,
      $$0992$ph = 0,
      $$09951247 = 0,
      $$1009 = 0,
      $$109271215 = 0,
      $$119281218 = 0,
      $$129291171 = 0,
      $$139301176 = 0,
      $$149311183 = 0,
      $$159321160 = 0,
      $$169331158 = 0,
      $$179341162 = 0,
      $$19101255 = 0,
      $$19181240 = 0,
      $$19361197 = 0,
      $$1972 = 0,
      $$198010201025 = 0,
      $$19801021$ph = 0,
      $$1987 = 0,
      $$1987$ = 0,
      $$1987$ph = 0,
      $$29111228 = 0,
      $$29191243 = 0,
      $$29371204 = 0,
      $$2970 = 0,
      $$2976$ph = 0,
      $$34 = 0,
      $$39121223 = 0,
      $$39201251 = 0,
      $$39381175 = 0,
      $$3977 = 0,
      $$49131188 = 0,
      $$49211248 = 0,
      $$493911801459 = 0,
      $$493911801461 = 0,
      $$59141166 = 0,
      $$59221141 = 0,
      $$59401155 = 0,
      $$69151151 = 0,
      $$69231193 = 0,
      $$79161147 = 0,
      $$79241200 = 0,
      $$89251208 = 0,
      $$99261211 = 0,
      $$in = 0,
      $$lcssa = 0,
      $$lcssa1084 = 0,
      $$lcssa1096 = 0,
      $$sink = 0,
      $$sink1003 = 0,
      $$sink26 = 0,
      $1 = 0,
      $103 = 0,
      $104 = 0,
      $105 = 0,
      $112 = 0,
      $113 = 0,
      $115 = 0,
      $117 = 0,
      $118 = 0,
      $119 = 0,
      $122 = 0,
      $125 = 0,
      $127 = 0,
      $130 = 0,
      $132 = 0,
      $133 = 0,
      $137 = 0,
      $139 = 0,
      $145 = 0,
      $152 = 0,
      $160 = 0,
      $165 = 0,
      $169 = 0,
      $170 = 0,
      $174 = 0,
      $175 = 0,
      $178 = 0,
      $185 = 0,
      $187 = 0,
      $190 = 0,
      $192 = 0,
      $197 = 0,
      $2 = 0,
      $202 = 0,
      $205 = 0,
      $206 = 0,
      $207 = 0,
      $210 = 0,
      $215 = 0,
      $216 = 0,
      $217 = 0,
      $221 = 0,
      $227 = 0,
      $228 = 0,
      $235 = 0,
      $240 = 0,
      $242 = 0,
      $243 = 0,
      $247 = 0,
      $248 = 0,
      $250 = 0,
      $251 = 0,
      $254 = 0,
      $255 = 0,
      $257 = 0,
      $258 = 0,
      $261 = 0,
      $262 = 0,
      $265 = 0,
      $268 = 0,
      $270 = 0,
      $274 = 0,
      $281 = 0,
      $286 = 0,
      $287 = 0,
      $293 = 0,
      $298 = 0,
      $3 = 0,
      $30 = 0,
      $300 = 0,
      $301 = 0,
      $305 = 0,
      $308 = 0,
      $309 = 0,
      $318 = 0,
      $32 = 0,
      $332 = 0,
      $335 = 0,
      $338 = 0,
      $346 = 0,
      $35 = 0,
      $352 = 0,
      $358 = 0,
      $365 = 0,
      $366 = 0,
      $368 = 0,
      $369 = 0,
      $37 = 0,
      $373 = 0,
      $376 = 0,
      $379 = 0,
      $38 = 0,
      $381 = 0,
      $384 = 0,
      $387 = 0,
      $39 = 0,
      $390 = 0,
      $393 = 0,
      $396 = 0,
      $398 = 0,
      $4 = 0,
      $40 = 0,
      $401 = 0,
      $403 = 0,
      $409 = 0,
      $410 = 0,
      $412 = 0,
      $415 = 0,
      $418 = 0,
      $42 = 0,
      $426 = 0,
      $429 = 0,
      $430 = 0,
      $433 = 0,
      $44 = 0,
      $445 = 0,
      $455 = 0,
      $457 = 0,
      $459 = 0,
      $460 = 0,
      $465 = 0,
      $466 = 0,
      $468 = 0,
      $473 = 0,
      $479 = 0,
      $483 = 0,
      $490 = 0,
      $499 = 0,
      $500 = 0,
      $501 = 0,
      $503 = 0,
      $518 = 0,
      $521 = 0,
      $525 = 0,
      $526 = 0,
      $528 = 0,
      $529 = 0,
      $535 = 0,
      $536 = 0,
      $541 = 0,
      $542 = 0,
      $543 = 0,
      $548 = 0,
      $55 = 0,
      $552 = 0,
      $553 = 0,
      $554 = 0,
      $556 = 0,
      $56 = 0,
      $560 = 0,
      $563 = 0,
      $573 = 0,
      $576 = 0,
      $577 = 0,
      $583 = 0,
      $587 = 0,
      $589 = 0,
      $595 = 0,
      $608 = 0,
      $609 = 0,
      $617 = 0,
      $619 = 0,
      $624 = 0,
      $625 = 0,
      $626 = 0,
      $627 = 0,
      $632 = 0,
      $640 = 0,
      $65 = 0,
      $659 = 0,
      $660 = 0,
      $662 = 0,
      $663 = 0,
      $669 = 0,
      $670 = 0,
      $675 = 0,
      $676 = 0,
      $683 = 0,
      $687 = 0,
      $696 = 0,
      $699 = 0,
      $705 = 0,
      $706 = 0,
      $707 = 0,
      $71 = 0,
      $710 = 0,
      $719 = 0,
      $721 = 0,
      $722 = 0,
      $723 = 0,
      $729 = 0,
      $742 = 0,
      $743 = 0,
      $744 = 0,
      $758 = 0,
      $759 = 0,
      $765 = 0,
      $768 = 0,
      $769 = 0,
      $77 = 0,
      $771 = 0,
      $772 = 0,
      $773 = 0,
      $78 = 0,
      $788 = 0,
      $789 = 0,
      $793 = 0,
      $794 = 0,
      $795 = 0,
      $797 = 0,
      $80 = 0,
      $81 = 0,
      $815 = 0,
      $818 = 0,
      $819 = 0,
      $821 = 0,
      $822 = 0,
      $824 = 0,
      $827 = 0,
      $833 = 0,
      $838 = 0,
      $846 = 0,
      $855 = 0,
      $857 = 0,
      $858 = 0,
      $859 = 0,
      $860 = 0,
      $861 = 0,
      $87 = 0,
      $88 = 0,
      $89 = 0,
      $9 = 0,
      $99 = 0,
      label = 0,
      sp = 0,
      $$09811236$looptemp = 0,
      $$493911801461$looptemp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 1024) | 0;
    $1 = (sp + 1008) | 0;
    $2 = (sp + 8) | 0;
    $3 = (sp + 4) | 0;
    $4 = sp;
    L1: do {
      if (!(_start_page($0) | 0)) $$34 = 0;
      else {
        $9 = HEAPU8[($0 + 1363) >> 0] | 0;
        if (!($9 & 2)) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if (($9 & 4) | 0) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if (($9 & 1) | 0) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if ((HEAP32[($0 + 1104) >> 2] | 0) != 1) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if ((HEAP8[($0 + 1108) >> 0] | 0) != 30) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if (((_get8($0) | 0) << 24) >> 24 != 1) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if (!(_getn($0, $1, 6) | 0)) {
          _error($0, 10);
          $$34 = 0;
          break;
        }
        if (!(_vorbis_validate($1) | 0)) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if (_get32($0) | 0) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        $30 = _get8($0) | 0;
        $32 = ($0 + 4) | 0;
        HEAP32[$32 >> 2] = $30 & 255;
        if (!(($30 << 24) >> 24)) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if (($30 & 255) > 16) {
          _error($0, 5);
          $$34 = 0;
          break;
        }
        $35 = _get32($0) | 0;
        HEAP32[$0 >> 2] = $35;
        if (!$35) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        _get32($0) | 0;
        _get32($0) | 0;
        _get32($0) | 0;
        $37 = _get8($0) | 0;
        $38 = $37 & 255;
        $39 = $38 & 15;
        $40 = $38 >>> 4;
        $42 = ($0 + 100) | 0;
        HEAP32[$42 >> 2] = 1 << $39;
        $44 = ($0 + 104) | 0;
        HEAP32[$44 >> 2] = 1 << $40;
        if ((($39 + -6) | 0) >>> 0 > 7) {
          _error($0, 20);
          $$34 = 0;
          break;
        }
        if ((((($37 + -96) << 24) >> 24) << 24) >> 24 < 0) {
          _error($0, 20);
          $$34 = 0;
          break;
        }
        if ($39 >>> 0 > $40 >>> 0) {
          _error($0, 20);
          $$34 = 0;
          break;
        }
        if (!((_get8($0) | 0) & 1)) {
          _error($0, 34);
          $$34 = 0;
          break;
        }
        if (!(_start_page($0) | 0)) $$34 = 0;
        else if (!(_start_packet($0) | 0)) $$34 = 0;
        else {
          $55 = ($0 + 1364) | 0;
          do {
            $56 = _next_segment($0) | 0;
            _skip($0, $56);
            HEAP8[$55 >> 0] = 0;
          } while (($56 | 0) != 0);
          if (!(_start_packet($0) | 0)) {
            $$34 = 0;
            break;
          }
          do {
            if (HEAP8[($0 + 36) >> 0] | 0) {
              if (_is_whole_packet_present($0, 1) | 0) break;
              $65 = ($0 + 88) | 0;
              if ((HEAP32[$65 >> 2] | 0) != 21) {
                $$34 = 0;
                break L1;
              }
              HEAP32[$65 >> 2] = 20;
              $$34 = 0;
              break L1;
            }
          } while (0);
          _crc32_init();
          if ((_get8_packet($0) | 0) == 5) $$09091264 = 0;
          else {
            _error($0, 20);
            $$34 = 0;
            break;
          }
          do {
            $71 = (_get8_packet($0) | 0) & 255;
            HEAP8[($1 + $$09091264) >> 0] = $71;
            $$09091264 = ($$09091264 + 1) | 0;
          } while (($$09091264 | 0) != 6);
          if (!(_vorbis_validate($1) | 0)) {
            _error($0, 20);
            $$34 = 0;
            break;
          }
          $77 = ((_get_bits($0, 8) | 0) + 1) | 0;
          $78 = ($0 + 108) | 0;
          HEAP32[$78 >> 2] = $77;
          $80 = _setup_malloc($0, ($77 * 2096) | 0) | 0;
          $81 = ($0 + 112) | 0;
          HEAP32[$81 >> 2] = $80;
          if (!$80) {
            _error($0, 3);
            $$34 = 0;
            break;
          }
          _memset($80 | 0, 0, ((HEAP32[$78 >> 2] | 0) * 2096) | 0) | 0;
          L73: do {
            if ((HEAP32[$78 >> 2] | 0) > 0) {
              $87 = ($0 + 16) | 0;
              $$19101255 = 0;
              L75: while (1) {
                $88 = HEAP32[$81 >> 2] | 0;
                $89 = ($88 + (($$19101255 * 2096) | 0)) | 0;
                if ((((_get_bits($0, 8) | 0) & 255) | 0) != 66) {
                  label = 53;
                  break;
                }
                if ((((_get_bits($0, 8) | 0) & 255) | 0) != 67) {
                  label = 55;
                  break;
                }
                if ((((_get_bits($0, 8) | 0) & 255) | 0) != 86) {
                  label = 57;
                  break;
                }
                $99 = _get_bits($0, 8) | 0;
                $103 = ((_get_bits($0, 8) | 0) << 8) | ($99 & 255);
                HEAP32[$89 >> 2] = $103;
                $104 = _get_bits($0, 8) | 0;
                $105 = _get_bits($0, 8) | 0;
                $112 =
                  (($105 << 8) & 65280) |
                  ($104 & 255) |
                  ((_get_bits($0, 8) | 0) << 16);
                $113 = ($88 + (($$19101255 * 2096) | 0) + 4) | 0;
                HEAP32[$113 >> 2] = $112;
                $115 = (_get_bits($0, 1) | 0) != 0;
                if ($115) $118 = 0;
                else $118 = _get_bits($0, 1) | 0;
                $117 = $118 & 255;
                $119 = ($88 + (($$19101255 * 2096) | 0) + 23) | 0;
                HEAP8[$119 >> 0] = $117;
                $122 = HEAP32[$113 >> 2] | 0;
                if (!(HEAP32[$89 >> 2] | 0))
                  if (!$122) $125 = 0;
                  else {
                    label = 62;
                    break;
                  }
                else $125 = $122;
                if (!(($117 << 24) >> 24)) {
                  $127 = _setup_malloc($0, $125) | 0;
                  HEAP32[($88 + (($$19101255 * 2096) | 0) + 8) >> 2] = $127;
                  $$0979 = $127;
                } else $$0979 = _setup_temp_malloc($0, $125) | 0;
                if (!$$0979) {
                  label = 67;
                  break;
                }
                do {
                  if ($115) {
                    $132 = _get_bits($0, 5) | 0;
                    $133 = HEAP32[$113 >> 2] | 0;
                    if (($133 | 0) > 0) {
                      $$09811236 = 0;
                      $$in = $132;
                      $137 = $133;
                    } else {
                      $$3977 = 0;
                      $165 = $133;
                      break;
                    }
                    while (1) {
                      $$in = ($$in + 1) | 0;
                      $139 =
                        _get_bits($0, _ilog(($137 - $$09811236) | 0) | 0) | 0;
                      $$09811236$looptemp = $$09811236;
                      $$09811236 = ($139 + $$09811236) | 0;
                      if (($$09811236 | 0) > (HEAP32[$113 >> 2] | 0)) {
                        label = 73;
                        break L75;
                      }
                      _memset(
                        ($$0979 + $$09811236$looptemp) | 0,
                        ($$in & 255) | 0,
                        $139 | 0
                      ) | 0;
                      $145 = HEAP32[$113 >> 2] | 0;
                      if (($145 | 0) <= ($$09811236 | 0)) {
                        $$3977 = 0;
                        $165 = $145;
                        break;
                      } else $137 = $145;
                    }
                  } else {
                    $130 = HEAP32[$113 >> 2] | 0;
                    if (($130 | 0) > 0) {
                      $$09171233 = 0;
                      $$09741232 = 0;
                    } else {
                      $$3977 = 0;
                      $165 = $130;
                      break;
                    }
                    while (1) {
                      do {
                        if (!(HEAP8[$119 >> 0] | 0)) label = 76;
                        else {
                          if (_get_bits($0, 1) | 0) {
                            label = 76;
                            break;
                          }
                          HEAP8[($$0979 + $$09171233) >> 0] = -1;
                          $$2976$ph = $$09741232;
                        }
                      } while (0);
                      if ((label | 0) == 76) {
                        label = 0;
                        $152 = ((_get_bits($0, 5) | 0) + 1) | 0;
                        HEAP8[($$0979 + $$09171233) >> 0] = $152;
                        if ((($152 & 255) | 0) == 32) {
                          label = 78;
                          break L75;
                        } else $$2976$ph = ($$09741232 + 1) | 0;
                      }
                      $$09171233 = ($$09171233 + 1) | 0;
                      $160 = HEAP32[$113 >> 2] | 0;
                      if (($$09171233 | 0) >= ($160 | 0)) {
                        $$3977 = $$2976$ph;
                        $165 = $160;
                        break;
                      } else $$09741232 = $$2976$ph;
                    }
                  }
                } while (0);
                do {
                  if (!(HEAP8[$119 >> 0] | 0)) {
                    $$19801021$ph = $$0979;
                    $175 = $165;
                    label = 87;
                  } else {
                    if (($$3977 | 0) >= (($165 >> 2) | 0)) {
                      if (($165 | 0) > (HEAP32[$87 >> 2] | 0))
                        HEAP32[$87 >> 2] = $165;
                      $169 = _setup_malloc($0, $165) | 0;
                      $170 = ($88 + (($$19101255 * 2096) | 0) + 8) | 0;
                      HEAP32[$170 >> 2] = $169;
                      if (!$169) {
                        label = 85;
                        break L75;
                      }
                      _memcpy($169 | 0, $$0979 | 0, HEAP32[$113 >> 2] | 0) | 0;
                      _setup_temp_free($0, $$0979, HEAP32[$113 >> 2] | 0);
                      $174 = HEAP32[$170 >> 2] | 0;
                      HEAP8[$119 >> 0] = 0;
                      $$19801021$ph = $174;
                      $175 = HEAP32[$113 >> 2] | 0;
                      label = 87;
                      break;
                    }
                    $190 = ($88 + (($$19101255 * 2096) | 0) + 2092) | 0;
                    HEAP32[$190 >> 2] = $$3977;
                    if (!$$3977) {
                      $$0968 = 0;
                      $205 = 0;
                      $207 = $165;
                      $857 = 0;
                    } else {
                      $192 = _setup_malloc($0, $$3977) | 0;
                      HEAP32[($88 + (($$19101255 * 2096) | 0) + 8) >> 2] = $192;
                      if (!$192) {
                        label = 94;
                        break L75;
                      }
                      $197 = _setup_temp_malloc($0, HEAP32[$190 >> 2] << 2) | 0;
                      HEAP32[($88 + (($$19101255 * 2096) | 0) + 32) >> 2] =
                        $197;
                      if (!$197) {
                        label = 96;
                        break L75;
                      }
                      $202 = _setup_temp_malloc($0, HEAP32[$190 >> 2] << 2) | 0;
                      if (!$202) {
                        label = 99;
                        break L75;
                      }
                      $$0968 = $202;
                      $205 = HEAP32[$190 >> 2] | 0;
                      $207 = HEAP32[$113 >> 2] | 0;
                      $857 = $202;
                    }
                    $206 = (($205 << 3) + $207) | 0;
                    if ($206 >>> 0 <= (HEAP32[$87 >> 2] | 0) >>> 0) {
                      $$198010201025 = $$0979;
                      $$2970 = $$0968;
                      $210 = $207;
                      $215 = $857;
                      $217 = $190;
                      break;
                    }
                    HEAP32[$87 >> 2] = $206;
                    $$198010201025 = $$0979;
                    $$2970 = $$0968;
                    $210 = $207;
                    $215 = $857;
                    $217 = $190;
                  }
                } while (0);
                if ((label | 0) == 87) {
                  label = 0;
                  if (($175 | 0) > 0) {
                    $$09711239 = 0;
                    $$19181240 = 0;
                    while (1) {
                      $178 = HEAP8[($$19801021$ph + $$19181240) >> 0] | 0;
                      $$1972 =
                        ($$09711239 +
                          ((($178 & 255) > 10) &
                            (($178 << 24) >> 24 != -1) &
                            1)) |
                        0;
                      $$19181240 = ($$19181240 + 1) | 0;
                      if (($$19181240 | 0) >= ($175 | 0)) {
                        $$0971$lcssa = $$1972;
                        break;
                      } else $$09711239 = $$1972;
                    }
                  } else $$0971$lcssa = 0;
                  $185 = ($88 + (($$19101255 * 2096) | 0) + 2092) | 0;
                  HEAP32[$185 >> 2] = $$0971$lcssa;
                  $187 = _setup_malloc($0, $175 << 2) | 0;
                  HEAP32[($88 + (($$19101255 * 2096) | 0) + 32) >> 2] = $187;
                  if (!$187) {
                    label = 91;
                    break;
                  }
                  $$198010201025 = $$19801021$ph;
                  $$2970 = 0;
                  $210 = HEAP32[$113 >> 2] | 0;
                  $215 = 0;
                  $217 = $185;
                }
                if (
                  !(_compute_codewords($89, $$198010201025, $210, $$2970) | 0)
                ) {
                  label = 103;
                  break;
                }
                $216 = HEAP32[$217 >> 2] | 0;
                if ($216 | 0) {
                  $221 = _setup_malloc($0, (($216 << 2) + 4) | 0) | 0;
                  HEAP32[($88 + (($$19101255 * 2096) | 0) + 2084) >> 2] = $221;
                  if (!$221) {
                    label = 108;
                    break;
                  }
                  $227 =
                    _setup_malloc($0, ((HEAP32[$217 >> 2] << 2) + 4) | 0) | 0;
                  $228 = ($88 + (($$19101255 * 2096) | 0) + 2088) | 0;
                  HEAP32[$228 >> 2] = $227;
                  if (!$227) {
                    label = 110;
                    break;
                  }
                  HEAP32[$228 >> 2] = $227 + 4;
                  HEAP32[$227 >> 2] = -1;
                  _compute_sorted_huffman($89, $$198010201025, $$2970);
                }
                if (HEAP8[$119 >> 0] | 0) {
                  _setup_temp_free($0, $215, HEAP32[$217 >> 2] << 2);
                  $235 = ($88 + (($$19101255 * 2096) | 0) + 32) | 0;
                  _setup_temp_free(
                    $0,
                    HEAP32[$235 >> 2] | 0,
                    HEAP32[$217 >> 2] << 2
                  );
                  _setup_temp_free($0, $$198010201025, HEAP32[$113 >> 2] | 0);
                  HEAP32[$235 >> 2] = 0;
                }
                _compute_accelerated_huffman($89);
                $240 = _get_bits($0, 4) | 0;
                $242 = ($88 + (($$19101255 * 2096) | 0) + 21) | 0;
                HEAP8[$242 >> 0] = $240;
                $243 = $240 & 255;
                if ($243 >>> 0 > 2) {
                  label = 115;
                  break;
                }
                if ($243 | 0) {
                  $247 = +_float32_unpack(_get_bits($0, 32) | 0);
                  $248 = ($88 + (($$19101255 * 2096) | 0) + 12) | 0;
                  HEAPF32[$248 >> 2] = $247;
                  $250 = +_float32_unpack(_get_bits($0, 32) | 0);
                  $251 = ($88 + (($$19101255 * 2096) | 0) + 16) | 0;
                  HEAPF32[$251 >> 2] = $250;
                  $254 = ((_get_bits($0, 4) | 0) + 1) & 255;
                  $255 = ($88 + (($$19101255 * 2096) | 0) + 20) | 0;
                  HEAP8[$255 >> 0] = $254;
                  $257 = (_get_bits($0, 1) | 0) & 255;
                  $258 = ($88 + (($$19101255 * 2096) | 0) + 22) | 0;
                  HEAP8[$258 >> 0] = $257;
                  $261 = HEAP32[$113 >> 2] | 0;
                  $262 = HEAP32[$89 >> 2] | 0;
                  if ((HEAP8[$242 >> 0] | 0) == 1)
                    $$sink = _lookup1_values($261, $262) | 0;
                  else $$sink = Math_imul($262, $261) | 0;
                  $265 = ($88 + (($$19101255 * 2096) | 0) + 24) | 0;
                  HEAP32[$265 >> 2] = $$sink;
                  if (!$$sink) {
                    label = 121;
                    break;
                  }
                  $268 = _setup_temp_malloc($0, $$sink << 1) | 0;
                  if (!$268) {
                    label = 124;
                    break;
                  }
                  $270 = HEAP32[$265 >> 2] | 0;
                  if (($270 | 0) > 0) {
                    $$29191243 = 0;
                    while (1) {
                      $274 = _get_bits($0, HEAPU8[$255 >> 0] | 0) | 0;
                      if (($274 | 0) == -1) {
                        label = 126;
                        break L75;
                      }
                      HEAP16[($268 + ($$29191243 << 1)) >> 1] = $274;
                      $$29191243 = ($$29191243 + 1) | 0;
                      $281 = HEAP32[$265 >> 2] | 0;
                      if (($$29191243 | 0) >= ($281 | 0)) {
                        $$lcssa1096 = $281;
                        break;
                      }
                    }
                  } else $$lcssa1096 = $270;
                  do {
                    if ((HEAP8[$242 >> 0] | 0) == 1) {
                      $286 = (HEAP8[$119 >> 0] | 0) != 0;
                      if ($286) {
                        $287 = HEAP32[$217 >> 2] | 0;
                        if (!$287) {
                          $352 = $$lcssa1096;
                          break;
                        } else $$sink1003 = $287;
                      } else $$sink1003 = HEAP32[$113 >> 2] | 0;
                      $293 =
                        _setup_malloc(
                          $0,
                          Math_imul($$sink1003 << 2, HEAP32[$89 >> 2] | 0) | 0
                        ) | 0;
                      HEAP32[($88 + (($$19101255 * 2096) | 0) + 28) >> 2] =
                        $293;
                      if (!$293) {
                        label = 133;
                        break L75;
                      }
                      $298 = HEAP32[($286 ? $217 : $113) >> 2] | 0;
                      if (($298 | 0) > 0) {
                        $300 = ($88 + (($$19101255 * 2096) | 0) + 2088) | 0;
                        $301 = HEAP32[$89 >> 2] | 0;
                        $$09861250 = 0;
                        $$39201251 = 0;
                        while (1) {
                          if ($286)
                            $308 =
                              HEAP32[
                                ((HEAP32[$300 >> 2] | 0) + ($$39201251 << 2)) >>
                                  2
                              ] | 0;
                          else $308 = $$39201251;
                          $305 = Math_imul($301, $$39201251) | 0;
                          $$0935$ph = 0;
                          $$0992$ph = 1;
                          $$1987$ph = $$09861250;
                          L167: while (1) {
                            $$0935 = $$0935$ph;
                            $$1987 = $$1987$ph;
                            while (1) {
                              if (($$0935 | 0) >= ($301 | 0)) break L167;
                              $309 = HEAP32[$265 >> 2] | 0;
                              $318 =
                                $$1987 +
                                (+HEAPF32[$251 >> 2] *
                                  +(
                                    HEAPU16[
                                      ($268 +
                                        (((((($308 >>> 0) / ($$0992$ph >>> 0)) |
                                          0) >>>
                                          0) %
                                          ($309 >>> 0) |
                                          0) <<
                                          1)) >>
                                        1
                                    ] | 0
                                  ) +
                                  +HEAPF32[$248 >> 2]);
                              HEAPF32[($293 + (($305 + $$0935) << 2)) >> 2] =
                                $318;
                              $$1987$ =
                                (HEAP8[$258 >> 0] | 0) == 0 ? $$1987 : $318;
                              $$0935 = ($$0935 + 1) | 0;
                              if (($$0935 | 0) < ($301 | 0)) break;
                              else $$1987 = $$1987$;
                            }
                            if (
                              $$0992$ph >>> 0 >
                              ((4294967295 / ($309 >>> 0)) | 0) >>> 0
                            ) {
                              label = 144;
                              break L75;
                            }
                            $$0935$ph = $$0935;
                            $$0992$ph = Math_imul($309, $$0992$ph) | 0;
                            $$1987$ph = $$1987$;
                          }
                          $$39201251 = ($$39201251 + 1) | 0;
                          if (($$39201251 | 0) >= ($298 | 0)) break;
                          else $$09861250 = $$1987;
                        }
                      }
                      HEAP8[$242 >> 0] = 2;
                      $352 = HEAP32[$265 >> 2] | 0;
                    } else {
                      $332 = _setup_malloc($0, $$lcssa1096 << 2) | 0;
                      HEAP32[($88 + (($$19101255 * 2096) | 0) + 28) >> 2] =
                        $332;
                      $335 = HEAP32[$265 >> 2] | 0;
                      if (!$332) {
                        label = 151;
                        break L75;
                      }
                      if (($335 | 0) <= 0) {
                        $352 = $335;
                        break;
                      }
                      $338 = (HEAP8[$258 >> 0] | 0) == 0;
                      $$09951247 = 0;
                      $$49211248 = 0;
                      while (1) {
                        $346 =
                          $$09951247 +
                          (+HEAPF32[$251 >> 2] *
                            +(HEAPU16[($268 + ($$49211248 << 1)) >> 1] | 0) +
                            +HEAPF32[$248 >> 2]);
                        HEAPF32[($332 + ($$49211248 << 2)) >> 2] = $346;
                        $$49211248 = ($$49211248 + 1) | 0;
                        if (($$49211248 | 0) >= ($335 | 0)) {
                          $352 = $335;
                          break;
                        } else $$09951247 = $338 ? $$09951247 : $346;
                      }
                    }
                  } while (0);
                  _setup_temp_free($0, $268, $352 << 1);
                }
                $$19101255 = ($$19101255 + 1) | 0;
                if (($$19101255 | 0) >= (HEAP32[$78 >> 2] | 0)) break L73;
              }
              switch (label | 0) {
                case 53: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 55: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 57: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 62: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 67: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 73: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 78: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 85: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 91: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 94: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 96: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 99: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 103: {
                  if (HEAP8[$119 >> 0] | 0) _setup_temp_free($0, $215, 0);
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 108: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 110: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 115: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 121: {
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 124: {
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 126: {
                  _setup_temp_free($0, $268, HEAP32[$265 >> 2] << 1);
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 133: {
                  _setup_temp_free($0, $268, HEAP32[$265 >> 2] << 1);
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 144: {
                  _setup_temp_free($0, $268, $309 << 1);
                  _error($0, 20);
                  $$34 = 0;
                  break L1;
                  break;
                }
                case 151: {
                  _setup_temp_free($0, $268, $335 << 1);
                  _error($0, 3);
                  $$34 = 0;
                  break L1;
                  break;
                }
              }
            }
          } while (0);
          $358 = ((_get_bits($0, 6) | 0) + 1) & 255;
          L210: do {
            if ($358 | 0) {
              $$29111228 = 0;
              while (1) {
                $$29111228 = ($$29111228 + 1) | 0;
                if (_get_bits($0, 16) | 0) break;
                if (($$29111228 | 0) >= ($358 | 0)) break L210;
              }
              _error($0, 20);
              $$34 = 0;
              break L1;
            }
          } while (0);
          $365 = ((_get_bits($0, 6) | 0) + 1) | 0;
          $366 = ($0 + 116) | 0;
          HEAP32[$366 >> 2] = $365;
          $368 = _setup_malloc($0, ($365 * 1596) | 0) | 0;
          $369 = ($0 + 248) | 0;
          HEAP32[$369 >> 2] = $368;
          if (!$368) {
            _error($0, 3);
            $$34 = 0;
            break;
          }
          do {
            if ((HEAP32[$366 >> 2] | 0) > 0) {
              $$09471222 = 0;
              $$39121223 = 0;
              L221: while (1) {
                $373 = _get_bits($0, 16) | 0;
                HEAP16[($0 + 120 + ($$39121223 << 1)) >> 1] = $373;
                $376 = $373 & 65535;
                if ($376 >>> 0 > 1) {
                  label = 163;
                  break;
                }
                if (!$376) {
                  label = 165;
                  break;
                }
                $409 = HEAP32[$369 >> 2] | 0;
                $410 = _get_bits($0, 5) | 0;
                $412 = ($409 + (($$39121223 * 1596) | 0)) | 0;
                HEAP8[$412 >> 0] = $410;
                if (($410 & 255) | 0) {
                  $$09901192 = -1;
                  $$69231193 = 0;
                  do {
                    $415 = _get_bits($0, 4) | 0;
                    HEAP8[
                      ($409 + (($$39121223 * 1596) | 0) + 1 + $$69231193) >> 0
                    ] = $415;
                    $418 = $415 & 255;
                    $$09901192 =
                      ($418 | 0) > ($$09901192 | 0) ? $418 : $$09901192;
                    $$69231193 = ($$69231193 + 1) | 0;
                  } while (($$69231193 | 0) < (HEAPU8[$412 >> 0] | 0));
                  $$79241200 = 0;
                  while (1) {
                    $426 = ((_get_bits($0, 3) | 0) + 1) & 255;
                    HEAP8[
                      ($409 + (($$39121223 * 1596) | 0) + 33 + $$79241200) >> 0
                    ] = $426;
                    $429 = (_get_bits($0, 2) | 0) & 255;
                    $430 =
                      ($409 + (($$39121223 * 1596) | 0) + 49 + $$79241200) | 0;
                    HEAP8[$430 >> 0] = $429;
                    if (!(($429 << 24) >> 24)) {
                      $$19361197 = 0;
                      label = 176;
                    } else {
                      $433 = _get_bits($0, 8) | 0;
                      HEAP8[
                        ($409 + (($$39121223 * 1596) | 0) + 65 + $$79241200) >>
                          0
                      ] = $433;
                      if ((($433 & 255) | 0) >= (HEAP32[$78 >> 2] | 0)) {
                        label = 174;
                        break L221;
                      }
                      if ((HEAP8[$430 >> 0] | 0) != 31) {
                        $$19361197 = 0;
                        label = 176;
                      }
                    }
                    if ((label | 0) == 176)
                      while (1) {
                        label = 0;
                        $445 = ((_get_bits($0, 8) | 0) + 65535) | 0;
                        HEAP16[
                          ($409 +
                            (($$39121223 * 1596) | 0) +
                            82 +
                            ($$79241200 << 4) +
                            ($$19361197 << 1)) >>
                            1
                        ] = $445;
                        $$19361197 = ($$19361197 + 1) | 0;
                        if (
                          ((($445 << 16) >> 16) | 0) >=
                          (HEAP32[$78 >> 2] | 0)
                        ) {
                          label = 177;
                          break L221;
                        }
                        if (($$19361197 | 0) >= ((1 << HEAPU8[$430 >> 0]) | 0))
                          break;
                        else label = 176;
                      }
                    if (($$79241200 | 0) < ($$09901192 | 0))
                      $$79241200 = ($$79241200 + 1) | 0;
                    else break;
                  }
                }
                $455 = ((_get_bits($0, 2) | 0) + 1) & 255;
                HEAP8[($409 + (($$39121223 * 1596) | 0) + 1588) >> 0] = $455;
                $457 = _get_bits($0, 4) | 0;
                $459 = ($409 + (($$39121223 * 1596) | 0) + 1589) | 0;
                HEAP8[$459 >> 0] = $457;
                $460 = ($409 + (($$39121223 * 1596) | 0) + 338) | 0;
                HEAP16[$460 >> 1] = 0;
                HEAP16[($409 + (($$39121223 * 1596) | 0) + 340) >> 1] =
                  1 << ($457 & 255);
                $465 = ($409 + (($$39121223 * 1596) | 0) + 1592) | 0;
                HEAP32[$465 >> 2] = 2;
                $466 = HEAP8[$412 >> 0] | 0;
                if (!(($466 << 24) >> 24)) {
                  $499 = 2;
                  label = 181;
                } else {
                  $$89251208 = 0;
                  $858 = 2;
                  $859 = $466;
                  while (1) {
                    $473 =
                      ((HEAPU8[
                        ($409 + (($$39121223 * 1596) | 0) + 1 + $$89251208) >> 0
                      ] |
                        0) +
                        ($409 + (($$39121223 * 1596) | 0) + 33)) |
                      0;
                    if (!(HEAP8[$473 >> 0] | 0)) {
                      $468 = $858;
                      $490 = $859;
                    } else {
                      $$29371204 = 0;
                      do {
                        $479 =
                          (_get_bits($0, HEAPU8[$459 >> 0] | 0) | 0) & 65535;
                        HEAP16[
                          ($409 +
                            (($$39121223 * 1596) | 0) +
                            338 +
                            (HEAP32[$465 >> 2] << 1)) >>
                            1
                        ] = $479;
                        $483 = ((HEAP32[$465 >> 2] | 0) + 1) | 0;
                        HEAP32[$465 >> 2] = $483;
                        $$29371204 = ($$29371204 + 1) | 0;
                      } while (($$29371204 | 0) < (HEAPU8[$473 >> 0] | 0));
                      $468 = $483;
                      $490 = HEAP8[$412 >> 0] | 0;
                    }
                    $$89251208 = ($$89251208 + 1) | 0;
                    if (($$89251208 | 0) >= (($490 & 255) | 0)) break;
                    else {
                      $858 = $468;
                      $859 = $490;
                    }
                  }
                  if (($468 | 0) > 0) {
                    $499 = $468;
                    label = 181;
                  } else $500 = $468;
                }
                if ((label | 0) == 181) {
                  label = 0;
                  $$99261211 = 0;
                  do {
                    HEAP16[($2 + ($$99261211 << 2)) >> 1] =
                      HEAP16[
                        ($409 +
                          (($$39121223 * 1596) | 0) +
                          338 +
                          ($$99261211 << 1)) >>
                          1
                      ] | 0;
                    HEAP16[($2 + ($$99261211 << 2) + 2) >> 1] = $$99261211;
                    $$99261211 = ($$99261211 + 1) | 0;
                  } while (($$99261211 | 0) < ($499 | 0));
                  $500 = $499;
                }
                _qsort($2, $500, 4, 1);
                $501 = HEAP32[$465 >> 2] | 0;
                do {
                  if (($501 | 0) > 0) {
                    $$109271215 = 0;
                    do {
                      HEAP8[
                        ($409 +
                          (($$39121223 * 1596) | 0) +
                          838 +
                          $$109271215) >>
                          0
                      ] = HEAP16[($2 + ($$109271215 << 2) + 2) >> 1];
                      $$109271215 = ($$109271215 + 1) | 0;
                      $503 = HEAP32[$465 >> 2] | 0;
                    } while (($$109271215 | 0) < ($503 | 0));
                    if (($503 | 0) > 2) $$119281218 = 2;
                    else {
                      $$lcssa1084 = $503;
                      break;
                    }
                    do {
                      _neighbors($460, $$119281218, $3, $4);
                      HEAP8[
                        ($409 +
                          (($$39121223 * 1596) | 0) +
                          1088 +
                          ($$119281218 << 1)) >>
                          0
                      ] = HEAP32[$3 >> 2];
                      HEAP8[
                        ($409 +
                          (($$39121223 * 1596) | 0) +
                          1088 +
                          ($$119281218 << 1) +
                          1) >>
                          0
                      ] = HEAP32[$4 >> 2];
                      $$119281218 = ($$119281218 + 1) | 0;
                      $518 = HEAP32[$465 >> 2] | 0;
                    } while (($$119281218 | 0) < ($518 | 0));
                    $$lcssa1084 = $518;
                  } else $$lcssa1084 = $501;
                } while (0);
                $$09471222 =
                  ($$lcssa1084 | 0) > ($$09471222 | 0)
                    ? $$lcssa1084
                    : $$09471222;
                $521 = ($$39121223 + 1) | 0;
                if (($521 | 0) >= (HEAP32[$366 >> 2] | 0)) {
                  label = 193;
                  break;
                } else $$39121223 = $521;
              }
              if ((label | 0) == 163) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 165) {
                $379 = HEAP32[$369 >> 2] | 0;
                $381 = (_get_bits($0, 8) | 0) & 255;
                HEAP8[($379 + (($$39121223 * 1596) | 0)) >> 0] = $381;
                $384 = (_get_bits($0, 16) | 0) & 65535;
                HEAP16[($379 + (($$39121223 * 1596) | 0) + 2) >> 1] = $384;
                $387 = (_get_bits($0, 16) | 0) & 65535;
                HEAP16[($379 + (($$39121223 * 1596) | 0) + 4) >> 1] = $387;
                $390 = (_get_bits($0, 6) | 0) & 255;
                HEAP8[($379 + (($$39121223 * 1596) | 0) + 6) >> 0] = $390;
                $393 = (_get_bits($0, 8) | 0) & 255;
                HEAP8[($379 + (($$39121223 * 1596) | 0) + 7) >> 0] = $393;
                $396 = ((_get_bits($0, 4) | 0) + 1) | 0;
                $398 = ($379 + (($$39121223 * 1596) | 0) + 8) | 0;
                HEAP8[$398 >> 0] = $396;
                if (($396 & 255) | 0) {
                  $401 = ($379 + (($$39121223 * 1596) | 0) + 9) | 0;
                  $$59221141 = 0;
                  do {
                    $403 = (_get_bits($0, 8) | 0) & 255;
                    HEAP8[($401 + $$59221141) >> 0] = $403;
                    $$59221141 = ($$59221141 + 1) | 0;
                  } while (($$59221141 | 0) < (HEAPU8[$398 >> 0] | 0));
                }
                _error($0, 4);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 174) _error($0, 20);
              else if ((label | 0) == 177) _error($0, 20);
              else if ((label | 0) == 193) {
                $$0947$lcssa = $$09471222 << 1;
                break;
              }
              $$34 = 0;
              break L1;
            } else $$0947$lcssa = 0;
          } while (0);
          $525 = ((_get_bits($0, 6) | 0) + 1) | 0;
          $526 = ($0 + 252) | 0;
          HEAP32[$526 >> 2] = $525;
          $528 = _setup_malloc($0, ($525 * 24) | 0) | 0;
          $529 = ($0 + 384) | 0;
          HEAP32[$529 >> 2] = $528;
          if (!$528) {
            _error($0, 3);
            $$34 = 0;
            break;
          }
          _memset($528 | 0, 0, ((HEAP32[$526 >> 2] | 0) * 24) | 0) | 0;
          L276: do {
            if ((HEAP32[$526 >> 2] | 0) > 0) {
              $$49131188 = 0;
              L278: while (1) {
                $535 = HEAP32[$529 >> 2] | 0;
                $536 = _get_bits($0, 16) | 0;
                HEAP16[($0 + 256 + ($$49131188 << 1)) >> 1] = $536;
                if (($536 & 65535) >>> 0 > 2) {
                  label = 199;
                  break;
                }
                $541 = _get_bits($0, 24) | 0;
                $542 = ($535 + (($$49131188 * 24) | 0)) | 0;
                HEAP32[$542 >> 2] = $541;
                $543 = _get_bits($0, 24) | 0;
                HEAP32[($535 + (($$49131188 * 24) | 0) + 4) >> 2] = $543;
                if ($543 >>> 0 < (HEAP32[$542 >> 2] | 0) >>> 0) {
                  label = 201;
                  break;
                }
                $548 = ((_get_bits($0, 24) | 0) + 1) | 0;
                HEAP32[($535 + (($$49131188 * 24) | 0) + 8) >> 2] = $548;
                $552 = ((_get_bits($0, 6) | 0) + 1) & 255;
                $553 = ($535 + (($$49131188 * 24) | 0) + 12) | 0;
                HEAP8[$553 >> 0] = $552;
                $554 = _get_bits($0, 8) | 0;
                $556 = ($535 + (($$49131188 * 24) | 0) + 13) | 0;
                HEAP8[$556 >> 0] = $554;
                if ((($554 & 255) | 0) >= (HEAP32[$78 >> 2] | 0)) {
                  label = 204;
                  break;
                }
                $560 = HEAP8[$553 >> 0] | 0;
                if (!(($560 << 24) >> 24)) $$lcssa = $560 & 255;
                else {
                  $$129291171 = 0;
                  do {
                    $563 = _get_bits($0, 3) | 0;
                    if (!(_get_bits($0, 1) | 0)) $$0983 = 0;
                    else $$0983 = _get_bits($0, 5) | 0;
                    HEAP8[($2 + $$129291171) >> 0] = ($$0983 << 3) + $563;
                    $$129291171 = ($$129291171 + 1) | 0;
                    $573 = HEAPU8[$553 >> 0] | 0;
                  } while (($$129291171 | 0) < ($573 | 0));
                  $$lcssa = $573;
                }
                $576 = _setup_malloc($0, $$lcssa << 4) | 0;
                $577 = ($535 + (($$49131188 * 24) | 0) + 20) | 0;
                HEAP32[$577 >> 2] = $576;
                if (!$576) {
                  label = 211;
                  break;
                }
                if (HEAP8[$553 >> 0] | 0) {
                  $$139301176 = 0;
                  $860 = $576;
                  while (1) {
                    $583 = HEAPU8[($2 + $$139301176) >> 0] | 0;
                    $$39381175 = 0;
                    $595 = $860;
                    while (1) {
                      if (!((1 << $$39381175) & $583)) {
                        HEAP16[
                          ($595 + ($$139301176 << 4) + ($$39381175 << 1)) >> 1
                        ] = -1;
                        $861 = $595;
                      } else {
                        $587 = _get_bits($0, 8) | 0;
                        $589 = HEAP32[$577 >> 2] | 0;
                        HEAP16[
                          ($589 + ($$139301176 << 4) + ($$39381175 << 1)) >> 1
                        ] = $587;
                        if ((HEAP32[$78 >> 2] | 0) > ((($587 << 16) >> 16) | 0))
                          $861 = $589;
                        else {
                          label = 215;
                          break L278;
                        }
                      }
                      if (($$39381175 | 0) < 7) {
                        $$39381175 = ($$39381175 + 1) | 0;
                        $595 = $861;
                      } else break;
                    }
                    $$139301176 = ($$139301176 + 1) | 0;
                    if (($$139301176 | 0) >= (HEAPU8[$553 >> 0] | 0)) break;
                    else $860 = $861;
                  }
                }
                $608 =
                  _setup_malloc(
                    $0,
                    HEAP32[
                      ((HEAP32[$81 >> 2] | 0) +
                        (((HEAPU8[$556 >> 0] | 0) * 2096) | 0) +
                        4) >>
                        2
                    ] << 2
                  ) | 0;
                $609 = ($535 + (($$49131188 * 24) | 0) + 16) | 0;
                HEAP32[$609 >> 2] = $608;
                if (!$608) {
                  label = 220;
                  break;
                }
                _memset(
                  $608 | 0,
                  0,
                  (HEAP32[
                    ((HEAP32[$81 >> 2] | 0) +
                      (((HEAPU8[$556 >> 0] | 0) * 2096) | 0) +
                      4) >>
                      2
                  ] <<
                    2) |
                    0
                ) | 0;
                $617 = HEAP32[$81 >> 2] | 0;
                $619 = HEAPU8[$556 >> 0] | 0;
                if ((HEAP32[($617 + (($619 * 2096) | 0) + 4) >> 2] | 0) > 0) {
                  $$149311183 = 0;
                  $624 = $617;
                  $625 = $619;
                  do {
                    $626 = HEAP32[($624 + (($625 * 2096) | 0)) >> 2] | 0;
                    $627 = _setup_malloc($0, $626) | 0;
                    HEAP32[
                      ((HEAP32[$609 >> 2] | 0) + ($$149311183 << 2)) >> 2
                    ] = $627;
                    $632 =
                      HEAP32[
                        ((HEAP32[$609 >> 2] | 0) + ($$149311183 << 2)) >> 2
                      ] | 0;
                    if (!$632) {
                      label = 226;
                      break L278;
                    }
                    do {
                      if (($626 | 0) > 0) {
                        $$493911801459 = ($626 + -1) | 0;
                        HEAP8[($632 + $$493911801459) >> 0] =
                          ($$149311183 | 0) % (HEAPU8[$553 >> 0] | 0) | 0;
                        if (($626 | 0) == 1) break;
                        else {
                          $$097811791460 = $$149311183;
                          $$493911801461 = $$493911801459;
                        }
                        do {
                          $640 = HEAP8[$553 >> 0] | 0;
                          $$097811791460 =
                            (($$097811791460 | 0) / (($640 & 255) | 0)) | 0;
                          $$493911801461$looptemp = $$493911801461;
                          $$493911801461 = ($$493911801461 + -1) | 0;
                          HEAP8[
                            ((HEAP32[
                              ((HEAP32[$609 >> 2] | 0) + ($$149311183 << 2)) >>
                                2
                            ] |
                              0) +
                              $$493911801461) >>
                              0
                          ] = ($$097811791460 | 0) % (($640 & 255) | 0) | 0;
                        } while (($$493911801461$looptemp | 0) > 1);
                      }
                    } while (0);
                    $$149311183 = ($$149311183 + 1) | 0;
                    $624 = HEAP32[$81 >> 2] | 0;
                    $625 = HEAPU8[$556 >> 0] | 0;
                  } while (
                    ($$149311183 | 0) <
                    (HEAP32[($624 + (($625 * 2096) | 0) + 4) >> 2] | 0)
                  );
                }
                $$49131188 = ($$49131188 + 1) | 0;
                if (($$49131188 | 0) >= (HEAP32[$526 >> 2] | 0)) break L276;
              }
              if ((label | 0) == 199) _error($0, 20);
              else if ((label | 0) == 201) _error($0, 20);
              else if ((label | 0) == 204) _error($0, 20);
              else if ((label | 0) == 211) _error($0, 3);
              else if ((label | 0) == 215) _error($0, 20);
              else if ((label | 0) == 220) _error($0, 3);
              else if ((label | 0) == 226) _error($0, 3);
              $$34 = 0;
              break L1;
            }
          } while (0);
          $659 = ((_get_bits($0, 6) | 0) + 1) | 0;
          $660 = ($0 + 388) | 0;
          HEAP32[$660 >> 2] = $659;
          $662 = _setup_malloc($0, ($659 * 40) | 0) | 0;
          $663 = ($0 + 392) | 0;
          HEAP32[$663 >> 2] = $662;
          if (!$662) {
            _error($0, 3);
            $$34 = 0;
            break;
          }
          _memset($662 | 0, 0, ((HEAP32[$660 >> 2] | 0) * 40) | 0) | 0;
          L327: do {
            if ((HEAP32[$660 >> 2] | 0) > 0) {
              $$59141166 = 0;
              L328: while (1) {
                $669 = HEAP32[$663 >> 2] | 0;
                $670 = ($669 + (($$59141166 * 40) | 0)) | 0;
                if (_get_bits($0, 16) | 0) {
                  label = 234;
                  break;
                }
                $675 = _setup_malloc($0, ((HEAP32[$32 >> 2] | 0) * 3) | 0) | 0;
                $676 = ($669 + (($$59141166 * 40) | 0) + 4) | 0;
                HEAP32[$676 >> 2] = $675;
                if (!$675) {
                  label = 236;
                  break;
                }
                if (!(_get_bits($0, 1) | 0)) $$sink26 = 1;
                else $$sink26 = ((_get_bits($0, 4) | 0) + 1) & 255;
                $683 = ($669 + (($$59141166 * 40) | 0) + 8) | 0;
                HEAP8[$683 >> 0] = $$sink26;
                do {
                  if (!(_get_bits($0, 1) | 0)) HEAP16[$670 >> 1] = 0;
                  else {
                    $687 = ((_get_bits($0, 8) | 0) + 1) | 0;
                    HEAP16[$670 >> 1] = $687;
                    if (!($687 & 65535)) break;
                    $$59401155 = 0;
                    $696 = HEAP32[$32 >> 2] | 0;
                    do {
                      $699 =
                        (_get_bits($0, _ilog(($696 + -1) | 0) | 0) | 0) & 255;
                      HEAP8[
                        ((HEAP32[$676 >> 2] | 0) + (($$59401155 * 3) | 0)) >> 0
                      ] = $699;
                      $705 =
                        _get_bits(
                          $0,
                          _ilog(((HEAP32[$32 >> 2] | 0) + -1) | 0) | 0
                        ) | 0;
                      $706 = $705 & 255;
                      $707 = HEAP32[$676 >> 2] | 0;
                      HEAP8[($707 + (($$59401155 * 3) | 0) + 1) >> 0] = $706;
                      $710 = HEAP8[($707 + (($$59401155 * 3) | 0)) >> 0] | 0;
                      $696 = HEAP32[$32 >> 2] | 0;
                      if (($696 | 0) <= (($710 & 255) | 0)) {
                        label = 244;
                        break L328;
                      }
                      if (($696 | 0) <= (($705 & 255) | 0)) {
                        label = 246;
                        break L328;
                      }
                      $$59401155 = ($$59401155 + 1) | 0;
                      if (($710 << 24) >> 24 == ($706 << 24) >> 24) {
                        label = 248;
                        break L328;
                      }
                    } while (($$59401155 | 0) < (HEAPU16[$670 >> 1] | 0));
                  }
                } while (0);
                if (_get_bits($0, 2) | 0) {
                  label = 251;
                  break;
                }
                $719 = HEAP8[$683 >> 0] | 0;
                $721 = HEAP32[$32 >> 2] | 0;
                $722 = ($721 | 0) > 0;
                do {
                  if (($719 & 255) > 1) {
                    if ($722) $$159321160 = 0;
                    else {
                      $$179341162 = 0;
                      label = 262;
                      break;
                    }
                    while (1) {
                      $729 = (_get_bits($0, 4) | 0) & 255;
                      HEAP8[
                        ((HEAP32[$676 >> 2] | 0) +
                          (($$159321160 * 3) | 0) +
                          2) >>
                          0
                      ] = $729;
                      $$159321160 = ($$159321160 + 1) | 0;
                      if ((HEAPU8[$683 >> 0] | 0) <= ($729 & 255)) {
                        label = 259;
                        break L328;
                      }
                      if (($$159321160 | 0) >= (HEAP32[$32 >> 2] | 0)) {
                        $$179341162 = 0;
                        label = 262;
                        break;
                      }
                    }
                  } else {
                    if ($722) {
                      $723 = HEAP32[$676 >> 2] | 0;
                      $$169331158 = 0;
                      do {
                        HEAP8[($723 + (($$169331158 * 3) | 0) + 2) >> 0] = 0;
                        $$169331158 = ($$169331158 + 1) | 0;
                      } while (($$169331158 | 0) < ($721 | 0));
                    }
                    if (($719 << 24) >> 24) {
                      $$179341162 = 0;
                      label = 262;
                    }
                  }
                } while (0);
                if ((label | 0) == 262)
                  while (1) {
                    label = 0;
                    _get_bits($0, 8) | 0;
                    $742 = (_get_bits($0, 8) | 0) & 255;
                    $743 =
                      ($669 + (($$59141166 * 40) | 0) + 9 + $$179341162) | 0;
                    HEAP8[$743 >> 0] = $742;
                    $744 = _get_bits($0, 8) | 0;
                    HEAP8[
                      ($669 + (($$59141166 * 40) | 0) + 24 + $$179341162) >> 0
                    ] = $744;
                    if ((HEAP32[$366 >> 2] | 0) <= (HEAPU8[$743 >> 0] | 0)) {
                      label = 263;
                      break L328;
                    }
                    $$179341162 = ($$179341162 + 1) | 0;
                    if ((($744 & 255) | 0) >= (HEAP32[$526 >> 2] | 0)) {
                      label = 265;
                      break L328;
                    }
                    if (($$179341162 | 0) >= (HEAPU8[$683 >> 0] | 0)) break;
                    else label = 262;
                  }
                $$59141166 = ($$59141166 + 1) | 0;
                if (($$59141166 | 0) >= (HEAP32[$660 >> 2] | 0)) break L327;
              }
              if ((label | 0) == 234) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 236) {
                _error($0, 3);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 244) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 246) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 248) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 251) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 259) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 263) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 265) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              }
            }
          } while (0);
          $758 = ((_get_bits($0, 6) | 0) + 1) | 0;
          $759 = ($0 + 396) | 0;
          HEAP32[$759 >> 2] = $758;
          L374: do {
            if (($758 | 0) > 0) {
              $$69151151 = 0;
              while (1) {
                $765 = (_get_bits($0, 1) | 0) & 255;
                HEAP8[($0 + 400 + (($$69151151 * 6) | 0)) >> 0] = $765;
                $768 = (_get_bits($0, 16) | 0) & 65535;
                $769 = ($0 + 400 + (($$69151151 * 6) | 0) + 2) | 0;
                HEAP16[$769 >> 1] = $768;
                $771 = (_get_bits($0, 16) | 0) & 65535;
                $772 = ($0 + 400 + (($$69151151 * 6) | 0) + 4) | 0;
                HEAP16[$772 >> 1] = $771;
                $773 = _get_bits($0, 8) | 0;
                HEAP8[($0 + 400 + (($$69151151 * 6) | 0) + 1) >> 0] = $773;
                if (HEAP16[$769 >> 1] | 0) {
                  label = 270;
                  break;
                }
                if (HEAP16[$772 >> 1] | 0) {
                  label = 272;
                  break;
                }
                $$69151151 = ($$69151151 + 1) | 0;
                if ((($773 & 255) | 0) >= (HEAP32[$660 >> 2] | 0)) {
                  label = 274;
                  break;
                }
                if (($$69151151 | 0) >= (HEAP32[$759 >> 2] | 0)) break L374;
              }
              if ((label | 0) == 270) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 272) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              } else if ((label | 0) == 274) {
                _error($0, 20);
                $$34 = 0;
                break L1;
              }
            }
          } while (0);
          _flush_packet($0);
          HEAP32[($0 + 980) >> 2] = 0;
          L385: do {
            if ((HEAP32[$32 >> 2] | 0) > 0) {
              $$79161147 = 0;
              while (1) {
                $788 = _setup_malloc($0, HEAP32[$44 >> 2] << 2) | 0;
                $789 = ($0 + 788 + ($$79161147 << 2)) | 0;
                HEAP32[$789 >> 2] = $788;
                $793 =
                  _setup_malloc($0, (HEAP32[$44 >> 2] << 1) & 2147483646) | 0;
                $794 = ($0 + 916 + ($$79161147 << 2)) | 0;
                HEAP32[$794 >> 2] = $793;
                $795 = _setup_malloc($0, $$0947$lcssa) | 0;
                HEAP32[($0 + 984 + ($$79161147 << 2)) >> 2] = $795;
                $797 = HEAP32[$789 >> 2] | 0;
                if (!$797) break;
                if ((($795 | 0) == 0) | ((HEAP32[$794 >> 2] | 0) == 0)) break;
                _memset($797 | 0, 0, (HEAP32[$44 >> 2] << 2) | 0) | 0;
                $$79161147 = ($$79161147 + 1) | 0;
                if (($$79161147 | 0) >= (HEAP32[$32 >> 2] | 0)) break L385;
              }
              _error($0, 3);
              $$34 = 0;
              break L1;
            }
          } while (0);
          if (!(_init_blocksize($0, 0, HEAP32[$42 >> 2] | 0) | 0)) {
            $$34 = 0;
            break;
          }
          if (!(_init_blocksize($0, 1, HEAP32[$44 >> 2] | 0) | 0)) {
            $$34 = 0;
            break;
          }
          HEAP32[($0 + 92) >> 2] = HEAP32[$42 >> 2];
          $815 = HEAP32[$44 >> 2] | 0;
          HEAP32[($0 + 96) >> 2] = $815;
          $818 = ($815 << 1) & 2147483646;
          $819 = HEAP32[$526 >> 2] | 0;
          if (($819 | 0) > 0) {
            $821 = HEAP32[$529 >> 2] | 0;
            $822 = (($815 | 0) / 2) | 0;
            $$09441143 = 0;
            $$09461142 = 0;
            do {
              $824 = HEAP32[($821 + (($$09461142 * 24) | 0)) >> 2] | 0;
              $827 = HEAP32[($821 + (($$09461142 * 24) | 0) + 4) >> 2] | 0;
              $833 =
                ((((($827 >>> 0 < $822 >>> 0 ? $827 : $822) -
                  ($824 >>> 0 < $822 >>> 0 ? $824 : $822)) |
                  0) >>>
                  0) /
                  ((HEAP32[($821 + (($$09461142 * 24) | 0) + 8) >> 2] | 0) >>>
                    0)) |
                0;
              $$09441143 = ($833 | 0) > ($$09441143 | 0) ? $833 : $$09441143;
              $$09461142 = ($$09461142 + 1) | 0;
            } while (($$09461142 | 0) < ($819 | 0));
            $$0944$lcssa = (($$09441143 << 2) + 4) | 0;
          } else $$0944$lcssa = 4;
          $838 = Math_imul(HEAP32[$32 >> 2] | 0, $$0944$lcssa) | 0;
          $$1009 = $818 >>> 0 > $838 >>> 0 ? $818 : $838;
          HEAP32[($0 + 12) >> 2] = $$1009;
          HEAP8[($0 + 1365) >> 0] = 1;
          do {
            if (HEAP32[($0 + 68) >> 2] | 0) {
              $846 = HEAP32[($0 + 80) >> 2] | 0;
              if (($846 | 0) != (HEAP32[($0 + 72) >> 2] | 0))
                ___assert_fail(1460, 1052, 4111, 1516);
              if (
                (((HEAP32[($0 + 76) >> 2] | 0) + 1500 + $$1009) | 0) >>> 0 <=
                $846 >>> 0
              )
                break;
              _error($0, 3);
              $$34 = 0;
              break L1;
            }
          } while (0);
          $855 = _stb_vorbis_get_file_offset($0) | 0;
          HEAP32[($0 + 40) >> 2] = $855;
          $$34 = 1;
        }
      }
    } while (0);
    STACKTOP = sp;
    return $$34 | 0;
  }
  function _decode_residue($0, $1, $2, $3, $4, $5) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    var $$0450$lcssa = 0,
      $$0450604 = 0,
      $$0453600 = 0,
      $$0455588 = 0,
      $$0460586 = 0,
      $$0481622 = 0,
      $$0482621 = 0,
      $$0627 = 0,
      $$1451610 = 0,
      $$1454625 = 0,
      $$1456$lcssa = 0,
      $$1456581 = 0,
      $$1467 = 0,
      $$1479 = 0,
      $$1483$lcssa = 0,
      $$1483617 = 0,
      $$1485 = 0,
      $$1488 = 0,
      $$1582 = 0,
      $$2452613 = 0,
      $$2462576 = 0,
      $$2468 = 0,
      $$2480 = 0,
      $$2486 = 0,
      $$2489 = 0,
      $$2575 = 0,
      $$3458578 = 0,
      $$3592 = 0,
      $$4459$lcssa = 0,
      $$4459574 = 0,
      $$4464596 = 0,
      $$4619 = 0,
      $$6598 = 0,
      $$7$lcssa = 0,
      $$7591 = 0,
      $102 = 0,
      $105 = 0,
      $106 = 0,
      $11 = 0,
      $12 = 0,
      $122 = 0,
      $13 = 0,
      $131 = 0,
      $141 = 0,
      $145 = 0,
      $153 = 0,
      $154 = 0,
      $156 = 0,
      $16 = 0,
      $160 = 0,
      $163 = 0,
      $164 = 0,
      $170 = 0,
      $173 = 0,
      $174 = 0,
      $19 = 0,
      $190 = 0,
      $199 = 0,
      $20 = 0,
      $209 = 0,
      $211 = 0,
      $219 = 0,
      $22 = 0,
      $222 = 0,
      $224 = 0,
      $228 = 0,
      $23 = 0,
      $231 = 0,
      $232 = 0,
      $238 = 0,
      $24 = 0,
      $241 = 0,
      $242 = 0,
      $258 = 0,
      $267 = 0,
      $27 = 0,
      $277 = 0,
      $281 = 0,
      $293 = 0,
      $295 = 0,
      $299 = 0,
      $302 = 0,
      $303 = 0,
      $309 = 0,
      $31 = 0,
      $312 = 0,
      $313 = 0,
      $33 = 0,
      $34 = 0,
      $343 = 0,
      $349 = 0,
      $35 = 0,
      $351 = 0,
      $359 = 0,
      $39 = 0,
      $40 = 0,
      $41 = 0,
      $43 = 0,
      $44 = 0,
      $45 = 0,
      $46 = 0,
      $47 = 0,
      $49 = 0,
      $50 = 0,
      $58 = 0,
      $59 = 0,
      $6 = 0,
      $60 = 0,
      $61 = 0,
      $62 = 0,
      $63 = 0,
      $64 = 0,
      $68 = 0,
      $7 = 0,
      $71 = 0,
      $72 = 0,
      $73 = 0,
      $74 = 0,
      $75 = 0,
      $76 = 0,
      $77 = 0,
      $78 = 0,
      $79 = 0,
      $83 = 0,
      $86 = 0,
      $88 = 0,
      $9 = 0,
      $92 = 0,
      $95 = 0,
      $96 = 0,
      $brmerge = 0,
      label = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 16) | 0;
    $6 = (sp + 4) | 0;
    $7 = sp;
    $9 = HEAP32[($0 + 384) >> 2] | 0;
    $11 = HEAP16[($0 + 256 + ($4 << 1)) >> 1] | 0;
    $12 = $11 & 65535;
    $13 = ($9 + (($4 * 24) | 0) + 13) | 0;
    $16 = ($0 + 112) | 0;
    $19 =
      HEAP32[
        ((HEAP32[$16 >> 2] | 0) + (((HEAPU8[$13 >> 0] | 0) * 2096) | 0)) >> 2
      ] | 0;
    $20 = ($11 << 16) >> 16 == 2;
    $22 = $3 << ($20 & 1);
    $23 = ($9 + (($4 * 24) | 0)) | 0;
    $24 = HEAP32[$23 >> 2] | 0;
    $27 = HEAP32[($9 + (($4 * 24) | 0) + 4) >> 2] | 0;
    $31 = ($9 + (($4 * 24) | 0) + 8) | 0;
    $33 =
      ((((($27 >>> 0 < $22 >>> 0 ? $27 : $22) -
        ($24 >>> 0 < $22 >>> 0 ? $24 : $22)) |
        0) >>>
        0) /
        ((HEAP32[$31 >> 2] | 0) >>> 0)) |
      0;
    $34 = ($0 + 80) | 0;
    $35 = HEAP32[$34 >> 2] | 0;
    $39 = ($0 + 4) | 0;
    $40 = HEAP32[$39 >> 2] | 0;
    $41 = $33 << 2;
    $43 = Math_imul($40, ($41 + 4) | 0) | 0;
    if (!(HEAP32[($0 + 68) >> 2] | 0)) {
      $45 = STACKTOP;
      STACKTOP = (STACKTOP + ((((1 * $43) | 0) + 15) & -16)) | 0;
      $46 = $45;
      $47 = $40;
    } else {
      $44 = _setup_temp_malloc($0, $43) | 0;
      $46 = $44;
      $47 = HEAP32[$39 >> 2] | 0;
    }
    _make_block_array($46, $47, $41) | 0;
    $49 = ($2 | 0) > 0;
    if ($49) {
      $50 = $3 << 2;
      $$0627 = 0;
      do {
        if (!(HEAP8[($5 + $$0627) >> 0] | 0))
          _memset(HEAP32[($1 + ($$0627 << 2)) >> 2] | 0, 0, $50 | 0) | 0;
        $$0627 = ($$0627 + 1) | 0;
      } while (($$0627 | 0) != ($2 | 0));
    }
    L13: do {
      if ((($2 | 0) != 1) & $20) {
        L15: do {
          if ($49) {
            $$0450604 = 0;
            while (1) {
              if (!(HEAP8[($5 + $$0450604) >> 0] | 0)) {
                $$0450$lcssa = $$0450604;
                break L15;
              }
              $68 = ($$0450604 + 1) | 0;
              if (($68 | 0) < ($2 | 0)) $$0450604 = $68;
              else {
                $$0450$lcssa = $68;
                break;
              }
            }
          } else $$0450$lcssa = 0;
        } while (0);
        if (($$0450$lcssa | 0) != ($2 | 0)) {
          $71 = ($33 | 0) > 0;
          $72 = ($0 + 1384) | 0;
          $73 = ($0 + 1380) | 0;
          $74 = ($9 + (($4 * 24) | 0) + 16) | 0;
          $75 = ($19 | 0) > 0;
          $76 = ($9 + (($4 * 24) | 0) + 20) | 0;
          $$0453600 = 0;
          L21: while (1) {
            switch ($2 | 0) {
              case 2: {
                if ($71) {
                  $78 = ($$0453600 | 0) == 0;
                  $$0455588 = 0;
                  $$0460586 = 0;
                  while (1) {
                    $83 =
                      ((Math_imul(HEAP32[$31 >> 2] | 0, $$0455588) | 0) +
                        (HEAP32[$23 >> 2] | 0)) |
                      0;
                    HEAP32[$6 >> 2] = $83 & 1;
                    HEAP32[$7 >> 2] = $83 >> 1;
                    if ($78) {
                      $86 = HEAP32[$16 >> 2] | 0;
                      $88 = HEAPU8[$13 >> 0] | 0;
                      if ((HEAP32[$72 >> 2] | 0) < 10) _prep_huffman($0);
                      $92 = HEAP32[$73 >> 2] | 0;
                      $95 =
                        HEAP16[
                          ($86 +
                            (($88 * 2096) | 0) +
                            36 +
                            (($92 & 1023) << 1)) >>
                            1
                        ] | 0;
                      $96 = ($95 << 16) >> 16;
                      if (($95 << 16) >> 16 > -1) {
                        $102 =
                          HEAPU8[
                            ((HEAP32[($86 + (($88 * 2096) | 0) + 8) >> 2] | 0) +
                              $96) >>
                              0
                          ] | 0;
                        HEAP32[$73 >> 2] = $92 >>> $102;
                        $105 = ((HEAP32[$72 >> 2] | 0) - $102) | 0;
                        $106 = ($105 | 0) < 0;
                        HEAP32[$72 >> 2] = $106 ? 0 : $105;
                        $$1467 = $106 ? -1 : $96;
                      } else
                        $$1467 =
                          _codebook_decode_scalar_raw(
                            $0,
                            ($86 + (($88 * 2096) | 0)) | 0
                          ) | 0;
                      if (!(HEAP8[($86 + (($88 * 2096) | 0) + 23) >> 0] | 0))
                        $$2468 = $$1467;
                      else
                        $$2468 =
                          HEAP32[
                            ((HEAP32[($86 + (($88 * 2096) | 0) + 2088) >> 2] |
                              0) +
                              ($$1467 << 2)) >>
                              2
                          ] | 0;
                      if (($$2468 | 0) == -1) {
                        label = 38;
                        break L21;
                      }
                      HEAP32[((HEAP32[$46 >> 2] | 0) + ($$0460586 << 2)) >> 2] =
                        HEAP32[((HEAP32[$74 >> 2] | 0) + ($$2468 << 2)) >> 2];
                    }
                    if ((($$0455588 | 0) < ($33 | 0)) & $75) {
                      $$1456581 = $$0455588;
                      $$1582 = 0;
                      while (1) {
                        $122 = HEAP32[$31 >> 2] | 0;
                        $131 =
                          HEAP16[
                            ((HEAP32[$76 >> 2] | 0) +
                              (HEAPU8[
                                ((HEAP32[
                                  ((HEAP32[$46 >> 2] | 0) + ($$0460586 << 2)) >>
                                    2
                                ] |
                                  0) +
                                  $$1582) >>
                                  0
                              ] <<
                                4) +
                              ($$0453600 << 1)) >>
                              1
                          ] | 0;
                        if (($131 << 16) >> 16 > -1) {
                          if (
                            !(
                              _codebook_decode_deinterleave_repeat(
                                $0,
                                ((HEAP32[$16 >> 2] | 0) +
                                  (((($131 << 16) >> 16) * 2096) | 0)) |
                                  0,
                                $1,
                                2,
                                $6,
                                $7,
                                $3,
                                $122
                              ) | 0
                            )
                          ) {
                            label = 38;
                            break L21;
                          }
                        } else {
                          $141 =
                            ((Math_imul($122, $$1456581) | 0) +
                              $122 +
                              (HEAP32[$23 >> 2] | 0)) |
                            0;
                          HEAP32[$6 >> 2] = $141 & 1;
                          HEAP32[$7 >> 2] = $141 >> 1;
                        }
                        $$1582 = ($$1582 + 1) | 0;
                        $145 = ($$1456581 + 1) | 0;
                        if (
                          !(
                            (($145 | 0) < ($33 | 0)) &
                            (($$1582 | 0) < ($19 | 0))
                          )
                        ) {
                          $$1456$lcssa = $145;
                          break;
                        } else $$1456581 = $145;
                      }
                    } else $$1456$lcssa = $$0455588;
                    if (($$1456$lcssa | 0) < ($33 | 0)) {
                      $$0455588 = $$1456$lcssa;
                      $$0460586 = ($$0460586 + 1) | 0;
                    } else break;
                  }
                }
                break;
              }
              case 1: {
                if ($71) {
                  $77 = ($$0453600 | 0) == 0;
                  $$2462576 = 0;
                  $$3458578 = 0;
                  while (1) {
                    $153 =
                      ((Math_imul(HEAP32[$31 >> 2] | 0, $$3458578) | 0) +
                        (HEAP32[$23 >> 2] | 0)) |
                      0;
                    HEAP32[$6 >> 2] = 0;
                    HEAP32[$7 >> 2] = $153;
                    if ($77) {
                      $154 = HEAP32[$16 >> 2] | 0;
                      $156 = HEAPU8[$13 >> 0] | 0;
                      if ((HEAP32[$72 >> 2] | 0) < 10) _prep_huffman($0);
                      $160 = HEAP32[$73 >> 2] | 0;
                      $163 =
                        HEAP16[
                          ($154 +
                            (($156 * 2096) | 0) +
                            36 +
                            (($160 & 1023) << 1)) >>
                            1
                        ] | 0;
                      $164 = ($163 << 16) >> 16;
                      if (($163 << 16) >> 16 > -1) {
                        $170 =
                          HEAPU8[
                            ((HEAP32[($154 + (($156 * 2096) | 0) + 8) >> 2] |
                              0) +
                              $164) >>
                              0
                          ] | 0;
                        HEAP32[$73 >> 2] = $160 >>> $170;
                        $173 = ((HEAP32[$72 >> 2] | 0) - $170) | 0;
                        $174 = ($173 | 0) < 0;
                        HEAP32[$72 >> 2] = $174 ? 0 : $173;
                        $$1485 = $174 ? -1 : $164;
                      } else
                        $$1485 =
                          _codebook_decode_scalar_raw(
                            $0,
                            ($154 + (($156 * 2096) | 0)) | 0
                          ) | 0;
                      if (!(HEAP8[($154 + (($156 * 2096) | 0) + 23) >> 0] | 0))
                        $$2486 = $$1485;
                      else
                        $$2486 =
                          HEAP32[
                            ((HEAP32[($154 + (($156 * 2096) | 0) + 2088) >> 2] |
                              0) +
                              ($$1485 << 2)) >>
                              2
                          ] | 0;
                      if (($$2486 | 0) == -1) {
                        label = 55;
                        break L21;
                      }
                      HEAP32[((HEAP32[$46 >> 2] | 0) + ($$2462576 << 2)) >> 2] =
                        HEAP32[((HEAP32[$74 >> 2] | 0) + ($$2486 << 2)) >> 2];
                    }
                    if ((($$3458578 | 0) < ($33 | 0)) & $75) {
                      $$2575 = 0;
                      $$4459574 = $$3458578;
                      while (1) {
                        $190 = HEAP32[$31 >> 2] | 0;
                        $199 =
                          HEAP16[
                            ((HEAP32[$76 >> 2] | 0) +
                              (HEAPU8[
                                ((HEAP32[
                                  ((HEAP32[$46 >> 2] | 0) + ($$2462576 << 2)) >>
                                    2
                                ] |
                                  0) +
                                  $$2575) >>
                                  0
                              ] <<
                                4) +
                              ($$0453600 << 1)) >>
                              1
                          ] | 0;
                        if (($199 << 16) >> 16 > -1) {
                          if (
                            !(
                              _codebook_decode_deinterleave_repeat(
                                $0,
                                ((HEAP32[$16 >> 2] | 0) +
                                  (((($199 << 16) >> 16) * 2096) | 0)) |
                                  0,
                                $1,
                                1,
                                $6,
                                $7,
                                $3,
                                $190
                              ) | 0
                            )
                          ) {
                            label = 55;
                            break L21;
                          }
                        } else {
                          $209 =
                            ((Math_imul($190, $$4459574) | 0) +
                              $190 +
                              (HEAP32[$23 >> 2] | 0)) |
                            0;
                          HEAP32[$6 >> 2] = 0;
                          HEAP32[$7 >> 2] = $209;
                        }
                        $$2575 = ($$2575 + 1) | 0;
                        $211 = ($$4459574 + 1) | 0;
                        if (
                          !(
                            (($211 | 0) < ($33 | 0)) &
                            (($$2575 | 0) < ($19 | 0))
                          )
                        ) {
                          $$4459$lcssa = $211;
                          break;
                        } else $$4459574 = $211;
                      }
                    } else $$4459$lcssa = $$3458578;
                    if (($$4459$lcssa | 0) < ($33 | 0)) {
                      $$2462576 = ($$2462576 + 1) | 0;
                      $$3458578 = $$4459$lcssa;
                    } else break;
                  }
                }
                break;
              }
              default:
                if ($71) {
                  $79 = ($$0453600 | 0) == 0;
                  $$4464596 = 0;
                  $$6598 = 0;
                  while (1) {
                    $219 =
                      ((Math_imul(HEAP32[$31 >> 2] | 0, $$6598) | 0) +
                        (HEAP32[$23 >> 2] | 0)) |
                      0;
                    HEAP32[$6 >> 2] = ($219 | 0) % ($2 | 0) | 0;
                    HEAP32[$7 >> 2] = (($219 | 0) / ($2 | 0)) | 0;
                    if ($79) {
                      $222 = HEAP32[$16 >> 2] | 0;
                      $224 = HEAPU8[$13 >> 0] | 0;
                      if ((HEAP32[$72 >> 2] | 0) < 10) _prep_huffman($0);
                      $228 = HEAP32[$73 >> 2] | 0;
                      $231 =
                        HEAP16[
                          ($222 +
                            (($224 * 2096) | 0) +
                            36 +
                            (($228 & 1023) << 1)) >>
                            1
                        ] | 0;
                      $232 = ($231 << 16) >> 16;
                      if (($231 << 16) >> 16 > -1) {
                        $238 =
                          HEAPU8[
                            ((HEAP32[($222 + (($224 * 2096) | 0) + 8) >> 2] |
                              0) +
                              $232) >>
                              0
                          ] | 0;
                        HEAP32[$73 >> 2] = $228 >>> $238;
                        $241 = ((HEAP32[$72 >> 2] | 0) - $238) | 0;
                        $242 = ($241 | 0) < 0;
                        HEAP32[$72 >> 2] = $242 ? 0 : $241;
                        $$1488 = $242 ? -1 : $232;
                      } else
                        $$1488 =
                          _codebook_decode_scalar_raw(
                            $0,
                            ($222 + (($224 * 2096) | 0)) | 0
                          ) | 0;
                      if (!(HEAP8[($222 + (($224 * 2096) | 0) + 23) >> 0] | 0))
                        $$2489 = $$1488;
                      else
                        $$2489 =
                          HEAP32[
                            ((HEAP32[($222 + (($224 * 2096) | 0) + 2088) >> 2] |
                              0) +
                              ($$1488 << 2)) >>
                              2
                          ] | 0;
                      if (($$2489 | 0) == -1) {
                        label = 72;
                        break L21;
                      }
                      HEAP32[((HEAP32[$46 >> 2] | 0) + ($$4464596 << 2)) >> 2] =
                        HEAP32[((HEAP32[$74 >> 2] | 0) + ($$2489 << 2)) >> 2];
                    }
                    if ((($$6598 | 0) < ($33 | 0)) & $75) {
                      $$3592 = 0;
                      $$7591 = $$6598;
                      while (1) {
                        $258 = HEAP32[$31 >> 2] | 0;
                        $267 =
                          HEAP16[
                            ((HEAP32[$76 >> 2] | 0) +
                              (HEAPU8[
                                ((HEAP32[
                                  ((HEAP32[$46 >> 2] | 0) + ($$4464596 << 2)) >>
                                    2
                                ] |
                                  0) +
                                  $$3592) >>
                                  0
                              ] <<
                                4) +
                              ($$0453600 << 1)) >>
                              1
                          ] | 0;
                        if (($267 << 16) >> 16 > -1) {
                          if (
                            !(
                              _codebook_decode_deinterleave_repeat(
                                $0,
                                ((HEAP32[$16 >> 2] | 0) +
                                  (((($267 << 16) >> 16) * 2096) | 0)) |
                                  0,
                                $1,
                                $2,
                                $6,
                                $7,
                                $3,
                                $258
                              ) | 0
                            )
                          ) {
                            label = 72;
                            break L21;
                          }
                        } else {
                          $277 =
                            ((Math_imul($258, $$7591) | 0) +
                              $258 +
                              (HEAP32[$23 >> 2] | 0)) |
                            0;
                          HEAP32[$6 >> 2] = ($277 | 0) % ($2 | 0) | 0;
                          HEAP32[$7 >> 2] = (($277 | 0) / ($2 | 0)) | 0;
                        }
                        $$3592 = ($$3592 + 1) | 0;
                        $281 = ($$7591 + 1) | 0;
                        if (
                          !(
                            (($281 | 0) < ($33 | 0)) &
                            (($$3592 | 0) < ($19 | 0))
                          )
                        ) {
                          $$7$lcssa = $281;
                          break;
                        } else $$7591 = $281;
                      }
                    } else $$7$lcssa = $$6598;
                    if (($$7$lcssa | 0) < ($33 | 0)) {
                      $$4464596 = ($$4464596 + 1) | 0;
                      $$6598 = $$7$lcssa;
                    } else break;
                  }
                }
            }
            if (($$0453600 | 0) < 7) $$0453600 = ($$0453600 + 1) | 0;
            else break L13;
          }
          if ((label | 0) == 38) break;
          else if ((label | 0) == 55) break;
          else if ((label | 0) == 72) break;
        }
      } else {
        $58 = ($33 | 0) > 0;
        $59 = ($19 | 0) > 0;
        $60 = ($9 + (($4 * 24) | 0) + 20) | 0;
        $61 = ($2 | 0) < 1;
        $62 = ($0 + 1384) | 0;
        $63 = ($0 + 1380) | 0;
        $64 = ($9 + (($4 * 24) | 0) + 16) | 0;
        $$1454625 = 0;
        while (1) {
          if ($58) {
            $brmerge = (($$1454625 | 0) != 0) | $61;
            $$0481622 = 0;
            $$0482621 = 0;
            while (1) {
              if (!$brmerge) {
                $$1451610 = 0;
                do {
                  if (!(HEAP8[($5 + $$1451610) >> 0] | 0)) {
                    $293 = HEAP32[$16 >> 2] | 0;
                    $295 = HEAPU8[$13 >> 0] | 0;
                    if ((HEAP32[$62 >> 2] | 0) < 10) _prep_huffman($0);
                    $299 = HEAP32[$63 >> 2] | 0;
                    $302 =
                      HEAP16[
                        ($293 +
                          (($295 * 2096) | 0) +
                          36 +
                          (($299 & 1023) << 1)) >>
                          1
                      ] | 0;
                    $303 = ($302 << 16) >> 16;
                    if (($302 << 16) >> 16 > -1) {
                      $309 =
                        HEAPU8[
                          ((HEAP32[($293 + (($295 * 2096) | 0) + 8) >> 2] | 0) +
                            $303) >>
                            0
                        ] | 0;
                      HEAP32[$63 >> 2] = $299 >>> $309;
                      $312 = ((HEAP32[$62 >> 2] | 0) - $309) | 0;
                      $313 = ($312 | 0) < 0;
                      HEAP32[$62 >> 2] = $313 ? 0 : $312;
                      $$1479 = $313 ? -1 : $303;
                    } else
                      $$1479 =
                        _codebook_decode_scalar_raw(
                          $0,
                          ($293 + (($295 * 2096) | 0)) | 0
                        ) | 0;
                    if (!(HEAP8[($293 + (($295 * 2096) | 0) + 23) >> 0] | 0))
                      $$2480 = $$1479;
                    else
                      $$2480 =
                        HEAP32[
                          ((HEAP32[($293 + (($295 * 2096) | 0) + 2088) >> 2] |
                            0) +
                            ($$1479 << 2)) >>
                            2
                        ] | 0;
                    if (($$2480 | 0) == -1) break L13;
                    HEAP32[
                      ((HEAP32[($46 + ($$1451610 << 2)) >> 2] | 0) +
                        ($$0481622 << 2)) >>
                        2
                    ] = HEAP32[((HEAP32[$64 >> 2] | 0) + ($$2480 << 2)) >> 2];
                  }
                  $$1451610 = ($$1451610 + 1) | 0;
                } while (($$1451610 | 0) < ($2 | 0));
              }
              if ((($$0482621 | 0) < ($33 | 0)) & $59) {
                $$1483617 = $$0482621;
                $$4619 = 0;
                while (1) {
                  if ($49) {
                    $$2452613 = 0;
                    do {
                      if (!(HEAP8[($5 + $$2452613) >> 0] | 0)) {
                        $343 =
                          HEAP16[
                            ((HEAP32[$60 >> 2] | 0) +
                              (HEAPU8[
                                ((HEAP32[
                                  ((HEAP32[($46 + ($$2452613 << 2)) >> 2] | 0) +
                                    ($$0481622 << 2)) >>
                                    2
                                ] |
                                  0) +
                                  $$4619) >>
                                  0
                              ] <<
                                4) +
                              ($$1454625 << 1)) >>
                              1
                          ] | 0;
                        if (($343 << 16) >> 16 > -1) {
                          $349 = HEAP32[$31 >> 2] | 0;
                          $351 =
                            ((Math_imul($349, $$1483617) | 0) +
                              (HEAP32[$23 >> 2] | 0)) |
                            0;
                          if (
                            !(
                              _residue_decode(
                                $0,
                                ((HEAP32[$16 >> 2] | 0) +
                                  (((($343 << 16) >> 16) * 2096) | 0)) |
                                  0,
                                HEAP32[($1 + ($$2452613 << 2)) >> 2] | 0,
                                $351,
                                $349,
                                $12
                              ) | 0
                            )
                          )
                            break L13;
                        }
                      }
                      $$2452613 = ($$2452613 + 1) | 0;
                    } while (($$2452613 | 0) < ($2 | 0));
                  }
                  $$4619 = ($$4619 + 1) | 0;
                  $359 = ($$1483617 + 1) | 0;
                  if (
                    !((($359 | 0) < ($33 | 0)) & (($$4619 | 0) < ($19 | 0)))
                  ) {
                    $$1483$lcssa = $359;
                    break;
                  } else $$1483617 = $359;
                }
              } else $$1483$lcssa = $$0482621;
              if (($$1483$lcssa | 0) < ($33 | 0)) {
                $$0481622 = ($$0481622 + 1) | 0;
                $$0482621 = $$1483$lcssa;
              } else break;
            }
          }
          if (($$1454625 | 0) < 7) $$1454625 = ($$1454625 + 1) | 0;
          else break;
        }
      }
    } while (0);
    HEAP32[$34 >> 2] = $35;
    STACKTOP = sp;
    return;
  }
  function _vorbis_decode_packet_rest($0, $1, $2, $3, $4, $5, $6) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    $6 = $6 | 0;
    var $$0407 = 0,
      $$0408 = 0,
      $$0409 = 0,
      $$041063 = 0,
      $$041452 = 0,
      $$0419$lcssa = 0,
      $$041931 = 0,
      $$042147 = 0,
      $$042651 = 0,
      $$13 = 0,
      $$141140 = 0,
      $$141556 = 0,
      $$1420 = 0,
      $$1427$lcssa = 0,
      $$142746 = 0,
      $$1430 = 0,
      $$1435 = 0,
      $$241236 = 0,
      $$241660 = 0,
      $$2436 = 0,
      $$3 = 0,
      $$341328$in = 0,
      $$341732 = 0,
      $$422 = 0,
      $$441824 = 0,
      $$4433$ph = 0,
      $$443345 = 0,
      $$521 = 0,
      $$pre$phi7378Z2D = 0,
      $$pre75 = 0,
      $$sink$sink = 0,
      $$sink3$in = 0,
      $$sink5 = 0,
      $$sink9 = 0,
      $10 = 0,
      $109 = 0,
      $112 = 0,
      $113 = 0,
      $117 = 0,
      $120 = 0,
      $121 = 0,
      $127 = 0,
      $130 = 0,
      $131 = 0,
      $14 = 0,
      $151 = 0,
      $153 = 0,
      $157 = 0,
      $16 = 0,
      $160 = 0,
      $176 = 0,
      $177 = 0,
      $178 = 0,
      $179 = 0,
      $180 = 0,
      $19 = 0,
      $20 = 0,
      $208 = 0,
      $21 = 0,
      $210 = 0,
      $211 = 0,
      $219 = 0,
      $22 = 0,
      $220 = 0,
      $223 = 0,
      $224 = 0,
      $225 = 0,
      $228 = 0,
      $23 = 0,
      $232 = 0,
      $24 = 0,
      $245 = 0,
      $247 = 0,
      $255 = 0,
      $26 = 0,
      $265 = 0,
      $269 = 0,
      $27 = 0,
      $276 = 0,
      $28 = 0,
      $280 = 0,
      $281 = 0,
      $285 = 0,
      $29 = 0,
      $290 = 0,
      $295 = 0,
      $296 = 0,
      $297 = 0,
      $299 = 0,
      $30 = 0,
      $300 = 0,
      $301 = 0,
      $307 = 0,
      $31 = 0,
      $312 = 0,
      $326 = 0,
      $333 = 0,
      $334 = 0,
      $336 = 0,
      $339 = 0,
      $345 = 0,
      $346 = 0,
      $35 = 0,
      $353 = 0,
      $354 = 0,
      $355 = 0,
      $36 = 0,
      $361 = 0,
      $369 = 0,
      $39 = 0,
      $43 = 0,
      $51 = 0,
      $53 = 0,
      $55 = 0,
      $57 = 0,
      $59 = 0,
      $61 = 0,
      $66 = 0,
      $68 = 0,
      $69 = 0,
      $7 = 0,
      $71 = 0,
      $72 = 0,
      $74 = 0,
      $76 = 0,
      $79 = 0,
      $8 = 0,
      $83 = 0,
      $86 = 0,
      $87 = 0,
      $9 = 0,
      $93 = 0,
      $96 = 0,
      $97 = 0,
      label = 0,
      sp = 0,
      $$341328$in$looptemp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 2560) | 0;
    $7 = (sp + 1280) | 0;
    $8 = (sp + 256) | 0;
    $9 = sp;
    $10 = (sp + 2304) | 0;
    $14 = HEAP32[($0 + 92 + (HEAPU8[$2 >> 0] << 2)) >> 2] | 0;
    $16 = HEAP32[($0 + 392) >> 2] | 0;
    $19 = HEAPU8[($2 + 1) >> 0] | 0;
    $20 = ($16 + (($19 * 40) | 0)) | 0;
    $21 = $14 >> 1;
    $22 = (0 - $21) | 0;
    $23 = ($0 + 4) | 0;
    $24 = HEAP32[$23 >> 2] | 0;
    L1: do {
      if (($24 | 0) > 0) {
        $26 = ($16 + (($19 * 40) | 0) + 4) | 0;
        $27 = ($0 + 248) | 0;
        $28 = ($0 + 1384) | 0;
        $29 = ($9 + 1) | 0;
        $30 = ($0 + 112) | 0;
        $31 = ($0 + 1380) | 0;
        $$041063 = 0;
        while (1) {
          $35 =
            HEAPU8[((HEAP32[$26 >> 2] | 0) + (($$041063 * 3) | 0) + 2) >> 0] |
            0;
          $36 = ($7 + ($$041063 << 2)) | 0;
          HEAP32[$36 >> 2] = 0;
          $39 = HEAPU8[($16 + (($19 * 40) | 0) + 9 + $35) >> 0] | 0;
          if (!(HEAP16[($0 + 120 + ($39 << 1)) >> 1] | 0)) break;
          $43 = HEAP32[$27 >> 2] | 0;
          do {
            if (!(_get_bits($0, 1) | 0)) label = 47;
            else {
              $51 =
                HEAP32[
                  (12 +
                    (((HEAPU8[($43 + (($39 * 1596) | 0) + 1588) >> 0] | 0) +
                      -1) <<
                      2)) >>
                    2
                ] | 0;
              $53 = HEAP32[($0 + 984 + ($$041063 << 2)) >> 2] | 0;
              $55 = ((_ilog($51) | 0) + -1) | 0;
              $57 = (_get_bits($0, $55) | 0) & 65535;
              HEAP16[$53 >> 1] = $57;
              $59 = (_get_bits($0, $55) | 0) & 65535;
              HEAP16[($53 + 2) >> 1] = $59;
              $61 = ($43 + (($39 * 1596) | 0)) | 0;
              if (HEAP8[$61 >> 0] | 0) {
                $$041452 = 0;
                $$042651 = 2;
                while (1) {
                  $66 =
                    HEAPU8[($43 + (($39 * 1596) | 0) + 1 + $$041452) >> 0] | 0;
                  $68 = HEAP8[($43 + (($39 * 1596) | 0) + 33 + $66) >> 0] | 0;
                  $69 = $68 & 255;
                  $71 = HEAP8[($43 + (($39 * 1596) | 0) + 49 + $66) >> 0] | 0;
                  $72 = $71 & 255;
                  $74 = ((1 << $72) + -1) | 0;
                  if (!(($71 << 24) >> 24)) $$4433$ph = 0;
                  else {
                    $76 = HEAP32[$30 >> 2] | 0;
                    $79 =
                      HEAPU8[($43 + (($39 * 1596) | 0) + 65 + $66) >> 0] | 0;
                    if ((HEAP32[$28 >> 2] | 0) < 10) _prep_huffman($0);
                    $83 = HEAP32[$31 >> 2] | 0;
                    $86 =
                      HEAP16[
                        ($76 + (($79 * 2096) | 0) + 36 + (($83 & 1023) << 1)) >>
                          1
                      ] | 0;
                    $87 = ($86 << 16) >> 16;
                    if (($86 << 16) >> 16 > -1) {
                      $93 =
                        HEAPU8[
                          ((HEAP32[($76 + (($79 * 2096) | 0) + 8) >> 2] | 0) +
                            $87) >>
                            0
                        ] | 0;
                      HEAP32[$31 >> 2] = $83 >>> $93;
                      $96 = ((HEAP32[$28 >> 2] | 0) - $93) | 0;
                      $97 = ($96 | 0) < 0;
                      HEAP32[$28 >> 2] = $97 ? 0 : $96;
                      $$1430 = $97 ? -1 : $87;
                    } else
                      $$1430 =
                        _codebook_decode_scalar_raw(
                          $0,
                          ($76 + (($79 * 2096) | 0)) | 0
                        ) | 0;
                    if (!(HEAP8[($76 + (($79 * 2096) | 0) + 23) >> 0] | 0))
                      $$4433$ph = $$1430;
                    else
                      $$4433$ph =
                        HEAP32[
                          ((HEAP32[($76 + (($79 * 2096) | 0) + 2088) >> 2] |
                            0) +
                            ($$1430 << 2)) >>
                            2
                        ] | 0;
                  }
                  if (!(($68 << 24) >> 24)) $$1427$lcssa = $$042651;
                  else {
                    $$042147 = 0;
                    $$142746 = $$042651;
                    $$443345 = $$4433$ph;
                    while (1) {
                      $109 =
                        HEAP16[
                          ($43 +
                            (($39 * 1596) | 0) +
                            82 +
                            ($66 << 4) +
                            (($$443345 & $74) << 1)) >>
                            1
                        ] | 0;
                      $$443345 = $$443345 >> $72;
                      if (($109 << 16) >> 16 > -1) {
                        $112 = ($109 << 16) >> 16;
                        $113 = HEAP32[$30 >> 2] | 0;
                        if ((HEAP32[$28 >> 2] | 0) < 10) _prep_huffman($0);
                        $117 = HEAP32[$31 >> 2] | 0;
                        $120 =
                          HEAP16[
                            ($113 +
                              (($112 * 2096) | 0) +
                              36 +
                              (($117 & 1023) << 1)) >>
                              1
                          ] | 0;
                        $121 = ($120 << 16) >> 16;
                        if (($120 << 16) >> 16 > -1) {
                          $127 =
                            HEAPU8[
                              ((HEAP32[($113 + (($112 * 2096) | 0) + 8) >> 2] |
                                0) +
                                $121) >>
                                0
                            ] | 0;
                          HEAP32[$31 >> 2] = $117 >>> $127;
                          $130 = ((HEAP32[$28 >> 2] | 0) - $127) | 0;
                          $131 = ($130 | 0) < 0;
                          HEAP32[$28 >> 2] = $131 ? 0 : $130;
                          $$1435 = $131 ? -1 : $121;
                        } else
                          $$1435 =
                            _codebook_decode_scalar_raw(
                              $0,
                              ($113 + (($112 * 2096) | 0)) | 0
                            ) | 0;
                        if (
                          !(HEAP8[($113 + (($112 * 2096) | 0) + 23) >> 0] | 0)
                        )
                          $$2436 = $$1435;
                        else
                          $$2436 =
                            HEAP32[
                              ((HEAP32[
                                ($113 + (($112 * 2096) | 0) + 2088) >> 2
                              ] |
                                0) +
                                ($$1435 << 2)) >>
                                2
                            ] | 0;
                        $$sink9 = $$2436 & 65535;
                      } else $$sink9 = 0;
                      HEAP16[($53 + ($$142746 << 1)) >> 1] = $$sink9;
                      $$042147 = ($$042147 + 1) | 0;
                      if (($$042147 | 0) == ($69 | 0)) break;
                      else $$142746 = ($$142746 + 1) | 0;
                    }
                    $$1427$lcssa = ($$042651 + $69) | 0;
                  }
                  $$041452 = ($$041452 + 1) | 0;
                  if (($$041452 | 0) >= (HEAPU8[$61 >> 0] | 0)) break;
                  else $$042651 = $$1427$lcssa;
                }
              }
              if ((HEAP32[$28 >> 2] | 0) == -1) {
                label = 47;
                break;
              }
              HEAP8[$29 >> 0] = 1;
              HEAP8[$9 >> 0] = 1;
              $151 = HEAP32[($43 + (($39 * 1596) | 0) + 1592) >> 2] | 0;
              if (($151 | 0) > 2) {
                $153 = ($51 + 65535) | 0;
                $$141556 = 2;
                do {
                  $157 =
                    HEAPU8[
                      ($43 + (($39 * 1596) | 0) + 1088 + ($$141556 << 1)) >> 0
                    ] | 0;
                  $160 =
                    HEAPU8[
                      ($43 + (($39 * 1596) | 0) + 1088 + ($$141556 << 1) + 1) >>
                        0
                    ] | 0;
                  $176 =
                    _predict_point(
                      HEAPU16[
                        ($43 + (($39 * 1596) | 0) + 338 + ($$141556 << 1)) >> 1
                      ] | 0,
                      HEAPU16[
                        ($43 + (($39 * 1596) | 0) + 338 + ($157 << 1)) >> 1
                      ] | 0,
                      HEAPU16[
                        ($43 + (($39 * 1596) | 0) + 338 + ($160 << 1)) >> 1
                      ] | 0,
                      HEAP16[($53 + ($157 << 1)) >> 1] | 0,
                      HEAP16[($53 + ($160 << 1)) >> 1] | 0
                    ) | 0;
                  $177 = ($53 + ($$141556 << 1)) | 0;
                  $178 = HEAP16[$177 >> 1] | 0;
                  $179 = ($178 << 16) >> 16;
                  $180 = ($51 - $176) | 0;
                  do {
                    if (!(($178 << 16) >> 16)) {
                      HEAP8[($9 + $$141556) >> 0] = 0;
                      $$sink$sink = $176 & 65535;
                    } else {
                      HEAP8[($9 + $160) >> 0] = 1;
                      HEAP8[($9 + $157) >> 0] = 1;
                      HEAP8[($9 + $$141556) >> 0] = 1;
                      if (
                        (((($180 | 0) < ($176 | 0) ? $180 : $176) << 1) | 0) <=
                        ($179 | 0)
                      ) {
                        if (($180 | 0) > ($176 | 0)) {
                          $$sink$sink = $178;
                          break;
                        }
                        $$sink$sink = ($153 - $179) & 65535;
                        break;
                      }
                      if (!($179 & 1)) $$sink3$in = (($179 >>> 1) + $176) | 0;
                      else $$sink3$in = ($176 - (($179 + 1) >> 1)) | 0;
                      $$sink$sink = $$sink3$in & 65535;
                    }
                  } while (0);
                  HEAP16[$177 >> 1] = $$sink$sink;
                  $$141556 = ($$141556 + 1) | 0;
                } while (($$141556 | 0) < ($151 | 0));
              }
              if (($151 | 0) > 0) {
                $$241660 = 0;
                do {
                  if (!(HEAP8[($9 + $$241660) >> 0] | 0))
                    HEAP16[($53 + ($$241660 << 1)) >> 1] = -1;
                  $$241660 = ($$241660 + 1) | 0;
                } while (($$241660 | 0) < ($151 | 0));
              }
            }
          } while (0);
          if ((label | 0) == 47) {
            label = 0;
            HEAP32[$36 >> 2] = 1;
          }
          $$041063 = ($$041063 + 1) | 0;
          $208 = HEAP32[$23 >> 2] | 0;
          if (($$041063 | 0) >= ($208 | 0)) {
            $219 = $208;
            label = 49;
            break L1;
          }
        }
        _error($0, 21);
        $$3 = 0;
      } else {
        $219 = $24;
        label = 49;
      }
    } while (0);
    do {
      if ((label | 0) == 49) {
        $210 = ($0 + 68) | 0;
        $211 = HEAP32[$210 >> 2] | 0;
        if ($211 | 0)
          if ((HEAP32[($0 + 72) >> 2] | 0) != (HEAP32[($0 + 80) >> 2] | 0))
            ___assert_fail(1067, 1052, 3277, 1231);
        _memcpy($8 | 0, $7 | 0, ($219 << 2) | 0) | 0;
        $220 = HEAP16[$20 >> 1] | 0;
        if (($220 << 16) >> 16) {
          $223 = HEAP32[($16 + (($19 * 40) | 0) + 4) >> 2] | 0;
          $224 = $220 & 65535;
          $$141140 = 0;
          do {
            $232 = ($7 + (HEAPU8[($223 + (($$141140 * 3) | 0)) >> 0] << 2)) | 0;
            $$pre75 = ($223 + (($$141140 * 3) | 0) + 1) | 0;
            if (!(HEAP32[$232 >> 2] | 0)) label = 58;
            else if (!(HEAP32[($7 + (HEAPU8[$$pre75 >> 0] << 2)) >> 2] | 0))
              label = 58;
            if ((label | 0) == 58) {
              label = 0;
              HEAP32[($7 + (HEAPU8[$$pre75 >> 0] << 2)) >> 2] = 0;
              HEAP32[$232 >> 2] = 0;
            }
            $$141140 = ($$141140 + 1) | 0;
          } while (($$141140 | 0) < ($224 | 0));
        }
        $225 = ($16 + (($19 * 40) | 0) + 8) | 0;
        if (!(HEAP8[$225 >> 0] | 0)) $269 = $211;
        else {
          $228 = ($16 + (($19 * 40) | 0) + 4) | 0;
          $$241236 = 0;
          $245 = $219;
          while (1) {
            if (($245 | 0) > 0) {
              $247 = HEAP32[$228 >> 2] | 0;
              $$041931 = 0;
              $$341732 = 0;
              while (1) {
                if (
                  ($$241236 | 0) ==
                  (HEAPU8[($247 + (($$341732 * 3) | 0) + 2) >> 0] | 0)
                ) {
                  $255 = ($10 + $$041931) | 0;
                  if (!(HEAP32[($7 + ($$341732 << 2)) >> 2] | 0)) {
                    HEAP8[$255 >> 0] = 0;
                    $$sink5 = HEAP32[($0 + 788 + ($$341732 << 2)) >> 2] | 0;
                  } else {
                    HEAP8[$255 >> 0] = 1;
                    $$sink5 = 0;
                  }
                  HEAP32[($9 + ($$041931 << 2)) >> 2] = $$sink5;
                  $$1420 = ($$041931 + 1) | 0;
                } else $$1420 = $$041931;
                $$341732 = ($$341732 + 1) | 0;
                if (($$341732 | 0) >= ($245 | 0)) {
                  $$0419$lcssa = $$1420;
                  break;
                } else $$041931 = $$1420;
              }
            } else $$0419$lcssa = 0;
            _decode_residue(
              $0,
              $9,
              $$0419$lcssa,
              $21,
              HEAPU8[($16 + (($19 * 40) | 0) + 24 + $$241236) >> 0] | 0,
              $10
            );
            $265 = ($$241236 + 1) | 0;
            if (($265 | 0) >= (HEAPU8[$225 >> 0] | 0)) break;
            $$241236 = $265;
            $245 = HEAP32[$23 >> 2] | 0;
          }
          $269 = HEAP32[$210 >> 2] | 0;
        }
        if ($269 | 0)
          if ((HEAP32[($0 + 72) >> 2] | 0) != (HEAP32[($0 + 80) >> 2] | 0))
            ___assert_fail(1067, 1052, 3310, 1231);
        $276 = HEAP16[$20 >> 1] | 0;
        if (($276 << 16) >> 16) {
          $280 = HEAP32[($16 + (($19 * 40) | 0) + 4) >> 2] | 0;
          $281 = ($21 | 0) > 0;
          $$341328$in = $276 & 65535;
          do {
            $$341328$in$looptemp = $$341328$in;
            $$341328$in = ($$341328$in + -1) | 0;
            $290 =
              HEAP32[
                ($0 +
                  788 +
                  (HEAPU8[($280 + (($$341328$in * 3) | 0)) >> 0] << 2)) >>
                  2
              ] | 0;
            $295 =
              HEAP32[
                ($0 +
                  788 +
                  (HEAPU8[($280 + (($$341328$in * 3) | 0) + 1) >> 0] << 2)) >>
                  2
              ] | 0;
            if ($281) {
              $$441824 = 0;
              do {
                $296 = ($290 + ($$441824 << 2)) | 0;
                $297 = +HEAPF32[$296 >> 2];
                $299 = ($295 + ($$441824 << 2)) | 0;
                $300 = +HEAPF32[$299 >> 2];
                $301 = $300 > 0;
                do {
                  if ($297 > 0)
                    if ($301) {
                      $$0407 = $297;
                      $$0408 = $297 - $300;
                      break;
                    } else {
                      $$0407 = $297 + $300;
                      $$0408 = $297;
                      break;
                    }
                  else if ($301) {
                    $$0407 = $297;
                    $$0408 = $297 + $300;
                    break;
                  } else {
                    $$0407 = $297 - $300;
                    $$0408 = $297;
                    break;
                  }
                } while (0);
                HEAPF32[$296 >> 2] = $$0407;
                HEAPF32[$299 >> 2] = $$0408;
                $$441824 = ($$441824 + 1) | 0;
              } while (($$441824 | 0) != ($21 | 0));
            }
          } while (($$341328$in$looptemp | 0) > 1);
        }
        if ((HEAP32[$23 >> 2] | 0) > 0) {
          $285 = $21 << 2;
          $$422 = 0;
          do {
            $312 = ($0 + 788 + ($$422 << 2)) | 0;
            if (!(HEAP32[($8 + ($$422 << 2)) >> 2] | 0))
              _do_floor(
                $0,
                $20,
                $$422,
                $14,
                HEAP32[$312 >> 2] | 0,
                HEAP32[($0 + 984 + ($$422 << 2)) >> 2] | 0
              );
            else _memset(HEAP32[$312 >> 2] | 0, 0, $285 | 0) | 0;
            $$422 = ($$422 + 1) | 0;
            $307 = HEAP32[$23 >> 2] | 0;
          } while (($$422 | 0) < ($307 | 0));
          if (($307 | 0) > 0) {
            $$521 = 0;
            do {
              _inverse_mdct(
                HEAP32[($0 + 788 + ($$521 << 2)) >> 2] | 0,
                $14,
                $0,
                HEAPU8[$2 >> 0] | 0
              );
              $$521 = ($$521 + 1) | 0;
            } while (($$521 | 0) < (HEAP32[$23 >> 2] | 0));
          }
        }
        _flush_packet($0);
        $326 = ($0 + 1365) | 0;
        do {
          if (!(HEAP8[$326 >> 0] | 0)) {
            $333 = ($0 + 1400) | 0;
            $334 = HEAP32[$333 >> 2] | 0;
            if (!$334) $$0409 = $3;
            else {
              $336 = ($4 - $3) | 0;
              if (($334 | 0) < ($336 | 0)) {
                $339 = ($334 + $3) | 0;
                HEAP32[$6 >> 2] = $339;
                HEAP32[$333 >> 2] = 0;
                $$0409 = $339;
                break;
              } else {
                HEAP32[$333 >> 2] = $334 - $336;
                HEAP32[$6 >> 2] = $4;
                $$0409 = $4;
                break;
              }
            }
          } else {
            HEAP32[($0 + 1048) >> 2] = $22;
            HEAP32[($0 + 1400) >> 2] = $14 - $5;
            HEAP32[($0 + 1052) >> 2] = 1;
            HEAP8[$326 >> 0] = 0;
            $$0409 = $3;
          }
        } while (0);
        $345 = ($0 + 1052) | 0;
        $346 = HEAP32[$345 >> 2] | 0;
        if ((HEAP32[($0 + 1376) >> 2] | 0) == (HEAP32[($0 + 1392) >> 2] | 0)) {
          if ($346 | 0)
            if (HEAP8[($0 + 1363) >> 0] & 4) {
              $353 = HEAP32[($0 + 1396) >> 2] | 0;
              $354 = ($0 + 1048) | 0;
              $355 = HEAP32[$354 >> 2] | 0;
              $361 =
                (($353 >>> 0 < $355 >>> 0 ? 0 : ($353 - $355) | 0) + $$0409) |
                0;
              $$13 = ($361 | 0) > ($5 | 0) ? $5 : $361;
              if ($353 >>> 0 < (($5 - $$0409 + $355) | 0) >>> 0) {
                HEAP32[$1 >> 2] = $$13;
                HEAP32[$354 >> 2] = (HEAP32[$354 >> 2] | 0) + $$13;
                $$3 = 1;
                break;
              }
            }
          $369 = ($0 + 1048) | 0;
          HEAP32[$369 >> 2] = $$0409 - $21 + (HEAP32[($0 + 1396) >> 2] | 0);
          HEAP32[$345 >> 2] = 1;
          $$pre$phi7378Z2D = $369;
          label = 107;
        } else if ($346 | 0) {
          $$pre$phi7378Z2D = ($0 + 1048) | 0;
          label = 107;
        }
        if ((label | 0) == 107)
          HEAP32[$$pre$phi7378Z2D >> 2] =
            $4 - $$0409 + (HEAP32[$$pre$phi7378Z2D >> 2] | 0);
        if (HEAP32[$210 >> 2] | 0)
          if ((HEAP32[($0 + 72) >> 2] | 0) != (HEAP32[($0 + 80) >> 2] | 0))
            ___assert_fail(1067, 1052, 3426, 1231);
        HEAP32[$1 >> 2] = $5;
        $$3 = 1;
      }
    } while (0);
    STACKTOP = sp;
    return $$3 | 0;
  }
  function _inverse_mdct($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$0$lcssa = 0,
      $$0492$lcssa = 0,
      $$0492576 = 0,
      $$0494 = 0,
      $$0494522 = 0,
      $$0494530 = 0,
      $$0495531$pn = 0,
      $$0496527 = 0,
      $$0497526 = 0,
      $$0498525 = 0,
      $$0499524 = 0,
      $$0500575 = 0,
      $$0502$lcssa = 0,
      $$0502574 = 0,
      $$0504564 = 0,
      $$0505563 = 0,
      $$0506562 = 0,
      $$0507561 = 0,
      $$0508 = 0,
      $$0508532 = 0,
      $$0508536 = 0,
      $$0509534 = 0,
      $$0510533 = 0,
      $$0511560 = 0,
      $$0512542 = 0,
      $$0513541 = 0,
      $$0514540 = 0,
      $$0515548 = 0,
      $$0516547 = 0,
      $$0517554 = 0,
      $$0518546 = 0,
      $$0557 = 0,
      $$1493570 = 0,
      $$1501569 = 0,
      $$1503568 = 0,
      $$1551 = 0,
      $$pn520529 = 0,
      $$pn520529$phi = 0,
      $$pn535 = 0,
      $$pn535$phi = 0,
      $106 = 0,
      $108 = 0,
      $109 = 0,
      $110 = 0,
      $112 = 0,
      $114 = 0,
      $12 = 0,
      $123 = 0,
      $14 = 0,
      $140 = 0,
      $141 = 0,
      $142 = 0,
      $143 = 0,
      $145 = 0,
      $146 = 0,
      $153 = 0,
      $156 = 0,
      $159 = 0,
      $16 = 0,
      $160 = 0,
      $164 = 0,
      $165 = 0,
      $167 = 0,
      $174 = 0,
      $176 = 0,
      $178 = 0,
      $179 = 0,
      $18 = 0,
      $182 = 0,
      $183 = 0,
      $189 = 0,
      $19 = 0,
      $190 = 0,
      $196 = 0,
      $20 = 0,
      $214 = 0,
      $22 = 0,
      $23 = 0,
      $232 = 0,
      $236 = 0,
      $237 = 0,
      $238 = 0,
      $239 = 0,
      $240 = 0,
      $241 = 0,
      $242 = 0,
      $243 = 0,
      $244 = 0,
      $246 = 0,
      $248 = 0,
      $250 = 0,
      $253 = 0,
      $254 = 0,
      $255 = 0,
      $260 = 0,
      $261 = 0,
      $262 = 0,
      $263 = 0,
      $264 = 0,
      $265 = 0,
      $266 = 0,
      $267 = 0,
      $268 = 0,
      $27 = 0,
      $270 = 0,
      $273 = 0,
      $275 = 0,
      $278 = 0,
      $279 = 0,
      $280 = 0,
      $296 = 0,
      $298 = 0,
      $301 = 0,
      $303 = 0,
      $305 = 0,
      $309 = 0,
      $31 = 0,
      $314 = 0,
      $316 = 0,
      $319 = 0,
      $321 = 0,
      $323 = 0,
      $327 = 0,
      $33 = 0,
      $334 = 0,
      $336 = 0,
      $339 = 0,
      $341 = 0,
      $343 = 0,
      $347 = 0,
      $353 = 0,
      $355 = 0,
      $358 = 0,
      $359 = 0,
      $361 = 0,
      $365 = 0,
      $4 = 0,
      $5 = 0,
      $52 = 0,
      $57 = 0,
      $6 = 0,
      $7 = 0,
      $8 = 0,
      $80 = 0,
      $82 = 0,
      $83 = 0,
      $86 = 0,
      $92 = 0,
      $95 = 0,
      $scevgep = 0,
      sp = 0,
      $$0557$looptemp = 0;
    sp = STACKTOP;
    $4 = $1 >> 1;
    $5 = $1 >> 2;
    $6 = $1 >> 3;
    $7 = ($2 + 80) | 0;
    $8 = HEAP32[$7 >> 2] | 0;
    $12 = $4 << 2;
    if (!(HEAP32[($2 + 68) >> 2] | 0)) {
      $14 = STACKTOP;
      STACKTOP = (STACKTOP + ((((1 * $12) | 0) + 15) & -16)) | 0;
      $19 = $14;
    } else $19 = _setup_temp_malloc($2, $12) | 0;
    $16 = HEAP32[($2 + 1056 + ($3 << 2)) >> 2] | 0;
    $18 = ($19 + (($4 + -2) << 2)) | 0;
    $20 = ($0 + ($4 << 2)) | 0;
    if (!$4) {
      $$0492$lcssa = $18;
      $$0502$lcssa = $16;
    } else {
      $22 = ($12 + -16) | 0;
      $23 = $22 >>> 4;
      $scevgep = ($19 + ($22 - ($23 << 3))) | 0;
      $27 = (($23 << 1) + 2) | 0;
      $$0492576 = $18;
      $$0500575 = $0;
      $$0502574 = $16;
      while (1) {
        $31 = ($$0500575 + 8) | 0;
        $33 = ($$0502574 + 4) | 0;
        HEAPF32[($$0492576 + 4) >> 2] =
          +HEAPF32[$$0500575 >> 2] * +HEAPF32[$$0502574 >> 2] -
          +HEAPF32[$31 >> 2] * +HEAPF32[$33 >> 2];
        HEAPF32[$$0492576 >> 2] =
          +HEAPF32[$$0500575 >> 2] * +HEAPF32[$33 >> 2] +
          +HEAPF32[$31 >> 2] * +HEAPF32[$$0502574 >> 2];
        $$0500575 = ($$0500575 + 16) | 0;
        if (($$0500575 | 0) == ($20 | 0)) break;
        else {
          $$0492576 = ($$0492576 + -8) | 0;
          $$0502574 = ($$0502574 + 8) | 0;
        }
      }
      $$0492$lcssa = $scevgep;
      $$0502$lcssa = ($16 + ($27 << 2)) | 0;
    }
    if ($$0492$lcssa >>> 0 >= $19 >>> 0) {
      $$1493570 = $$0492$lcssa;
      $$1501569 = ($0 + (($4 + -3) << 2)) | 0;
      $$1503568 = $$0502$lcssa;
      while (1) {
        $52 = ($$1501569 + 8) | 0;
        $57 = ($$1503568 + 4) | 0;
        HEAPF32[($$1493570 + 4) >> 2] =
          +HEAPF32[$$1501569 >> 2] * +HEAPF32[$57 >> 2] -
          +HEAPF32[$52 >> 2] * +HEAPF32[$$1503568 >> 2];
        HEAPF32[$$1493570 >> 2] =
          -(+HEAPF32[$$1501569 >> 2] * +HEAPF32[$$1503568 >> 2]) -
          +HEAPF32[$52 >> 2] * +HEAPF32[$57 >> 2];
        $$1493570 = ($$1493570 + -8) | 0;
        if ($$1493570 >>> 0 < $19 >>> 0) break;
        else {
          $$1501569 = ($$1501569 + -16) | 0;
          $$1503568 = ($$1503568 + 8) | 0;
        }
      }
    }
    if (($4 | 0) >= 8) {
      $$0504564 = ($16 + (($4 + -8) << 2)) | 0;
      $$0505563 = ($0 + ($5 << 2)) | 0;
      $$0506562 = $0;
      $$0507561 = ($19 + ($5 << 2)) | 0;
      $$0511560 = $19;
      while (1) {
        $80 = +HEAPF32[($$0507561 + 4) >> 2];
        $82 = +HEAPF32[($$0511560 + 4) >> 2];
        $83 = $80 - $82;
        $86 = +HEAPF32[$$0507561 >> 2] - +HEAPF32[$$0511560 >> 2];
        HEAPF32[($$0505563 + 4) >> 2] = $80 + $82;
        HEAPF32[$$0505563 >> 2] =
          +HEAPF32[$$0507561 >> 2] + +HEAPF32[$$0511560 >> 2];
        $92 = ($$0504564 + 16) | 0;
        $95 = ($$0504564 + 20) | 0;
        HEAPF32[($$0506562 + 4) >> 2] =
          $83 * +HEAPF32[$92 >> 2] - $86 * +HEAPF32[$95 >> 2];
        HEAPF32[$$0506562 >> 2] =
          $86 * +HEAPF32[$92 >> 2] + $83 * +HEAPF32[$95 >> 2];
        $106 = +HEAPF32[($$0507561 + 12) >> 2];
        $108 = +HEAPF32[($$0511560 + 12) >> 2];
        $109 = $106 - $108;
        $110 = ($$0507561 + 8) | 0;
        $112 = ($$0511560 + 8) | 0;
        $114 = +HEAPF32[$110 >> 2] - +HEAPF32[$112 >> 2];
        HEAPF32[($$0505563 + 12) >> 2] = $106 + $108;
        HEAPF32[($$0505563 + 8) >> 2] =
          +HEAPF32[$110 >> 2] + +HEAPF32[$112 >> 2];
        $123 = ($$0504564 + 4) | 0;
        HEAPF32[($$0506562 + 12) >> 2] =
          $109 * +HEAPF32[$$0504564 >> 2] - $114 * +HEAPF32[$123 >> 2];
        HEAPF32[($$0506562 + 8) >> 2] =
          $114 * +HEAPF32[$$0504564 >> 2] + $109 * +HEAPF32[$123 >> 2];
        $$0504564 = ($$0504564 + -32) | 0;
        if ($$0504564 >>> 0 < $16 >>> 0) break;
        else {
          $$0505563 = ($$0505563 + 16) | 0;
          $$0506562 = ($$0506562 + 16) | 0;
          $$0507561 = ($$0507561 + 16) | 0;
          $$0511560 = ($$0511560 + 16) | 0;
        }
      }
    }
    $140 = _ilog($1) | 0;
    $141 = $1 >> 4;
    $142 = ($4 + -1) | 0;
    $143 = (0 - $6) | 0;
    _imdct_step3_iter0_loop($141, $0, $142, $143, $16);
    _imdct_step3_iter0_loop($141, $0, ($142 - $5) | 0, $143, $16);
    $145 = $1 >> 5;
    $146 = (0 - $141) | 0;
    _imdct_step3_inner_r_loop($145, $0, $142, $146, $16, 16);
    _imdct_step3_inner_r_loop($145, $0, ($142 - $6) | 0, $146, $16, 16);
    _imdct_step3_inner_r_loop($145, $0, ($142 - ($6 << 1)) | 0, $146, $16, 16);
    _imdct_step3_inner_r_loop(
      $145,
      $0,
      ($142 + (Math_imul($6, -3) | 0)) | 0,
      $146,
      $16,
      16
    );
    $153 = ($140 + -4) >> 1;
    if (($153 | 0) > 2) {
      $$0557 = 2;
      do {
        $159 = $1 >> ($$0557 + 2);
        $$0557$looptemp = $$0557;
        $$0557 = ($$0557 + 1) | 0;
        $160 = 1 << $$0557;
        if (($$0557 | 0) != 31) {
          $164 = $1 >> ($$0557$looptemp + 4);
          $165 = (0 - ($159 >> 1)) | 0;
          $167 = 1 << ($$0557$looptemp + 3);
          $$0517554 = 0;
          do {
            _imdct_step3_inner_r_loop(
              $164,
              $0,
              ($142 - (Math_imul($$0517554, $159) | 0)) | 0,
              $165,
              $16,
              $167
            );
            $$0517554 = ($$0517554 + 1) | 0;
          } while (($$0517554 | 0) < ($160 | 0));
        }
      } while (($$0557 | 0) != ($153 | 0));
      $$0$lcssa = $153;
    } else $$0$lcssa = 2;
    $156 = ($140 + -7) | 0;
    if (($$0$lcssa | 0) < ($156 | 0)) {
      $$1551 = $$0$lcssa;
      do {
        $174 = $1 >> ($$1551 + 2);
        $176 = 1 << ($$1551 + 3);
        $178 = $1 >> ($$1551 + 6);
        $$1551 = ($$1551 + 1) | 0;
        $179 = 1 << $$1551;
        if (($178 | 0) > 0) {
          $182 = (0 - ($174 >> 1)) | 0;
          $183 = $176 << 2;
          $$0515548 = $16;
          $$0516547 = $142;
          $$0518546 = $178;
          while (1) {
            _imdct_step3_inner_s_loop(
              $179,
              $0,
              $$0516547,
              $182,
              $$0515548,
              $176,
              $174
            );
            if (($$0518546 | 0) > 1) {
              $$0515548 = ($$0515548 + ($183 << 2)) | 0;
              $$0516547 = ($$0516547 + -8) | 0;
              $$0518546 = ($$0518546 + -1) | 0;
            } else break;
          }
        }
      } while (($$1551 | 0) != ($156 | 0));
    }
    _imdct_step3_inner_s_loop_ld654($145, $0, $142, $16, $1);
    $189 = ($19 + (($5 + -4) << 2)) | 0;
    $190 = ($4 + -4) | 0;
    if ($189 >>> 0 >= $19 >>> 0) {
      $$0512542 = ($19 + ($190 << 2)) | 0;
      $$0513541 = $189;
      $$0514540 = HEAP32[($2 + 1088 + ($3 << 2)) >> 2] | 0;
      while (1) {
        $196 = HEAPU16[$$0514540 >> 1] | 0;
        HEAP32[($$0512542 + 12) >> 2] = HEAP32[($0 + ($196 << 2)) >> 2];
        HEAP32[($$0512542 + 8) >> 2] = HEAP32[($0 + (($196 + 1) << 2)) >> 2];
        HEAP32[($$0513541 + 12) >> 2] = HEAP32[($0 + (($196 + 2) << 2)) >> 2];
        HEAP32[($$0513541 + 8) >> 2] = HEAP32[($0 + (($196 + 3) << 2)) >> 2];
        $214 = HEAPU16[($$0514540 + 2) >> 1] | 0;
        HEAP32[($$0512542 + 4) >> 2] = HEAP32[($0 + ($214 << 2)) >> 2];
        HEAP32[$$0512542 >> 2] = HEAP32[($0 + (($214 + 1) << 2)) >> 2];
        HEAP32[($$0513541 + 4) >> 2] = HEAP32[($0 + (($214 + 2) << 2)) >> 2];
        HEAP32[$$0513541 >> 2] = HEAP32[($0 + (($214 + 3) << 2)) >> 2];
        $$0513541 = ($$0513541 + -16) | 0;
        if ($$0513541 >>> 0 < $19 >>> 0) break;
        else {
          $$0512542 = ($$0512542 + -16) | 0;
          $$0514540 = ($$0514540 + 4) | 0;
        }
      }
    }
    $232 = ($19 + ($4 << 2)) | 0;
    $$0508532 = ($232 + -16) | 0;
    if ($$0508532 >>> 0 > $19 >>> 0) {
      $$0508536 = $$0508532;
      $$0509534 = $19;
      $$0510533 = HEAP32[($2 + 1072 + ($3 << 2)) >> 2] | 0;
      $$pn535 = $232;
      while (1) {
        $236 = +HEAPF32[$$0509534 >> 2];
        $237 = ($$pn535 + -8) | 0;
        $238 = +HEAPF32[$237 >> 2];
        $239 = $236 - $238;
        $240 = ($$0509534 + 4) | 0;
        $241 = +HEAPF32[$240 >> 2];
        $242 = ($$pn535 + -4) | 0;
        $243 = +HEAPF32[$242 >> 2];
        $244 = $241 + $243;
        $246 = +HEAPF32[($$0510533 + 4) >> 2];
        $248 = +HEAPF32[$$0510533 >> 2];
        $250 = $239 * $246 + $244 * $248;
        $253 = $246 * $244 - $239 * $248;
        $254 = $236 + $238;
        $255 = $241 - $243;
        HEAPF32[$$0509534 >> 2] = $254 + $250;
        HEAPF32[$240 >> 2] = $255 + $253;
        HEAPF32[$237 >> 2] = $254 - $250;
        HEAPF32[$242 >> 2] = $253 - $255;
        $260 = ($$0509534 + 8) | 0;
        $261 = +HEAPF32[$260 >> 2];
        $262 = +HEAPF32[$$0508536 >> 2];
        $263 = $261 - $262;
        $264 = ($$0509534 + 12) | 0;
        $265 = +HEAPF32[$264 >> 2];
        $266 = ($$pn535 + -12) | 0;
        $267 = +HEAPF32[$266 >> 2];
        $268 = $265 + $267;
        $270 = +HEAPF32[($$0510533 + 12) >> 2];
        $273 = +HEAPF32[($$0510533 + 8) >> 2];
        $275 = $263 * $270 + $268 * $273;
        $278 = $270 * $268 - $263 * $273;
        $279 = $261 + $262;
        $280 = $265 - $267;
        HEAPF32[$260 >> 2] = $279 + $275;
        HEAPF32[$264 >> 2] = $280 + $278;
        HEAPF32[$$0508536 >> 2] = $279 - $275;
        HEAPF32[$266 >> 2] = $278 - $280;
        $$0509534 = ($$0509534 + 16) | 0;
        $$0508 = ($$0508536 + -16) | 0;
        if ($$0509534 >>> 0 >= $$0508 >>> 0) break;
        else {
          $$pn535$phi = $$0508536;
          $$0508536 = $$0508;
          $$0510533 = ($$0510533 + 16) | 0;
          $$pn535 = $$pn535$phi;
        }
      }
    }
    $$0494522 = ($232 + -32) | 0;
    if ($$0494522 >>> 0 >= $19 >>> 0) {
      $$0494530 = $$0494522;
      $$0495531$pn =
        ((HEAP32[($2 + 1064 + ($3 << 2)) >> 2] | 0) + ($4 << 2)) | 0;
      $$0496527 = ($0 + (($1 + -4) << 2)) | 0;
      $$0497526 = $20;
      $$0498525 = ($0 + ($190 << 2)) | 0;
      $$0499524 = $0;
      $$pn520529 = $232;
      while (1) {
        $296 = +HEAPF32[($$pn520529 + -8) >> 2];
        $298 = +HEAPF32[($$0495531$pn + -4) >> 2];
        $301 = +HEAPF32[($$pn520529 + -4) >> 2];
        $303 = +HEAPF32[($$0495531$pn + -8) >> 2];
        $305 = $296 * $298 - $301 * $303;
        $309 = -($296 * $303) - $298 * $301;
        HEAPF32[$$0499524 >> 2] = $305;
        HEAPF32[($$0498525 + 12) >> 2] = -$305;
        HEAPF32[$$0497526 >> 2] = $309;
        HEAPF32[($$0496527 + 12) >> 2] = $309;
        $314 = +HEAPF32[($$pn520529 + -16) >> 2];
        $316 = +HEAPF32[($$0495531$pn + -12) >> 2];
        $319 = +HEAPF32[($$pn520529 + -12) >> 2];
        $321 = +HEAPF32[($$0495531$pn + -16) >> 2];
        $323 = $314 * $316 - $319 * $321;
        $327 = -($314 * $321) - $316 * $319;
        HEAPF32[($$0499524 + 4) >> 2] = $323;
        HEAPF32[($$0498525 + 8) >> 2] = -$323;
        HEAPF32[($$0497526 + 4) >> 2] = $327;
        HEAPF32[($$0496527 + 8) >> 2] = $327;
        $334 = +HEAPF32[($$pn520529 + -24) >> 2];
        $336 = +HEAPF32[($$0495531$pn + -20) >> 2];
        $339 = +HEAPF32[($$pn520529 + -20) >> 2];
        $341 = +HEAPF32[($$0495531$pn + -24) >> 2];
        $343 = $334 * $336 - $339 * $341;
        $347 = -($334 * $341) - $336 * $339;
        HEAPF32[($$0499524 + 8) >> 2] = $343;
        HEAPF32[($$0498525 + 4) >> 2] = -$343;
        HEAPF32[($$0497526 + 8) >> 2] = $347;
        HEAPF32[($$0496527 + 4) >> 2] = $347;
        $353 = +HEAPF32[$$0494530 >> 2];
        $355 = +HEAPF32[($$0495531$pn + -28) >> 2];
        $$0495531$pn = ($$0495531$pn + -32) | 0;
        $358 = +HEAPF32[($$pn520529 + -28) >> 2];
        $359 = +HEAPF32[$$0495531$pn >> 2];
        $361 = $353 * $355 - $358 * $359;
        $365 = -($353 * $359) - $355 * $358;
        HEAPF32[($$0499524 + 12) >> 2] = $361;
        HEAPF32[$$0498525 >> 2] = -$361;
        HEAPF32[($$0497526 + 12) >> 2] = $365;
        HEAPF32[$$0496527 >> 2] = $365;
        $$0494 = ($$0494530 + -32) | 0;
        if ($$0494 >>> 0 < $19 >>> 0) break;
        else {
          $$pn520529$phi = $$0494530;
          $$0494530 = $$0494;
          $$0496527 = ($$0496527 + -16) | 0;
          $$0497526 = ($$0497526 + 16) | 0;
          $$0498525 = ($$0498525 + -16) | 0;
          $$0499524 = ($$0499524 + 16) | 0;
          $$pn520529 = $$pn520529$phi;
        }
      }
    }
    HEAP32[$7 >> 2] = $8;
    STACKTOP = sp;
    return;
  }
  function _free($0) {
    $0 = $0 | 0;
    var $$0212$i = 0,
      $$0212$in$i = 0,
      $$0383 = 0,
      $$0384 = 0,
      $$0396 = 0,
      $$0403 = 0,
      $$1 = 0,
      $$1382 = 0,
      $$1387 = 0,
      $$1390 = 0,
      $$1398 = 0,
      $$1402 = 0,
      $$2 = 0,
      $$3 = 0,
      $$3400 = 0,
      $$pre$phi442Z2D = 0,
      $$pre$phi444Z2D = 0,
      $$pre$phiZ2D = 0,
      $10 = 0,
      $105 = 0,
      $106 = 0,
      $113 = 0,
      $115 = 0,
      $116 = 0,
      $124 = 0,
      $13 = 0,
      $132 = 0,
      $137 = 0,
      $138 = 0,
      $141 = 0,
      $143 = 0,
      $145 = 0,
      $16 = 0,
      $160 = 0,
      $165 = 0,
      $167 = 0,
      $17 = 0,
      $170 = 0,
      $173 = 0,
      $176 = 0,
      $179 = 0,
      $180 = 0,
      $181 = 0,
      $183 = 0,
      $185 = 0,
      $186 = 0,
      $188 = 0,
      $189 = 0,
      $195 = 0,
      $196 = 0,
      $2 = 0,
      $21 = 0,
      $210 = 0,
      $213 = 0,
      $214 = 0,
      $220 = 0,
      $235 = 0,
      $238 = 0,
      $239 = 0,
      $24 = 0,
      $240 = 0,
      $244 = 0,
      $245 = 0,
      $251 = 0,
      $256 = 0,
      $257 = 0,
      $26 = 0,
      $260 = 0,
      $262 = 0,
      $265 = 0,
      $270 = 0,
      $276 = 0,
      $28 = 0,
      $280 = 0,
      $281 = 0,
      $299 = 0,
      $3 = 0,
      $301 = 0,
      $308 = 0,
      $309 = 0,
      $310 = 0,
      $319 = 0,
      $41 = 0,
      $46 = 0,
      $48 = 0,
      $51 = 0,
      $53 = 0,
      $56 = 0,
      $59 = 0,
      $6 = 0,
      $60 = 0,
      $61 = 0,
      $63 = 0,
      $65 = 0,
      $66 = 0,
      $68 = 0,
      $69 = 0,
      $7 = 0,
      $74 = 0,
      $75 = 0,
      $89 = 0,
      $9 = 0,
      $92 = 0,
      $93 = 0,
      $99 = 0,
      label = 0;
    if (!$0) return;
    $2 = ($0 + -8) | 0;
    $3 = HEAP32[464] | 0;
    if ($2 >>> 0 < $3 >>> 0) _abort();
    $6 = HEAP32[($0 + -4) >> 2] | 0;
    $7 = $6 & 3;
    if (($7 | 0) == 1) _abort();
    $9 = $6 & -8;
    $10 = ($2 + $9) | 0;
    L10: do {
      if (!($6 & 1)) {
        $13 = HEAP32[$2 >> 2] | 0;
        if (!$7) return;
        $16 = ($2 + (0 - $13)) | 0;
        $17 = ($13 + $9) | 0;
        if ($16 >>> 0 < $3 >>> 0) _abort();
        if ((HEAP32[465] | 0) == ($16 | 0)) {
          $105 = ($10 + 4) | 0;
          $106 = HEAP32[$105 >> 2] | 0;
          if ((($106 & 3) | 0) != 3) {
            $$1 = $16;
            $$1382 = $17;
            $113 = $16;
            break;
          }
          HEAP32[462] = $17;
          HEAP32[$105 >> 2] = $106 & -2;
          HEAP32[($16 + 4) >> 2] = $17 | 1;
          HEAP32[($16 + $17) >> 2] = $17;
          return;
        }
        $21 = $13 >>> 3;
        if ($13 >>> 0 < 256) {
          $24 = HEAP32[($16 + 8) >> 2] | 0;
          $26 = HEAP32[($16 + 12) >> 2] | 0;
          $28 = (1880 + (($21 << 1) << 2)) | 0;
          if (($24 | 0) != ($28 | 0)) {
            if ($3 >>> 0 > $24 >>> 0) _abort();
            if ((HEAP32[($24 + 12) >> 2] | 0) != ($16 | 0)) _abort();
          }
          if (($26 | 0) == ($24 | 0)) {
            HEAP32[460] = HEAP32[460] & ~(1 << $21);
            $$1 = $16;
            $$1382 = $17;
            $113 = $16;
            break;
          }
          if (($26 | 0) == ($28 | 0)) $$pre$phi444Z2D = ($26 + 8) | 0;
          else {
            if ($3 >>> 0 > $26 >>> 0) _abort();
            $41 = ($26 + 8) | 0;
            if ((HEAP32[$41 >> 2] | 0) == ($16 | 0)) $$pre$phi444Z2D = $41;
            else _abort();
          }
          HEAP32[($24 + 12) >> 2] = $26;
          HEAP32[$$pre$phi444Z2D >> 2] = $24;
          $$1 = $16;
          $$1382 = $17;
          $113 = $16;
          break;
        }
        $46 = HEAP32[($16 + 24) >> 2] | 0;
        $48 = HEAP32[($16 + 12) >> 2] | 0;
        do {
          if (($48 | 0) == ($16 | 0)) {
            $59 = ($16 + 16) | 0;
            $60 = ($59 + 4) | 0;
            $61 = HEAP32[$60 >> 2] | 0;
            if (!$61) {
              $63 = HEAP32[$59 >> 2] | 0;
              if (!$63) {
                $$3 = 0;
                break;
              } else {
                $$1387 = $63;
                $$1390 = $59;
              }
            } else {
              $$1387 = $61;
              $$1390 = $60;
            }
            while (1) {
              $65 = ($$1387 + 20) | 0;
              $66 = HEAP32[$65 >> 2] | 0;
              if ($66 | 0) {
                $$1387 = $66;
                $$1390 = $65;
                continue;
              }
              $68 = ($$1387 + 16) | 0;
              $69 = HEAP32[$68 >> 2] | 0;
              if (!$69) break;
              else {
                $$1387 = $69;
                $$1390 = $68;
              }
            }
            if ($3 >>> 0 > $$1390 >>> 0) _abort();
            else {
              HEAP32[$$1390 >> 2] = 0;
              $$3 = $$1387;
              break;
            }
          } else {
            $51 = HEAP32[($16 + 8) >> 2] | 0;
            if ($3 >>> 0 > $51 >>> 0) _abort();
            $53 = ($51 + 12) | 0;
            if ((HEAP32[$53 >> 2] | 0) != ($16 | 0)) _abort();
            $56 = ($48 + 8) | 0;
            if ((HEAP32[$56 >> 2] | 0) == ($16 | 0)) {
              HEAP32[$53 >> 2] = $48;
              HEAP32[$56 >> 2] = $51;
              $$3 = $48;
              break;
            } else _abort();
          }
        } while (0);
        if (!$46) {
          $$1 = $16;
          $$1382 = $17;
          $113 = $16;
        } else {
          $74 = HEAP32[($16 + 28) >> 2] | 0;
          $75 = (2144 + ($74 << 2)) | 0;
          do {
            if ((HEAP32[$75 >> 2] | 0) == ($16 | 0)) {
              HEAP32[$75 >> 2] = $$3;
              if (!$$3) {
                HEAP32[461] = HEAP32[461] & ~(1 << $74);
                $$1 = $16;
                $$1382 = $17;
                $113 = $16;
                break L10;
              }
            } else if ((HEAP32[464] | 0) >>> 0 > $46 >>> 0) _abort();
            else {
              HEAP32[
                ($46 +
                  16 +
                  ((((HEAP32[($46 + 16) >> 2] | 0) != ($16 | 0)) & 1) << 2)) >>
                  2
              ] = $$3;
              if (!$$3) {
                $$1 = $16;
                $$1382 = $17;
                $113 = $16;
                break L10;
              } else break;
            }
          } while (0);
          $89 = HEAP32[464] | 0;
          if ($89 >>> 0 > $$3 >>> 0) _abort();
          HEAP32[($$3 + 24) >> 2] = $46;
          $92 = ($16 + 16) | 0;
          $93 = HEAP32[$92 >> 2] | 0;
          do {
            if ($93 | 0)
              if ($89 >>> 0 > $93 >>> 0) _abort();
              else {
                HEAP32[($$3 + 16) >> 2] = $93;
                HEAP32[($93 + 24) >> 2] = $$3;
                break;
              }
          } while (0);
          $99 = HEAP32[($92 + 4) >> 2] | 0;
          if (!$99) {
            $$1 = $16;
            $$1382 = $17;
            $113 = $16;
          } else if ((HEAP32[464] | 0) >>> 0 > $99 >>> 0) _abort();
          else {
            HEAP32[($$3 + 20) >> 2] = $99;
            HEAP32[($99 + 24) >> 2] = $$3;
            $$1 = $16;
            $$1382 = $17;
            $113 = $16;
            break;
          }
        }
      } else {
        $$1 = $2;
        $$1382 = $9;
        $113 = $2;
      }
    } while (0);
    if ($113 >>> 0 >= $10 >>> 0) _abort();
    $115 = ($10 + 4) | 0;
    $116 = HEAP32[$115 >> 2] | 0;
    if (!($116 & 1)) _abort();
    if (!($116 & 2)) {
      if ((HEAP32[466] | 0) == ($10 | 0)) {
        $124 = ((HEAP32[463] | 0) + $$1382) | 0;
        HEAP32[463] = $124;
        HEAP32[466] = $$1;
        HEAP32[($$1 + 4) >> 2] = $124 | 1;
        if (($$1 | 0) != (HEAP32[465] | 0)) return;
        HEAP32[465] = 0;
        HEAP32[462] = 0;
        return;
      }
      if ((HEAP32[465] | 0) == ($10 | 0)) {
        $132 = ((HEAP32[462] | 0) + $$1382) | 0;
        HEAP32[462] = $132;
        HEAP32[465] = $113;
        HEAP32[($$1 + 4) >> 2] = $132 | 1;
        HEAP32[($113 + $132) >> 2] = $132;
        return;
      }
      $137 = (($116 & -8) + $$1382) | 0;
      $138 = $116 >>> 3;
      L108: do {
        if ($116 >>> 0 < 256) {
          $141 = HEAP32[($10 + 8) >> 2] | 0;
          $143 = HEAP32[($10 + 12) >> 2] | 0;
          $145 = (1880 + (($138 << 1) << 2)) | 0;
          if (($141 | 0) != ($145 | 0)) {
            if ((HEAP32[464] | 0) >>> 0 > $141 >>> 0) _abort();
            if ((HEAP32[($141 + 12) >> 2] | 0) != ($10 | 0)) _abort();
          }
          if (($143 | 0) == ($141 | 0)) {
            HEAP32[460] = HEAP32[460] & ~(1 << $138);
            break;
          }
          if (($143 | 0) == ($145 | 0)) $$pre$phi442Z2D = ($143 + 8) | 0;
          else {
            if ((HEAP32[464] | 0) >>> 0 > $143 >>> 0) _abort();
            $160 = ($143 + 8) | 0;
            if ((HEAP32[$160 >> 2] | 0) == ($10 | 0)) $$pre$phi442Z2D = $160;
            else _abort();
          }
          HEAP32[($141 + 12) >> 2] = $143;
          HEAP32[$$pre$phi442Z2D >> 2] = $141;
        } else {
          $165 = HEAP32[($10 + 24) >> 2] | 0;
          $167 = HEAP32[($10 + 12) >> 2] | 0;
          do {
            if (($167 | 0) == ($10 | 0)) {
              $179 = ($10 + 16) | 0;
              $180 = ($179 + 4) | 0;
              $181 = HEAP32[$180 >> 2] | 0;
              if (!$181) {
                $183 = HEAP32[$179 >> 2] | 0;
                if (!$183) {
                  $$3400 = 0;
                  break;
                } else {
                  $$1398 = $183;
                  $$1402 = $179;
                }
              } else {
                $$1398 = $181;
                $$1402 = $180;
              }
              while (1) {
                $185 = ($$1398 + 20) | 0;
                $186 = HEAP32[$185 >> 2] | 0;
                if ($186 | 0) {
                  $$1398 = $186;
                  $$1402 = $185;
                  continue;
                }
                $188 = ($$1398 + 16) | 0;
                $189 = HEAP32[$188 >> 2] | 0;
                if (!$189) break;
                else {
                  $$1398 = $189;
                  $$1402 = $188;
                }
              }
              if ((HEAP32[464] | 0) >>> 0 > $$1402 >>> 0) _abort();
              else {
                HEAP32[$$1402 >> 2] = 0;
                $$3400 = $$1398;
                break;
              }
            } else {
              $170 = HEAP32[($10 + 8) >> 2] | 0;
              if ((HEAP32[464] | 0) >>> 0 > $170 >>> 0) _abort();
              $173 = ($170 + 12) | 0;
              if ((HEAP32[$173 >> 2] | 0) != ($10 | 0)) _abort();
              $176 = ($167 + 8) | 0;
              if ((HEAP32[$176 >> 2] | 0) == ($10 | 0)) {
                HEAP32[$173 >> 2] = $167;
                HEAP32[$176 >> 2] = $170;
                $$3400 = $167;
                break;
              } else _abort();
            }
          } while (0);
          if ($165 | 0) {
            $195 = HEAP32[($10 + 28) >> 2] | 0;
            $196 = (2144 + ($195 << 2)) | 0;
            do {
              if ((HEAP32[$196 >> 2] | 0) == ($10 | 0)) {
                HEAP32[$196 >> 2] = $$3400;
                if (!$$3400) {
                  HEAP32[461] = HEAP32[461] & ~(1 << $195);
                  break L108;
                }
              } else if ((HEAP32[464] | 0) >>> 0 > $165 >>> 0) _abort();
              else {
                HEAP32[
                  ($165 +
                    16 +
                    ((((HEAP32[($165 + 16) >> 2] | 0) != ($10 | 0)) & 1) <<
                      2)) >>
                    2
                ] = $$3400;
                if (!$$3400) break L108;
                else break;
              }
            } while (0);
            $210 = HEAP32[464] | 0;
            if ($210 >>> 0 > $$3400 >>> 0) _abort();
            HEAP32[($$3400 + 24) >> 2] = $165;
            $213 = ($10 + 16) | 0;
            $214 = HEAP32[$213 >> 2] | 0;
            do {
              if ($214 | 0)
                if ($210 >>> 0 > $214 >>> 0) _abort();
                else {
                  HEAP32[($$3400 + 16) >> 2] = $214;
                  HEAP32[($214 + 24) >> 2] = $$3400;
                  break;
                }
            } while (0);
            $220 = HEAP32[($213 + 4) >> 2] | 0;
            if ($220 | 0)
              if ((HEAP32[464] | 0) >>> 0 > $220 >>> 0) _abort();
              else {
                HEAP32[($$3400 + 20) >> 2] = $220;
                HEAP32[($220 + 24) >> 2] = $$3400;
                break;
              }
          }
        }
      } while (0);
      HEAP32[($$1 + 4) >> 2] = $137 | 1;
      HEAP32[($113 + $137) >> 2] = $137;
      if (($$1 | 0) == (HEAP32[465] | 0)) {
        HEAP32[462] = $137;
        return;
      } else $$2 = $137;
    } else {
      HEAP32[$115 >> 2] = $116 & -2;
      HEAP32[($$1 + 4) >> 2] = $$1382 | 1;
      HEAP32[($113 + $$1382) >> 2] = $$1382;
      $$2 = $$1382;
    }
    $235 = $$2 >>> 3;
    if ($$2 >>> 0 < 256) {
      $238 = (1880 + (($235 << 1) << 2)) | 0;
      $239 = HEAP32[460] | 0;
      $240 = 1 << $235;
      if (!($239 & $240)) {
        HEAP32[460] = $239 | $240;
        $$0403 = $238;
        $$pre$phiZ2D = ($238 + 8) | 0;
      } else {
        $244 = ($238 + 8) | 0;
        $245 = HEAP32[$244 >> 2] | 0;
        if ((HEAP32[464] | 0) >>> 0 > $245 >>> 0) _abort();
        else {
          $$0403 = $245;
          $$pre$phiZ2D = $244;
        }
      }
      HEAP32[$$pre$phiZ2D >> 2] = $$1;
      HEAP32[($$0403 + 12) >> 2] = $$1;
      HEAP32[($$1 + 8) >> 2] = $$0403;
      HEAP32[($$1 + 12) >> 2] = $238;
      return;
    }
    $251 = $$2 >>> 8;
    if (!$251) $$0396 = 0;
    else if ($$2 >>> 0 > 16777215) $$0396 = 31;
    else {
      $256 = ((($251 + 1048320) | 0) >>> 16) & 8;
      $257 = $251 << $256;
      $260 = ((($257 + 520192) | 0) >>> 16) & 4;
      $262 = $257 << $260;
      $265 = ((($262 + 245760) | 0) >>> 16) & 2;
      $270 = (14 - ($260 | $256 | $265) + (($262 << $265) >>> 15)) | 0;
      $$0396 = (($$2 >>> (($270 + 7) | 0)) & 1) | ($270 << 1);
    }
    $276 = (2144 + ($$0396 << 2)) | 0;
    HEAP32[($$1 + 28) >> 2] = $$0396;
    HEAP32[($$1 + 20) >> 2] = 0;
    HEAP32[($$1 + 16) >> 2] = 0;
    $280 = HEAP32[461] | 0;
    $281 = 1 << $$0396;
    do {
      if (!($280 & $281)) {
        HEAP32[461] = $280 | $281;
        HEAP32[$276 >> 2] = $$1;
        HEAP32[($$1 + 24) >> 2] = $276;
        HEAP32[($$1 + 12) >> 2] = $$1;
        HEAP32[($$1 + 8) >> 2] = $$1;
      } else {
        $$0383 = $$2 << (($$0396 | 0) == 31 ? 0 : (25 - ($$0396 >>> 1)) | 0);
        $$0384 = HEAP32[$276 >> 2] | 0;
        while (1) {
          if (((HEAP32[($$0384 + 4) >> 2] & -8) | 0) == ($$2 | 0)) {
            label = 124;
            break;
          }
          $299 = ($$0384 + 16 + (($$0383 >>> 31) << 2)) | 0;
          $301 = HEAP32[$299 >> 2] | 0;
          if (!$301) {
            label = 121;
            break;
          } else {
            $$0383 = $$0383 << 1;
            $$0384 = $301;
          }
        }
        if ((label | 0) == 121)
          if ((HEAP32[464] | 0) >>> 0 > $299 >>> 0) _abort();
          else {
            HEAP32[$299 >> 2] = $$1;
            HEAP32[($$1 + 24) >> 2] = $$0384;
            HEAP32[($$1 + 12) >> 2] = $$1;
            HEAP32[($$1 + 8) >> 2] = $$1;
            break;
          }
        else if ((label | 0) == 124) {
          $308 = ($$0384 + 8) | 0;
          $309 = HEAP32[$308 >> 2] | 0;
          $310 = HEAP32[464] | 0;
          if (($310 >>> 0 <= $309 >>> 0) & ($310 >>> 0 <= $$0384 >>> 0)) {
            HEAP32[($309 + 12) >> 2] = $$1;
            HEAP32[$308 >> 2] = $$1;
            HEAP32[($$1 + 8) >> 2] = $309;
            HEAP32[($$1 + 12) >> 2] = $$0384;
            HEAP32[($$1 + 24) >> 2] = 0;
            break;
          } else _abort();
        }
      }
    } while (0);
    $319 = ((HEAP32[468] | 0) + -1) | 0;
    HEAP32[468] = $319;
    if (!$319) $$0212$in$i = 2296;
    else return;
    while (1) {
      $$0212$i = HEAP32[$$0212$in$i >> 2] | 0;
      if (!$$0212$i) break;
      else $$0212$in$i = ($$0212$i + 8) | 0;
    }
    HEAP32[468] = -1;
    return;
  }
  function _dispose_chunk($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$0419 = 0,
      $$0420 = 0,
      $$0431 = 0,
      $$0438 = 0,
      $$1 = 0,
      $$1418 = 0,
      $$1426 = 0,
      $$1429 = 0,
      $$1433 = 0,
      $$1437 = 0,
      $$2 = 0,
      $$3 = 0,
      $$3435 = 0,
      $$pre$phi23Z2D = 0,
      $$pre$phi25Z2D = 0,
      $$pre$phiZ2D = 0,
      $101 = 0,
      $102 = 0,
      $108 = 0,
      $11 = 0,
      $110 = 0,
      $111 = 0,
      $117 = 0,
      $12 = 0,
      $125 = 0,
      $13 = 0,
      $130 = 0,
      $131 = 0,
      $134 = 0,
      $136 = 0,
      $138 = 0,
      $151 = 0,
      $156 = 0,
      $158 = 0,
      $161 = 0,
      $163 = 0,
      $166 = 0,
      $169 = 0,
      $17 = 0,
      $170 = 0,
      $171 = 0,
      $173 = 0,
      $175 = 0,
      $176 = 0,
      $178 = 0,
      $179 = 0,
      $184 = 0,
      $185 = 0,
      $199 = 0,
      $2 = 0,
      $20 = 0,
      $202 = 0,
      $203 = 0,
      $209 = 0,
      $22 = 0,
      $224 = 0,
      $227 = 0,
      $228 = 0,
      $229 = 0,
      $233 = 0,
      $234 = 0,
      $24 = 0,
      $240 = 0,
      $245 = 0,
      $246 = 0,
      $249 = 0,
      $251 = 0,
      $254 = 0,
      $259 = 0,
      $265 = 0,
      $269 = 0,
      $270 = 0,
      $288 = 0,
      $290 = 0,
      $297 = 0,
      $298 = 0,
      $299 = 0,
      $37 = 0,
      $4 = 0,
      $42 = 0,
      $44 = 0,
      $47 = 0,
      $49 = 0,
      $52 = 0,
      $55 = 0,
      $56 = 0,
      $57 = 0,
      $59 = 0,
      $61 = 0,
      $62 = 0,
      $64 = 0,
      $65 = 0,
      $7 = 0,
      $70 = 0,
      $71 = 0,
      $85 = 0,
      $88 = 0,
      $89 = 0,
      $95 = 0,
      label = 0;
    $2 = ($0 + $1) | 0;
    $4 = HEAP32[($0 + 4) >> 2] | 0;
    L1: do {
      if (!($4 & 1)) {
        $7 = HEAP32[$0 >> 2] | 0;
        if (!($4 & 3)) return;
        $11 = ($0 + (0 - $7)) | 0;
        $12 = ($7 + $1) | 0;
        $13 = HEAP32[464] | 0;
        if ($11 >>> 0 < $13 >>> 0) _abort();
        if ((HEAP32[465] | 0) == ($11 | 0)) {
          $101 = ($2 + 4) | 0;
          $102 = HEAP32[$101 >> 2] | 0;
          if ((($102 & 3) | 0) != 3) {
            $$1 = $11;
            $$1418 = $12;
            break;
          }
          HEAP32[462] = $12;
          HEAP32[$101 >> 2] = $102 & -2;
          HEAP32[($11 + 4) >> 2] = $12 | 1;
          HEAP32[$2 >> 2] = $12;
          return;
        }
        $17 = $7 >>> 3;
        if ($7 >>> 0 < 256) {
          $20 = HEAP32[($11 + 8) >> 2] | 0;
          $22 = HEAP32[($11 + 12) >> 2] | 0;
          $24 = (1880 + (($17 << 1) << 2)) | 0;
          if (($20 | 0) != ($24 | 0)) {
            if ($13 >>> 0 > $20 >>> 0) _abort();
            if ((HEAP32[($20 + 12) >> 2] | 0) != ($11 | 0)) _abort();
          }
          if (($22 | 0) == ($20 | 0)) {
            HEAP32[460] = HEAP32[460] & ~(1 << $17);
            $$1 = $11;
            $$1418 = $12;
            break;
          }
          if (($22 | 0) == ($24 | 0)) $$pre$phi25Z2D = ($22 + 8) | 0;
          else {
            if ($13 >>> 0 > $22 >>> 0) _abort();
            $37 = ($22 + 8) | 0;
            if ((HEAP32[$37 >> 2] | 0) == ($11 | 0)) $$pre$phi25Z2D = $37;
            else _abort();
          }
          HEAP32[($20 + 12) >> 2] = $22;
          HEAP32[$$pre$phi25Z2D >> 2] = $20;
          $$1 = $11;
          $$1418 = $12;
          break;
        }
        $42 = HEAP32[($11 + 24) >> 2] | 0;
        $44 = HEAP32[($11 + 12) >> 2] | 0;
        do {
          if (($44 | 0) == ($11 | 0)) {
            $55 = ($11 + 16) | 0;
            $56 = ($55 + 4) | 0;
            $57 = HEAP32[$56 >> 2] | 0;
            if (!$57) {
              $59 = HEAP32[$55 >> 2] | 0;
              if (!$59) {
                $$3 = 0;
                break;
              } else {
                $$1426 = $59;
                $$1429 = $55;
              }
            } else {
              $$1426 = $57;
              $$1429 = $56;
            }
            while (1) {
              $61 = ($$1426 + 20) | 0;
              $62 = HEAP32[$61 >> 2] | 0;
              if ($62 | 0) {
                $$1426 = $62;
                $$1429 = $61;
                continue;
              }
              $64 = ($$1426 + 16) | 0;
              $65 = HEAP32[$64 >> 2] | 0;
              if (!$65) break;
              else {
                $$1426 = $65;
                $$1429 = $64;
              }
            }
            if ($13 >>> 0 > $$1429 >>> 0) _abort();
            else {
              HEAP32[$$1429 >> 2] = 0;
              $$3 = $$1426;
              break;
            }
          } else {
            $47 = HEAP32[($11 + 8) >> 2] | 0;
            if ($13 >>> 0 > $47 >>> 0) _abort();
            $49 = ($47 + 12) | 0;
            if ((HEAP32[$49 >> 2] | 0) != ($11 | 0)) _abort();
            $52 = ($44 + 8) | 0;
            if ((HEAP32[$52 >> 2] | 0) == ($11 | 0)) {
              HEAP32[$49 >> 2] = $44;
              HEAP32[$52 >> 2] = $47;
              $$3 = $44;
              break;
            } else _abort();
          }
        } while (0);
        if (!$42) {
          $$1 = $11;
          $$1418 = $12;
        } else {
          $70 = HEAP32[($11 + 28) >> 2] | 0;
          $71 = (2144 + ($70 << 2)) | 0;
          do {
            if ((HEAP32[$71 >> 2] | 0) == ($11 | 0)) {
              HEAP32[$71 >> 2] = $$3;
              if (!$$3) {
                HEAP32[461] = HEAP32[461] & ~(1 << $70);
                $$1 = $11;
                $$1418 = $12;
                break L1;
              }
            } else if ((HEAP32[464] | 0) >>> 0 > $42 >>> 0) _abort();
            else {
              HEAP32[
                ($42 +
                  16 +
                  ((((HEAP32[($42 + 16) >> 2] | 0) != ($11 | 0)) & 1) << 2)) >>
                  2
              ] = $$3;
              if (!$$3) {
                $$1 = $11;
                $$1418 = $12;
                break L1;
              } else break;
            }
          } while (0);
          $85 = HEAP32[464] | 0;
          if ($85 >>> 0 > $$3 >>> 0) _abort();
          HEAP32[($$3 + 24) >> 2] = $42;
          $88 = ($11 + 16) | 0;
          $89 = HEAP32[$88 >> 2] | 0;
          do {
            if ($89 | 0)
              if ($85 >>> 0 > $89 >>> 0) _abort();
              else {
                HEAP32[($$3 + 16) >> 2] = $89;
                HEAP32[($89 + 24) >> 2] = $$3;
                break;
              }
          } while (0);
          $95 = HEAP32[($88 + 4) >> 2] | 0;
          if (!$95) {
            $$1 = $11;
            $$1418 = $12;
          } else if ((HEAP32[464] | 0) >>> 0 > $95 >>> 0) _abort();
          else {
            HEAP32[($$3 + 20) >> 2] = $95;
            HEAP32[($95 + 24) >> 2] = $$3;
            $$1 = $11;
            $$1418 = $12;
            break;
          }
        }
      } else {
        $$1 = $0;
        $$1418 = $1;
      }
    } while (0);
    $108 = HEAP32[464] | 0;
    if ($2 >>> 0 < $108 >>> 0) _abort();
    $110 = ($2 + 4) | 0;
    $111 = HEAP32[$110 >> 2] | 0;
    if (!($111 & 2)) {
      if ((HEAP32[466] | 0) == ($2 | 0)) {
        $117 = ((HEAP32[463] | 0) + $$1418) | 0;
        HEAP32[463] = $117;
        HEAP32[466] = $$1;
        HEAP32[($$1 + 4) >> 2] = $117 | 1;
        if (($$1 | 0) != (HEAP32[465] | 0)) return;
        HEAP32[465] = 0;
        HEAP32[462] = 0;
        return;
      }
      if ((HEAP32[465] | 0) == ($2 | 0)) {
        $125 = ((HEAP32[462] | 0) + $$1418) | 0;
        HEAP32[462] = $125;
        HEAP32[465] = $$1;
        HEAP32[($$1 + 4) >> 2] = $125 | 1;
        HEAP32[($$1 + $125) >> 2] = $125;
        return;
      }
      $130 = (($111 & -8) + $$1418) | 0;
      $131 = $111 >>> 3;
      L96: do {
        if ($111 >>> 0 < 256) {
          $134 = HEAP32[($2 + 8) >> 2] | 0;
          $136 = HEAP32[($2 + 12) >> 2] | 0;
          $138 = (1880 + (($131 << 1) << 2)) | 0;
          if (($134 | 0) != ($138 | 0)) {
            if ($108 >>> 0 > $134 >>> 0) _abort();
            if ((HEAP32[($134 + 12) >> 2] | 0) != ($2 | 0)) _abort();
          }
          if (($136 | 0) == ($134 | 0)) {
            HEAP32[460] = HEAP32[460] & ~(1 << $131);
            break;
          }
          if (($136 | 0) == ($138 | 0)) $$pre$phi23Z2D = ($136 + 8) | 0;
          else {
            if ($108 >>> 0 > $136 >>> 0) _abort();
            $151 = ($136 + 8) | 0;
            if ((HEAP32[$151 >> 2] | 0) == ($2 | 0)) $$pre$phi23Z2D = $151;
            else _abort();
          }
          HEAP32[($134 + 12) >> 2] = $136;
          HEAP32[$$pre$phi23Z2D >> 2] = $134;
        } else {
          $156 = HEAP32[($2 + 24) >> 2] | 0;
          $158 = HEAP32[($2 + 12) >> 2] | 0;
          do {
            if (($158 | 0) == ($2 | 0)) {
              $169 = ($2 + 16) | 0;
              $170 = ($169 + 4) | 0;
              $171 = HEAP32[$170 >> 2] | 0;
              if (!$171) {
                $173 = HEAP32[$169 >> 2] | 0;
                if (!$173) {
                  $$3435 = 0;
                  break;
                } else {
                  $$1433 = $173;
                  $$1437 = $169;
                }
              } else {
                $$1433 = $171;
                $$1437 = $170;
              }
              while (1) {
                $175 = ($$1433 + 20) | 0;
                $176 = HEAP32[$175 >> 2] | 0;
                if ($176 | 0) {
                  $$1433 = $176;
                  $$1437 = $175;
                  continue;
                }
                $178 = ($$1433 + 16) | 0;
                $179 = HEAP32[$178 >> 2] | 0;
                if (!$179) break;
                else {
                  $$1433 = $179;
                  $$1437 = $178;
                }
              }
              if ($108 >>> 0 > $$1437 >>> 0) _abort();
              else {
                HEAP32[$$1437 >> 2] = 0;
                $$3435 = $$1433;
                break;
              }
            } else {
              $161 = HEAP32[($2 + 8) >> 2] | 0;
              if ($108 >>> 0 > $161 >>> 0) _abort();
              $163 = ($161 + 12) | 0;
              if ((HEAP32[$163 >> 2] | 0) != ($2 | 0)) _abort();
              $166 = ($158 + 8) | 0;
              if ((HEAP32[$166 >> 2] | 0) == ($2 | 0)) {
                HEAP32[$163 >> 2] = $158;
                HEAP32[$166 >> 2] = $161;
                $$3435 = $158;
                break;
              } else _abort();
            }
          } while (0);
          if ($156 | 0) {
            $184 = HEAP32[($2 + 28) >> 2] | 0;
            $185 = (2144 + ($184 << 2)) | 0;
            do {
              if ((HEAP32[$185 >> 2] | 0) == ($2 | 0)) {
                HEAP32[$185 >> 2] = $$3435;
                if (!$$3435) {
                  HEAP32[461] = HEAP32[461] & ~(1 << $184);
                  break L96;
                }
              } else if ((HEAP32[464] | 0) >>> 0 > $156 >>> 0) _abort();
              else {
                HEAP32[
                  ($156 +
                    16 +
                    ((((HEAP32[($156 + 16) >> 2] | 0) != ($2 | 0)) & 1) <<
                      2)) >>
                    2
                ] = $$3435;
                if (!$$3435) break L96;
                else break;
              }
            } while (0);
            $199 = HEAP32[464] | 0;
            if ($199 >>> 0 > $$3435 >>> 0) _abort();
            HEAP32[($$3435 + 24) >> 2] = $156;
            $202 = ($2 + 16) | 0;
            $203 = HEAP32[$202 >> 2] | 0;
            do {
              if ($203 | 0)
                if ($199 >>> 0 > $203 >>> 0) _abort();
                else {
                  HEAP32[($$3435 + 16) >> 2] = $203;
                  HEAP32[($203 + 24) >> 2] = $$3435;
                  break;
                }
            } while (0);
            $209 = HEAP32[($202 + 4) >> 2] | 0;
            if ($209 | 0)
              if ((HEAP32[464] | 0) >>> 0 > $209 >>> 0) _abort();
              else {
                HEAP32[($$3435 + 20) >> 2] = $209;
                HEAP32[($209 + 24) >> 2] = $$3435;
                break;
              }
          }
        }
      } while (0);
      HEAP32[($$1 + 4) >> 2] = $130 | 1;
      HEAP32[($$1 + $130) >> 2] = $130;
      if (($$1 | 0) == (HEAP32[465] | 0)) {
        HEAP32[462] = $130;
        return;
      } else $$2 = $130;
    } else {
      HEAP32[$110 >> 2] = $111 & -2;
      HEAP32[($$1 + 4) >> 2] = $$1418 | 1;
      HEAP32[($$1 + $$1418) >> 2] = $$1418;
      $$2 = $$1418;
    }
    $224 = $$2 >>> 3;
    if ($$2 >>> 0 < 256) {
      $227 = (1880 + (($224 << 1) << 2)) | 0;
      $228 = HEAP32[460] | 0;
      $229 = 1 << $224;
      if (!($228 & $229)) {
        HEAP32[460] = $228 | $229;
        $$0438 = $227;
        $$pre$phiZ2D = ($227 + 8) | 0;
      } else {
        $233 = ($227 + 8) | 0;
        $234 = HEAP32[$233 >> 2] | 0;
        if ((HEAP32[464] | 0) >>> 0 > $234 >>> 0) _abort();
        else {
          $$0438 = $234;
          $$pre$phiZ2D = $233;
        }
      }
      HEAP32[$$pre$phiZ2D >> 2] = $$1;
      HEAP32[($$0438 + 12) >> 2] = $$1;
      HEAP32[($$1 + 8) >> 2] = $$0438;
      HEAP32[($$1 + 12) >> 2] = $227;
      return;
    }
    $240 = $$2 >>> 8;
    if (!$240) $$0431 = 0;
    else if ($$2 >>> 0 > 16777215) $$0431 = 31;
    else {
      $245 = ((($240 + 1048320) | 0) >>> 16) & 8;
      $246 = $240 << $245;
      $249 = ((($246 + 520192) | 0) >>> 16) & 4;
      $251 = $246 << $249;
      $254 = ((($251 + 245760) | 0) >>> 16) & 2;
      $259 = (14 - ($249 | $245 | $254) + (($251 << $254) >>> 15)) | 0;
      $$0431 = (($$2 >>> (($259 + 7) | 0)) & 1) | ($259 << 1);
    }
    $265 = (2144 + ($$0431 << 2)) | 0;
    HEAP32[($$1 + 28) >> 2] = $$0431;
    HEAP32[($$1 + 20) >> 2] = 0;
    HEAP32[($$1 + 16) >> 2] = 0;
    $269 = HEAP32[461] | 0;
    $270 = 1 << $$0431;
    if (!($269 & $270)) {
      HEAP32[461] = $269 | $270;
      HEAP32[$265 >> 2] = $$1;
      HEAP32[($$1 + 24) >> 2] = $265;
      HEAP32[($$1 + 12) >> 2] = $$1;
      HEAP32[($$1 + 8) >> 2] = $$1;
      return;
    }
    $$0419 = $$2 << (($$0431 | 0) == 31 ? 0 : (25 - ($$0431 >>> 1)) | 0);
    $$0420 = HEAP32[$265 >> 2] | 0;
    while (1) {
      if (((HEAP32[($$0420 + 4) >> 2] & -8) | 0) == ($$2 | 0)) {
        label = 121;
        break;
      }
      $288 = ($$0420 + 16 + (($$0419 >>> 31) << 2)) | 0;
      $290 = HEAP32[$288 >> 2] | 0;
      if (!$290) {
        label = 118;
        break;
      } else {
        $$0419 = $$0419 << 1;
        $$0420 = $290;
      }
    }
    if ((label | 0) == 118) {
      if ((HEAP32[464] | 0) >>> 0 > $288 >>> 0) _abort();
      HEAP32[$288 >> 2] = $$1;
      HEAP32[($$1 + 24) >> 2] = $$0420;
      HEAP32[($$1 + 12) >> 2] = $$1;
      HEAP32[($$1 + 8) >> 2] = $$1;
      return;
    } else if ((label | 0) == 121) {
      $297 = ($$0420 + 8) | 0;
      $298 = HEAP32[$297 >> 2] | 0;
      $299 = HEAP32[464] | 0;
      if (!(($299 >>> 0 <= $298 >>> 0) & ($299 >>> 0 <= $$0420 >>> 0)))
        _abort();
      HEAP32[($298 + 12) >> 2] = $$1;
      HEAP32[$297 >> 2] = $$1;
      HEAP32[($$1 + 8) >> 2] = $298;
      HEAP32[($$1 + 12) >> 2] = $$0420;
      HEAP32[($$1 + 24) >> 2] = 0;
      return;
    }
  }
  function _try_realloc_chunk($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$1272 = 0,
      $$1275 = 0,
      $$2 = 0,
      $$3 = 0,
      $$pre$phiZ2D = 0,
      $101 = 0,
      $103 = 0,
      $106 = 0,
      $108 = 0,
      $11 = 0,
      $111 = 0,
      $114 = 0,
      $115 = 0,
      $116 = 0,
      $118 = 0,
      $12 = 0,
      $120 = 0,
      $121 = 0,
      $123 = 0,
      $124 = 0,
      $129 = 0,
      $130 = 0,
      $144 = 0,
      $147 = 0,
      $148 = 0,
      $154 = 0,
      $165 = 0,
      $168 = 0,
      $175 = 0,
      $2 = 0,
      $24 = 0,
      $26 = 0,
      $3 = 0,
      $37 = 0,
      $39 = 0,
      $4 = 0,
      $40 = 0,
      $49 = 0,
      $5 = 0,
      $51 = 0,
      $53 = 0,
      $54 = 0,
      $6 = 0,
      $60 = 0,
      $67 = 0,
      $73 = 0,
      $75 = 0,
      $76 = 0,
      $79 = 0,
      $8 = 0,
      $81 = 0,
      $83 = 0,
      $96 = 0,
      $storemerge = 0,
      $storemerge4 = 0;
    $2 = ($0 + 4) | 0;
    $3 = HEAP32[$2 >> 2] | 0;
    $4 = $3 & -8;
    $5 = ($0 + $4) | 0;
    $6 = HEAP32[464] | 0;
    $8 = $3 & 3;
    if (!((($8 | 0) != 1) & ($6 >>> 0 <= $0 >>> 0) & ($5 >>> 0 > $0 >>> 0)))
      _abort();
    $11 = ($5 + 4) | 0;
    $12 = HEAP32[$11 >> 2] | 0;
    if (!($12 & 1)) _abort();
    if (!$8) {
      if ($1 >>> 0 < 256) {
        $$2 = 0;
        return $$2 | 0;
      }
      if ($4 >>> 0 >= (($1 + 4) | 0) >>> 0)
        if ((($4 - $1) | 0) >>> 0 <= (HEAP32[580] << 1) >>> 0) {
          $$2 = $0;
          return $$2 | 0;
        }
      $$2 = 0;
      return $$2 | 0;
    }
    if ($4 >>> 0 >= $1 >>> 0) {
      $24 = ($4 - $1) | 0;
      if ($24 >>> 0 <= 15) {
        $$2 = $0;
        return $$2 | 0;
      }
      $26 = ($0 + $1) | 0;
      HEAP32[$2 >> 2] = ($3 & 1) | $1 | 2;
      HEAP32[($26 + 4) >> 2] = $24 | 3;
      HEAP32[$11 >> 2] = HEAP32[$11 >> 2] | 1;
      _dispose_chunk($26, $24);
      $$2 = $0;
      return $$2 | 0;
    }
    if ((HEAP32[466] | 0) == ($5 | 0)) {
      $37 = ((HEAP32[463] | 0) + $4) | 0;
      $39 = ($37 - $1) | 0;
      $40 = ($0 + $1) | 0;
      if ($37 >>> 0 <= $1 >>> 0) {
        $$2 = 0;
        return $$2 | 0;
      }
      HEAP32[$2 >> 2] = ($3 & 1) | $1 | 2;
      HEAP32[($40 + 4) >> 2] = $39 | 1;
      HEAP32[466] = $40;
      HEAP32[463] = $39;
      $$2 = $0;
      return $$2 | 0;
    }
    if ((HEAP32[465] | 0) == ($5 | 0)) {
      $49 = ((HEAP32[462] | 0) + $4) | 0;
      if ($49 >>> 0 < $1 >>> 0) {
        $$2 = 0;
        return $$2 | 0;
      }
      $51 = ($49 - $1) | 0;
      if ($51 >>> 0 > 15) {
        $53 = ($0 + $1) | 0;
        $54 = ($0 + $49) | 0;
        HEAP32[$2 >> 2] = ($3 & 1) | $1 | 2;
        HEAP32[($53 + 4) >> 2] = $51 | 1;
        HEAP32[$54 >> 2] = $51;
        $60 = ($54 + 4) | 0;
        HEAP32[$60 >> 2] = HEAP32[$60 >> 2] & -2;
        $storemerge = $53;
        $storemerge4 = $51;
      } else {
        HEAP32[$2 >> 2] = ($3 & 1) | $49 | 2;
        $67 = ($0 + $49 + 4) | 0;
        HEAP32[$67 >> 2] = HEAP32[$67 >> 2] | 1;
        $storemerge = 0;
        $storemerge4 = 0;
      }
      HEAP32[462] = $storemerge4;
      HEAP32[465] = $storemerge;
      $$2 = $0;
      return $$2 | 0;
    }
    if (($12 & 2) | 0) {
      $$2 = 0;
      return $$2 | 0;
    }
    $73 = (($12 & -8) + $4) | 0;
    if ($73 >>> 0 < $1 >>> 0) {
      $$2 = 0;
      return $$2 | 0;
    }
    $75 = ($73 - $1) | 0;
    $76 = $12 >>> 3;
    L49: do {
      if ($12 >>> 0 < 256) {
        $79 = HEAP32[($5 + 8) >> 2] | 0;
        $81 = HEAP32[($5 + 12) >> 2] | 0;
        $83 = (1880 + (($76 << 1) << 2)) | 0;
        if (($79 | 0) != ($83 | 0)) {
          if ($6 >>> 0 > $79 >>> 0) _abort();
          if ((HEAP32[($79 + 12) >> 2] | 0) != ($5 | 0)) _abort();
        }
        if (($81 | 0) == ($79 | 0)) {
          HEAP32[460] = HEAP32[460] & ~(1 << $76);
          break;
        }
        if (($81 | 0) == ($83 | 0)) $$pre$phiZ2D = ($81 + 8) | 0;
        else {
          if ($6 >>> 0 > $81 >>> 0) _abort();
          $96 = ($81 + 8) | 0;
          if ((HEAP32[$96 >> 2] | 0) == ($5 | 0)) $$pre$phiZ2D = $96;
          else _abort();
        }
        HEAP32[($79 + 12) >> 2] = $81;
        HEAP32[$$pre$phiZ2D >> 2] = $79;
      } else {
        $101 = HEAP32[($5 + 24) >> 2] | 0;
        $103 = HEAP32[($5 + 12) >> 2] | 0;
        do {
          if (($103 | 0) == ($5 | 0)) {
            $114 = ($5 + 16) | 0;
            $115 = ($114 + 4) | 0;
            $116 = HEAP32[$115 >> 2] | 0;
            if (!$116) {
              $118 = HEAP32[$114 >> 2] | 0;
              if (!$118) {
                $$3 = 0;
                break;
              } else {
                $$1272 = $118;
                $$1275 = $114;
              }
            } else {
              $$1272 = $116;
              $$1275 = $115;
            }
            while (1) {
              $120 = ($$1272 + 20) | 0;
              $121 = HEAP32[$120 >> 2] | 0;
              if ($121 | 0) {
                $$1272 = $121;
                $$1275 = $120;
                continue;
              }
              $123 = ($$1272 + 16) | 0;
              $124 = HEAP32[$123 >> 2] | 0;
              if (!$124) break;
              else {
                $$1272 = $124;
                $$1275 = $123;
              }
            }
            if ($6 >>> 0 > $$1275 >>> 0) _abort();
            else {
              HEAP32[$$1275 >> 2] = 0;
              $$3 = $$1272;
              break;
            }
          } else {
            $106 = HEAP32[($5 + 8) >> 2] | 0;
            if ($6 >>> 0 > $106 >>> 0) _abort();
            $108 = ($106 + 12) | 0;
            if ((HEAP32[$108 >> 2] | 0) != ($5 | 0)) _abort();
            $111 = ($103 + 8) | 0;
            if ((HEAP32[$111 >> 2] | 0) == ($5 | 0)) {
              HEAP32[$108 >> 2] = $103;
              HEAP32[$111 >> 2] = $106;
              $$3 = $103;
              break;
            } else _abort();
          }
        } while (0);
        if ($101 | 0) {
          $129 = HEAP32[($5 + 28) >> 2] | 0;
          $130 = (2144 + ($129 << 2)) | 0;
          do {
            if ((HEAP32[$130 >> 2] | 0) == ($5 | 0)) {
              HEAP32[$130 >> 2] = $$3;
              if (!$$3) {
                HEAP32[461] = HEAP32[461] & ~(1 << $129);
                break L49;
              }
            } else if ((HEAP32[464] | 0) >>> 0 > $101 >>> 0) _abort();
            else {
              HEAP32[
                ($101 +
                  16 +
                  ((((HEAP32[($101 + 16) >> 2] | 0) != ($5 | 0)) & 1) << 2)) >>
                  2
              ] = $$3;
              if (!$$3) break L49;
              else break;
            }
          } while (0);
          $144 = HEAP32[464] | 0;
          if ($144 >>> 0 > $$3 >>> 0) _abort();
          HEAP32[($$3 + 24) >> 2] = $101;
          $147 = ($5 + 16) | 0;
          $148 = HEAP32[$147 >> 2] | 0;
          do {
            if ($148 | 0)
              if ($144 >>> 0 > $148 >>> 0) _abort();
              else {
                HEAP32[($$3 + 16) >> 2] = $148;
                HEAP32[($148 + 24) >> 2] = $$3;
                break;
              }
          } while (0);
          $154 = HEAP32[($147 + 4) >> 2] | 0;
          if ($154 | 0)
            if ((HEAP32[464] | 0) >>> 0 > $154 >>> 0) _abort();
            else {
              HEAP32[($$3 + 20) >> 2] = $154;
              HEAP32[($154 + 24) >> 2] = $$3;
              break;
            }
        }
      }
    } while (0);
    if ($75 >>> 0 < 16) {
      HEAP32[$2 >> 2] = $73 | ($3 & 1) | 2;
      $165 = ($0 + $73 + 4) | 0;
      HEAP32[$165 >> 2] = HEAP32[$165 >> 2] | 1;
      $$2 = $0;
      return $$2 | 0;
    } else {
      $168 = ($0 + $1) | 0;
      HEAP32[$2 >> 2] = ($3 & 1) | $1 | 2;
      HEAP32[($168 + 4) >> 2] = $75 | 3;
      $175 = ($0 + $73 + 4) | 0;
      HEAP32[$175 >> 2] = HEAP32[$175 >> 2] | 1;
      _dispose_chunk($168, $75);
      $$2 = $0;
      return $$2 | 0;
    }
    return 0;
  }
  function _codebook_decode_deinterleave_repeat(
    $0,
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7
  ) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    $6 = $6 | 0;
    $7 = $7 | 0;
    var $$$1115 = 0,
      $$$3117 = 0,
      $$0100145 = 0,
      $$0102$lcssa = 0,
      $$0102144 = 0,
      $$0105133 = 0,
      $$0107143 = 0,
      $$0112132 = 0,
      $$0114$lcssa = 0,
      $$0114142 = 0,
      $$1103134 = 0,
      $$1111 = 0,
      $$1113137 = 0,
      $$1115131 = 0,
      $$122 = 0,
      $$123 = 0,
      $$2 = 0,
      $$3117136 = 0,
      $$3138 = 0,
      $$5 = 0,
      $$5119 = 0,
      $10 = 0,
      $15 = 0,
      $16 = 0,
      $17 = 0,
      $18 = 0,
      $19 = 0,
      $20 = 0,
      $21 = 0,
      $22 = 0,
      $25 = 0,
      $28 = 0,
      $29 = 0,
      $34 = 0,
      $37 = 0,
      $38 = 0,
      $51 = 0,
      $58 = 0,
      $61 = 0,
      $62 = 0,
      $68 = 0,
      $70 = 0,
      $73 = 0,
      $74 = 0,
      $78 = 0,
      $8 = 0,
      $85 = 0,
      $88 = 0,
      $89 = 0,
      $9 = 0,
      label = 0;
    $8 = HEAP32[$4 >> 2] | 0;
    $9 = HEAP32[$5 >> 2] | 0;
    $10 = HEAP32[$1 >> 2] | 0;
    L1: do {
      if (!(HEAP8[($1 + 21) >> 0] | 0)) {
        _error($0, 21);
        $$2 = 0;
      } else {
        L4: do {
          if (($7 | 0) > 0) {
            $15 = ($0 + 1384) | 0;
            $16 = ($0 + 1380) | 0;
            $17 = ($1 + 8) | 0;
            $18 = ($1 + 23) | 0;
            $19 = Math_imul($6, $3) | 0;
            $20 = ($1 + 22) | 0;
            $21 = ($1 + 28) | 0;
            $22 = ($1 + 2092) | 0;
            $$0100145 = $7;
            $$0102144 = $8;
            $$0107143 = $10;
            $$0114142 = $9;
            while (1) {
              if ((HEAP32[$15 >> 2] | 0) < 10) _prep_huffman($0);
              $25 = HEAP32[$16 >> 2] | 0;
              $28 = HEAP16[($1 + 36 + (($25 & 1023) << 1)) >> 1] | 0;
              $29 = ($28 << 16) >> 16;
              if (($28 << 16) >> 16 > -1) {
                $34 = HEAPU8[((HEAP32[$17 >> 2] | 0) + $29) >> 0] | 0;
                HEAP32[$16 >> 2] = $25 >>> $34;
                $37 = ((HEAP32[$15 >> 2] | 0) - $34) | 0;
                $38 = ($37 | 0) < 0;
                HEAP32[$15 >> 2] = $38 ? 0 : $37;
                $$1111 = $38 ? -1 : $29;
              } else $$1111 = _codebook_decode_scalar_raw($0, $1) | 0;
              if (HEAP8[$18 >> 0] | 0)
                if (($$1111 | 0) >= (HEAP32[$22 >> 2] | 0)) {
                  label = 12;
                  break;
                }
              if (($$1111 | 0) < 0) break;
              $51 = Math_imul($$0114142, $3) | 0;
              $$0107143 =
                (($$0107143 + $51 + $$0102144) | 0) > ($19 | 0)
                  ? ($19 - $51 + $$0102144) | 0
                  : $$0107143;
              $58 = Math_imul(HEAP32[$1 >> 2] | 0, $$1111) | 0;
              $61 = ($$0107143 | 0) > 0;
              if (!(HEAP8[$20 >> 0] | 0))
                if ($61) {
                  $$1113137 = 0;
                  $$3117136 = $$0114142;
                  $$3138 = $$0102144;
                  while (1) {
                    $78 = HEAP32[($2 + ($$3138 << 2)) >> 2] | 0;
                    if ($78 | 0) {
                      $85 = ($78 + ($$3117136 << 2)) | 0;
                      HEAPF32[$85 >> 2] =
                        +HEAPF32[$85 >> 2] +
                        (+HEAPF32[
                          ((HEAP32[$21 >> 2] | 0) + (($$1113137 + $58) << 2)) >>
                            2
                        ] +
                          0);
                    }
                    $88 = ($$3138 + 1) | 0;
                    $89 = ($88 | 0) == ($3 | 0);
                    $$$3117 = ($$3117136 + ($89 & 1)) | 0;
                    $$123 = $89 ? 0 : $88;
                    $$1113137 = ($$1113137 + 1) | 0;
                    if (($$1113137 | 0) == ($$0107143 | 0)) {
                      $$5 = $$123;
                      $$5119 = $$$3117;
                      break;
                    } else {
                      $$3117136 = $$$3117;
                      $$3138 = $$123;
                    }
                  }
                } else {
                  $$5 = $$0102144;
                  $$5119 = $$0114142;
                }
              else if ($61) {
                $62 = HEAP32[$21 >> 2] | 0;
                $$0105133 = 0;
                $$0112132 = 0;
                $$1103134 = $$0102144;
                $$1115131 = $$0114142;
                while (1) {
                  $$0105133 =
                    $$0105133 + +HEAPF32[($62 + (($$0112132 + $58) << 2)) >> 2];
                  $68 = HEAP32[($2 + ($$1103134 << 2)) >> 2] | 0;
                  $70 = ($68 + ($$1115131 << 2)) | 0;
                  if ($68 | 0)
                    HEAPF32[$70 >> 2] = $$0105133 + +HEAPF32[$70 >> 2];
                  $73 = ($$1103134 + 1) | 0;
                  $74 = ($73 | 0) == ($3 | 0);
                  $$$1115 = ($$1115131 + ($74 & 1)) | 0;
                  $$122 = $74 ? 0 : $73;
                  $$0112132 = ($$0112132 + 1) | 0;
                  if (($$0112132 | 0) == ($$0107143 | 0)) {
                    $$5 = $$122;
                    $$5119 = $$$1115;
                    break;
                  } else {
                    $$1103134 = $$122;
                    $$1115131 = $$$1115;
                  }
                }
              } else {
                $$5 = $$0102144;
                $$5119 = $$0114142;
              }
              $$0100145 = ($$0100145 - $$0107143) | 0;
              if (($$0100145 | 0) <= 0) {
                $$0102$lcssa = $$5;
                $$0114$lcssa = $$5119;
                break L4;
              } else {
                $$0102144 = $$5;
                $$0114142 = $$5119;
              }
            }
            if ((label | 0) == 12) ___assert_fail(1295, 1052, 1822, 1331);
            if (!(HEAP8[($0 + 1364) >> 0] | 0))
              if (HEAP32[($0 + 1372) >> 2] | 0) {
                $$2 = 0;
                break L1;
              }
            _error($0, 21);
            $$2 = 0;
            break L1;
          } else {
            $$0102$lcssa = $8;
            $$0114$lcssa = $9;
          }
        } while (0);
        HEAP32[$4 >> 2] = $$0102$lcssa;
        HEAP32[$5 >> 2] = $$0114$lcssa;
        $$2 = 1;
      }
    } while (0);
    return $$2 | 0;
  }
  function _is_whole_packet_present($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$068$lcssa = 0,
      $$06890 = 0,
      $$07289 = 0,
      $$078 = 0,
      $$078$ph = 0,
      $$173 = 0,
      $$2 = 0,
      $$270 = 0,
      $$270$ph = 0,
      $$274 = 0,
      $$274$ph = 0,
      $$3$lcssa = 0,
      $$37583 = 0,
      $$384 = 0,
      $$476 = 0,
      $$pre$phiZ2D = 0,
      $11 = 0,
      $13 = 0,
      $15 = 0,
      $21 = 0,
      $24 = 0,
      $25 = 0,
      $27 = 0,
      $28 = 0,
      $3 = 0,
      $46 = 0,
      $47 = 0,
      $48 = 0,
      $49 = 0,
      $5 = 0,
      $53 = 0,
      $55 = 0,
      $57 = 0,
      $8 = 0,
      label = 0;
    $3 = HEAP32[($0 + 1368) >> 2] | 0;
    $5 = HEAP32[($0 + 20) >> 2] | 0;
    do {
      if (($3 | 0) == -1) {
        $$078$ph = 1;
        $$270$ph = -1;
        $$274$ph = $5;
        $$pre$phiZ2D = ($0 + 28) | 0;
        label = 9;
      } else {
        $8 = HEAP32[($0 + 1104) >> 2] | 0;
        L4: do {
          if (($3 | 0) < ($8 | 0)) {
            $$06890 = $3;
            $$07289 = $5;
            while (1) {
              $11 = HEAP8[($0 + 1108 + $$06890) >> 0] | 0;
              $13 = ($$07289 + ($11 & 255)) | 0;
              if (($11 << 24) >> 24 != -1) {
                $$068$lcssa = $$06890;
                $$173 = $13;
                break L4;
              }
              $15 = ($$06890 + 1) | 0;
              if (($15 | 0) < ($8 | 0)) {
                $$06890 = $15;
                $$07289 = $13;
              } else {
                $$068$lcssa = $15;
                $$173 = $13;
                break;
              }
            }
          } else {
            $$068$lcssa = $3;
            $$173 = $5;
          }
        } while (0);
        if ((($1 | 0) != 0) & (($$068$lcssa | 0) < (($8 + -1) | 0))) {
          _error($0, 21);
          $$2 = 0;
          break;
        }
        $21 = ($0 + 28) | 0;
        if ($$173 >>> 0 > (HEAP32[$21 >> 2] | 0) >>> 0) {
          _error($0, 1);
          $$2 = 0;
        } else {
          $$078$ph = 0;
          $$270$ph = ($$068$lcssa | 0) == ($8 | 0) ? -1 : $$068$lcssa;
          $$274$ph = $$173;
          $$pre$phiZ2D = $21;
          label = 9;
        }
      }
    } while (0);
    L13: do {
      if ((label | 0) == 9) {
        $24 = ($1 | 0) != 0;
        $25 = ($0 + 980) | 0;
        $$078 = $$078$ph;
        $$270 = $$270$ph;
        $$274 = $$274$ph;
        while (1) {
          if (($$270 | 0) != -1) {
            $$2 = 1;
            break L13;
          }
          $27 = ($$274 + 26) | 0;
          $28 = HEAP32[$$pre$phiZ2D >> 2] | 0;
          if ($27 >>> 0 >= $28 >>> 0) {
            label = 13;
            break;
          }
          if (_memcmp($$274, 8, 4) | 0) {
            label = 15;
            break;
          }
          if (HEAP8[($$274 + 4) >> 0] | 0) {
            label = 17;
            break;
          }
          if (!$$078) {
            if (!(HEAP8[($$274 + 5) >> 0] & 1)) {
              label = 23;
              break;
            }
          } else if (HEAP32[$25 >> 2] | 0)
            if (HEAP8[($$274 + 5) >> 0] & 1) {
              label = 21;
              break;
            }
          $46 = HEAP8[$27 >> 0] | 0;
          $47 = $46 & 255;
          $48 = ($$274 + 27) | 0;
          $49 = ($48 + $47) | 0;
          if ($49 >>> 0 > $28 >>> 0) {
            label = 26;
            break;
          }
          L27: do {
            if (!(($46 << 24) >> 24)) {
              $$3$lcssa = 0;
              $$476 = $49;
            } else {
              $$37583 = $49;
              $$384 = 0;
              while (1) {
                $53 = HEAP8[($48 + $$384) >> 0] | 0;
                $55 = ($$37583 + ($53 & 255)) | 0;
                if (($53 << 24) >> 24 != -1) {
                  $$3$lcssa = $$384;
                  $$476 = $55;
                  break L27;
                }
                $57 = ($$384 + 1) | 0;
                if (($57 | 0) < ($47 | 0)) {
                  $$37583 = $55;
                  $$384 = $57;
                } else {
                  $$3$lcssa = $57;
                  $$476 = $55;
                  break;
                }
              }
            }
          } while (0);
          if ($24 & (($$3$lcssa | 0) < (($47 + -1) | 0))) {
            label = 30;
            break;
          }
          if ($$476 >>> 0 > $28 >>> 0) {
            label = 32;
            break;
          } else {
            $$078 = 0;
            $$270 = ($$3$lcssa | 0) == ($47 | 0) ? -1 : $$3$lcssa;
            $$274 = $$476;
          }
        }
        if ((label | 0) == 13) {
          _error($0, 1);
          $$2 = 0;
          break;
        } else if ((label | 0) == 15) {
          _error($0, 21);
          $$2 = 0;
          break;
        } else if ((label | 0) == 17) {
          _error($0, 21);
          $$2 = 0;
          break;
        } else if ((label | 0) == 21) {
          _error($0, 21);
          $$2 = 0;
          break;
        } else if ((label | 0) == 23) {
          _error($0, 21);
          $$2 = 0;
          break;
        } else if ((label | 0) == 26) {
          _error($0, 1);
          $$2 = 0;
          break;
        } else if ((label | 0) == 30) {
          _error($0, 21);
          $$2 = 0;
          break;
        } else if ((label | 0) == 32) {
          _error($0, 1);
          $$2 = 0;
          break;
        }
      }
    } while (0);
    return $$2 | 0;
  }
  function _vorbis_deinit($0) {
    $0 = $0 | 0;
    var $$0100 = 0,
      $$08296 = 0,
      $$193 = 0,
      $$291 = 0,
      $$390 = 0,
      $$489 = 0,
      $$lcssa = 0,
      $$lcssa88 = 0,
      $1 = 0,
      $10 = 0,
      $13 = 0,
      $2 = 0,
      $20 = 0,
      $29 = 0,
      $32 = 0,
      $35 = 0,
      $36 = 0,
      $38 = 0,
      $4 = 0,
      $42 = 0,
      $51 = 0,
      $55 = 0,
      $58 = 0,
      $62 = 0,
      $63 = 0,
      $65 = 0,
      $69 = 0,
      $7 = 0,
      $74 = 0,
      $75 = 0,
      $8 = 0,
      $9 = 0,
      $$390$looptemp = 0;
    $1 = ($0 + 384) | 0;
    $2 = HEAP32[$1 >> 2] | 0;
    L1: do {
      if ($2 | 0) {
        $4 = ($0 + 252) | 0;
        if ((HEAP32[$4 >> 2] | 0) > 0) {
          $7 = ($0 + 112) | 0;
          $$0100 = 0;
          $9 = $2;
          while (1) {
            $8 = ($9 + (($$0100 * 24) | 0) + 16) | 0;
            $10 = HEAP32[$8 >> 2] | 0;
            if ($10 | 0) {
              $13 = ($9 + (($$0100 * 24) | 0) + 13) | 0;
              if (
                (HEAP32[
                  ((HEAP32[$7 >> 2] | 0) +
                    (((HEAPU8[$13 >> 0] | 0) * 2096) | 0) +
                    4) >>
                    2
                ] |
                  0) >
                0
              ) {
                $$08296 = 0;
                $20 = $10;
                while (1) {
                  _setup_free($0, HEAP32[($20 + ($$08296 << 2)) >> 2] | 0);
                  $$08296 = ($$08296 + 1) | 0;
                  $29 = HEAP32[$8 >> 2] | 0;
                  if (
                    ($$08296 | 0) >=
                    (HEAP32[
                      ((HEAP32[$7 >> 2] | 0) +
                        (((HEAPU8[$13 >> 0] | 0) * 2096) | 0) +
                        4) >>
                        2
                    ] |
                      0)
                  ) {
                    $$lcssa88 = $29;
                    break;
                  } else $20 = $29;
                }
              } else $$lcssa88 = $10;
              _setup_free($0, $$lcssa88);
            }
            _setup_free($0, HEAP32[($9 + (($$0100 * 24) | 0) + 20) >> 2] | 0);
            $32 = ($$0100 + 1) | 0;
            if (($32 | 0) >= (HEAP32[$4 >> 2] | 0)) break L1;
            $$0100 = $32;
            $9 = HEAP32[$1 >> 2] | 0;
          }
        }
      }
    } while (0);
    $35 = ($0 + 112) | 0;
    $36 = HEAP32[$35 >> 2] | 0;
    if ($36 | 0) {
      $38 = ($0 + 108) | 0;
      if ((HEAP32[$38 >> 2] | 0) > 0) {
        $$193 = 0;
        $42 = $36;
        while (1) {
          _setup_free($0, HEAP32[($42 + (($$193 * 2096) | 0) + 8) >> 2] | 0);
          _setup_free($0, HEAP32[($42 + (($$193 * 2096) | 0) + 28) >> 2] | 0);
          _setup_free($0, HEAP32[($42 + (($$193 * 2096) | 0) + 32) >> 2] | 0);
          _setup_free($0, HEAP32[($42 + (($$193 * 2096) | 0) + 2084) >> 2] | 0);
          $51 = HEAP32[($42 + (($$193 * 2096) | 0) + 2088) >> 2] | 0;
          _setup_free($0, ($51 | 0) == 0 ? 0 : ($51 + -4) | 0);
          $55 = ($$193 + 1) | 0;
          if (($55 | 0) >= (HEAP32[$38 >> 2] | 0)) break;
          $$193 = $55;
          $42 = HEAP32[$35 >> 2] | 0;
        }
        $58 = HEAP32[$35 >> 2] | 0;
      } else $58 = $36;
      _setup_free($0, $58);
    }
    _setup_free($0, HEAP32[($0 + 248) >> 2] | 0);
    _setup_free($0, HEAP32[$1 >> 2] | 0);
    $62 = ($0 + 392) | 0;
    $63 = HEAP32[$62 >> 2] | 0;
    if ($63 | 0) {
      $65 = ($0 + 388) | 0;
      if ((HEAP32[$65 >> 2] | 0) > 0) {
        $$291 = 0;
        $69 = $63;
        while (1) {
          _setup_free($0, HEAP32[($69 + (($$291 * 40) | 0) + 4) >> 2] | 0);
          $$291 = ($$291 + 1) | 0;
          $74 = HEAP32[$62 >> 2] | 0;
          if (($$291 | 0) >= (HEAP32[$65 >> 2] | 0)) {
            $$lcssa = $74;
            break;
          } else $69 = $74;
        }
      } else $$lcssa = $63;
      _setup_free($0, $$lcssa);
    }
    $75 = ($0 + 4) | 0;
    if ((HEAP32[$75 >> 2] | 0) > 0) {
      $$390 = 0;
      do {
        _setup_free($0, HEAP32[($0 + 788 + ($$390 << 2)) >> 2] | 0);
        _setup_free($0, HEAP32[($0 + 916 + ($$390 << 2)) >> 2] | 0);
        _setup_free($0, HEAP32[($0 + 984 + ($$390 << 2)) >> 2] | 0);
        $$390$looptemp = $$390;
        $$390 = ($$390 + 1) | 0;
      } while (
        ($$390$looptemp | 0) < 15 ? ($$390 | 0) < (HEAP32[$75 >> 2] | 0) : 0
      );
      $$489 = 0;
    } else $$489 = 0;
    do {
      _setup_free($0, HEAP32[($0 + 1056 + ($$489 << 2)) >> 2] | 0);
      _setup_free($0, HEAP32[($0 + 1064 + ($$489 << 2)) >> 2] | 0);
      _setup_free($0, HEAP32[($0 + 1072 + ($$489 << 2)) >> 2] | 0);
      _setup_free($0, HEAP32[($0 + 1080 + ($$489 << 2)) >> 2] | 0);
      _setup_free($0, HEAP32[($0 + 1088 + ($$489 << 2)) >> 2] | 0);
      $$489 = ($$489 + 1) | 0;
    } while (($$489 | 0) != 2);
    return;
  }
  function _stb_vorbis_decode_memory_float($0, $1, $2, $3, $4) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    var $$0109131 = 0,
      $$0114132 = 0,
      $$0115 = 0,
      $$0117140 = 0,
      $$0118 = 0,
      $$0121136 = 0,
      $$0122143 = 0,
      $$2120$ph = 0,
      $$8 = 0,
      $$sink = 0,
      $10 = 0,
      $15 = 0,
      $17 = 0,
      $19 = 0,
      $20 = 0,
      $23 = 0,
      $26 = 0,
      $27 = 0,
      $28 = 0,
      $29 = 0,
      $32 = 0,
      $40 = 0,
      $43 = 0,
      $46 = 0,
      $47 = 0,
      $49 = 0,
      $5 = 0,
      $54 = 0,
      $56 = 0,
      $58 = 0,
      $6 = 0,
      $61 = 0,
      $62 = 0,
      $8 = 0,
      $9 = 0,
      label = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 16) | 0;
    $5 = sp;
    HEAP32[$5 >> 2] = 0;
    $6 = _stb_vorbis_open_memory($0, $1, $5, 0) | 0;
    L1: do {
      if (!$6) $$8 = -1;
      else {
        $8 = ($6 + 4) | 0;
        $9 = HEAP32[$8 >> 2] | 0;
        $10 = $9 << 12;
        HEAP32[$2 >> 2] = $9;
        if ($3 | 0) HEAP32[$3 >> 2] = HEAP32[$6 >> 2];
        $15 = _malloc(HEAP32[$8 >> 2] << 2) | 0;
        if (!$15) {
          _stb_vorbis_close($6);
          $$8 = -2;
          break;
        }
        $17 = HEAP32[$8 >> 2] | 0;
        L9: do {
          if (($17 | 0) > 0) {
            $19 = $9 << 14;
            $$0122143 = 0;
            while (1) {
              $23 = _malloc($19) | 0;
              HEAP32[($15 + ($$0122143 << 2)) >> 2] = $23;
              $$0122143 = ($$0122143 + 1) | 0;
              if (!$23) break;
              $20 = HEAP32[$8 >> 2] | 0;
              if (($$0122143 | 0) >= ($20 | 0)) {
                $$0115 = 0;
                $$0118 = $10;
                $27 = $20;
                break L9;
              }
            }
            _stb_vorbis_close($6);
            $$8 = -2;
            break L1;
          } else {
            $$0115 = 0;
            $$0118 = $10;
            $27 = $17;
          }
        } while (0);
        L15: while (1) {
          $26 = _llvm_stacksave() | 0;
          $28 = STACKTOP;
          STACKTOP = (STACKTOP + ((((1 * ($27 << 2)) | 0) + 15) & -16)) | 0;
          $29 = HEAP32[$8 >> 2] | 0;
          if (($29 | 0) > 0) {
            $$0121136 = 0;
            do {
              HEAP32[($28 + ($$0121136 << 2)) >> 2] =
                (HEAP32[($15 + ($$0121136 << 2)) >> 2] | 0) + ($$0115 << 2);
              $$0121136 = ($$0121136 + 1) | 0;
            } while (($$0121136 | 0) < ($29 | 0));
          }
          $32 =
            _stb_vorbis_get_samples_float($6, $29, $28, ($$0118 - $$0115) | 0) |
            0;
          if (!$32) break;
          $40 = ($32 + $$0115) | 0;
          if ((($40 + $10) | 0) > ($$0118 | 0)) {
            $43 = $$0118 << 1;
            if ((HEAP32[$8 >> 2] | 0) > 0) {
              $46 = $$0118 << 3;
              $$0117140 = 0;
              while (1) {
                $47 = ($15 + ($$0117140 << 2)) | 0;
                $49 = _realloc(HEAP32[$47 >> 2] | 0, $46) | 0;
                if (!$49) {
                  label = 19;
                  break L15;
                }
                HEAP32[$47 >> 2] = $49;
                $$0117140 = ($$0117140 + 1) | 0;
                if (($$0117140 | 0) >= (HEAP32[$8 >> 2] | 0)) {
                  $$2120$ph = $43;
                  break;
                }
              }
            } else $$2120$ph = $43;
          } else $$2120$ph = $$0118;
          _llvm_stackrestore($26 | 0);
          $$0115 = $40;
          $$0118 = $$2120$ph;
          $27 = HEAP32[$8 >> 2] | 0;
        }
        if ((label | 0) == 19) {
          _stb_vorbis_close($6);
          _llvm_stackrestore($26 | 0);
          $$8 = -2;
          break;
        }
        _llvm_stackrestore($26 | 0);
        _stb_vorbis_close($6);
        $54 = HEAP32[$8 >> 2] | 0;
        if (($54 | 0) > 0) {
          $56 = ($$0115 | 0) > 0;
          $$0114132 = 0;
          do {
            $58 = HEAP32[($15 + ($$0114132 << 2)) >> 2] | 0;
            if ($56) {
              $$0109131 = 0;
              do {
                $61 = ($58 + ($$0109131 << 2)) | 0;
                $62 = +HEAPF32[$61 >> 2];
                if ($62 > 1) {
                  $$sink = 1;
                  label = 28;
                } else if ($62 < -1) {
                  $$sink = -1;
                  label = 28;
                }
                if ((label | 0) == 28) {
                  label = 0;
                  HEAPF32[$61 >> 2] = $$sink;
                }
                $$0109131 = ($$0109131 + 1) | 0;
              } while (($$0109131 | 0) != ($$0115 | 0));
            }
            $$0114132 = ($$0114132 + 1) | 0;
          } while (($$0114132 | 0) < ($54 | 0));
        }
        HEAP32[$4 >> 2] = $15;
        $$8 = $$0115;
      }
    } while (0);
    STACKTOP = sp;
    return $$8 | 0;
  }
  function _compute_sorted_huffman($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $$08088 = 0,
      $$082$lcssa = 0,
      $$08287 = 0,
      $$084$lcssa = 0,
      $$08494 = 0,
      $$095 = 0,
      $$183 = 0,
      $$185 = 0,
      $$199 = 0,
      $$289 = 0,
      $$pre$phiZ2D = 0,
      $$sink3 = 0,
      $10 = 0,
      $12 = 0,
      $13 = 0,
      $16 = 0,
      $17 = 0,
      $25 = 0,
      $3 = 0,
      $32 = 0,
      $37 = 0,
      $40 = 0,
      $42 = 0,
      $44 = 0,
      $48 = 0,
      $51 = 0,
      $53 = 0,
      $54 = 0,
      $55 = 0,
      $56 = 0,
      $6 = 0,
      $61 = 0,
      $67 = 0,
      $68 = 0,
      $7 = 0,
      $70 = 0,
      $71 = 0,
      $72 = 0,
      $75 = 0,
      $91 = 0;
    $3 = ($0 + 23) | 0;
    if (!(HEAP8[$3 >> 0] | 0)) {
      $13 = ($0 + 4) | 0;
      if ((HEAP32[$13 >> 2] | 0) > 0) {
        $16 = ($0 + 32) | 0;
        $17 = ($0 + 2084) | 0;
        $$08494 = 0;
        $$095 = 0;
        while (1) {
          if (!(_include_in_sort($0, HEAP8[($1 + $$095) >> 0] | 0) | 0))
            $$185 = $$08494;
          else {
            $25 =
              _bit_reverse(
                HEAP32[((HEAP32[$16 >> 2] | 0) + ($$095 << 2)) >> 2] | 0
              ) | 0;
            HEAP32[((HEAP32[$17 >> 2] | 0) + ($$08494 << 2)) >> 2] = $25;
            $$185 = ($$08494 + 1) | 0;
          }
          $$095 = ($$095 + 1) | 0;
          if (($$095 | 0) >= (HEAP32[$13 >> 2] | 0)) {
            $$084$lcssa = $$185;
            break;
          } else $$08494 = $$185;
        }
      } else $$084$lcssa = 0;
      $32 = ($0 + 2092) | 0;
      if (($$084$lcssa | 0) == (HEAP32[$32 >> 2] | 0)) {
        $$pre$phiZ2D = $32;
        $44 = $$084$lcssa;
      } else ___assert_fail(1639, 1052, 1148, 1662);
    } else {
      $6 = ($0 + 2092) | 0;
      $7 = HEAP32[$6 >> 2] | 0;
      if (($7 | 0) > 0) {
        $10 = HEAP32[($0 + 32) >> 2] | 0;
        $12 = HEAP32[($0 + 2084) >> 2] | 0;
        $$199 = 0;
        do {
          $37 = _bit_reverse(HEAP32[($10 + ($$199 << 2)) >> 2] | 0) | 0;
          HEAP32[($12 + ($$199 << 2)) >> 2] = $37;
          $$199 = ($$199 + 1) | 0;
          $40 = HEAP32[$6 >> 2] | 0;
        } while (($$199 | 0) < ($40 | 0));
        $$pre$phiZ2D = $6;
        $44 = $40;
      } else {
        $$pre$phiZ2D = $6;
        $44 = $7;
      }
    }
    $42 = ($0 + 2084) | 0;
    _qsort(HEAP32[$42 >> 2] | 0, $44, 4, 2);
    HEAP32[((HEAP32[$42 >> 2] | 0) + (HEAP32[$$pre$phiZ2D >> 2] << 2)) >> 2] =
      -1;
    $48 = HEAP8[$3 >> 0] | 0;
    $51 = HEAP32[(($48 << 24) >> 24 ? $$pre$phiZ2D : ($0 + 4) | 0) >> 2] | 0;
    L17: do {
      if (($51 | 0) > 0) {
        $53 = ($0 + 32) | 0;
        $54 = ($0 + 2088) | 0;
        $55 = ($0 + 8) | 0;
        $$289 = 0;
        $56 = $48;
        L19: while (1) {
          if (!(($56 << 24) >> 24)) $$sink3 = $$289;
          else $$sink3 = HEAP32[($2 + ($$289 << 2)) >> 2] | 0;
          $61 = HEAP8[($1 + $$sink3) >> 0] | 0;
          do {
            if (_include_in_sort($0, $61) | 0) {
              $67 =
                _bit_reverse(
                  HEAP32[((HEAP32[$53 >> 2] | 0) + ($$289 << 2)) >> 2] | 0
                ) | 0;
              $68 = HEAP32[$$pre$phiZ2D >> 2] | 0;
              $70 = HEAP32[$42 >> 2] | 0;
              if (($68 | 0) > 1) {
                $$08088 = $68;
                $$08287 = 0;
                while (1) {
                  $71 = $$08088 >>> 1;
                  $72 = ($71 + $$08287) | 0;
                  $75 = (HEAP32[($70 + ($72 << 2)) >> 2] | 0) >>> 0 > $67 >>> 0;
                  $$183 = $75 ? $$08287 : $72;
                  $$08088 = $75 ? $71 : ($$08088 - $71) | 0;
                  if (($$08088 | 0) <= 1) {
                    $$082$lcssa = $$183;
                    break;
                  } else $$08287 = $$183;
                }
              } else $$082$lcssa = 0;
              if ((HEAP32[($70 + ($$082$lcssa << 2)) >> 2] | 0) != ($67 | 0))
                break L19;
              if (!(HEAP8[$3 >> 0] | 0)) {
                HEAP32[((HEAP32[$54 >> 2] | 0) + ($$082$lcssa << 2)) >> 2] =
                  $$289;
                break;
              } else {
                HEAP32[((HEAP32[$54 >> 2] | 0) + ($$082$lcssa << 2)) >> 2] =
                  HEAP32[($2 + ($$289 << 2)) >> 2];
                HEAP8[((HEAP32[$55 >> 2] | 0) + $$082$lcssa) >> 0] = $61;
                break;
              }
            }
          } while (0);
          $91 = ($$289 + 1) | 0;
          if (($91 | 0) >= ($51 | 0)) break L17;
          $$289 = $91;
          $56 = HEAP8[$3 >> 0] | 0;
        }
        ___assert_fail(1685, 1052, 1178, 1662);
      }
    } while (0);
    return;
  }
  function _compute_codewords($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$06983 = 0,
      $$072$ph = 0,
      $$074$lcssa = 0,
      $$07488 = 0,
      $$07586 = 0,
      $$084 = 0,
      $$176$in = 0,
      $$176$in$ph = 0,
      $$2 = 0,
      $15 = 0,
      $18 = 0,
      $20 = 0,
      $27 = 0,
      $28 = 0,
      $30 = 0,
      $32 = 0,
      $33 = 0,
      $39 = 0,
      $4 = 0,
      $40 = 0,
      $41 = 0,
      $45 = 0,
      $51 = 0,
      $9 = 0,
      dest = 0,
      label = 0,
      sp = 0,
      stop = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 128) | 0;
    $4 = sp;
    dest = $4;
    stop = (dest + 128) | 0;
    do {
      HEAP32[dest >> 2] = 0;
      dest = (dest + 4) | 0;
    } while ((dest | 0) < (stop | 0));
    L1: do {
      if (($2 | 0) > 0) {
        $$07488 = 0;
        while (1) {
          if ((HEAP8[($1 + $$07488) >> 0] | 0) != -1) {
            $$074$lcssa = $$07488;
            break L1;
          }
          $9 = ($$07488 + 1) | 0;
          if (($9 | 0) < ($2 | 0)) $$07488 = $9;
          else {
            $$074$lcssa = $9;
            break;
          }
        }
      } else $$074$lcssa = 0;
    } while (0);
    L6: do {
      if (($$074$lcssa | 0) == ($2 | 0))
        if (!(HEAP32[($0 + 2092) >> 2] | 0)) $$2 = 1;
        else ___assert_fail(1536, 1052, 1051, 1559);
      else {
        $15 = ($1 + $$074$lcssa) | 0;
        _add_entry($0, 0, $$074$lcssa, 0, HEAPU8[$15 >> 0] | 0, $3);
        $18 = HEAP8[$15 >> 0] | 0;
        if (!(($18 << 24) >> 24)) {
          $$072$ph = 1;
          $$176$in$ph = $$074$lcssa;
        } else {
          $20 = $18 & 255;
          $$07586 = 1;
          while (1) {
            HEAP32[($4 + ($$07586 << 2)) >> 2] = 1 << (32 - $$07586);
            if (($$07586 | 0) < ($20 | 0)) $$07586 = ($$07586 + 1) | 0;
            else {
              $$072$ph = 1;
              $$176$in$ph = $$074$lcssa;
              break;
            }
          }
        }
        L14: while (1) {
          $$176$in = $$176$in$ph;
          do {
            $$176$in = ($$176$in + 1) | 0;
            if (($$176$in | 0) >= ($2 | 0)) {
              $$2 = 1;
              break L6;
            }
            $27 = ($1 + $$176$in) | 0;
            $28 = HEAP8[$27 >> 0] | 0;
          } while (($28 << 24) >> 24 == -1);
          $30 = $28 & 255;
          if (!(($28 << 24) >> 24)) {
            $$2 = 0;
            break L6;
          } else $$06983 = $30;
          while (1) {
            $32 = ($4 + ($$06983 << 2)) | 0;
            $33 = HEAP32[$32 >> 2] | 0;
            if ($33 | 0) break;
            if (($$06983 | 0) > 1) $$06983 = ($$06983 + -1) | 0;
            else {
              $$2 = 0;
              break L6;
            }
          }
          if ($$06983 >>> 0 >= 32) {
            label = 17;
            break;
          }
          HEAP32[$32 >> 2] = 0;
          $39 = ($$072$ph + 1) | 0;
          _add_entry($0, _bit_reverse($33) | 0, $$176$in, $$072$ph, $30, $3);
          $40 = HEAP8[$27 >> 0] | 0;
          $41 = $40 & 255;
          if (($$06983 | 0) == ($41 | 0)) {
            $$072$ph = $39;
            $$176$in$ph = $$176$in;
            continue;
          }
          if (($40 & 255) >= 32) {
            label = 21;
            break;
          }
          if (($$06983 | 0) < ($41 | 0)) $$084 = $41;
          else {
            $$072$ph = $39;
            $$176$in$ph = $$176$in;
            continue;
          }
          while (1) {
            $45 = ($4 + ($$084 << 2)) | 0;
            if (HEAP32[$45 >> 2] | 0) {
              label = 23;
              break L14;
            }
            HEAP32[$45 >> 2] = (1 << (32 - $$084)) + $33;
            $51 = ($$084 + -1) | 0;
            if (($51 | 0) > ($$06983 | 0)) $$084 = $51;
            else {
              $$072$ph = $39;
              $$176$in$ph = $$176$in;
              continue L14;
            }
          }
        }
        if ((label | 0) == 17) ___assert_fail(1577, 1052, 1074, 1559);
        else if ((label | 0) == 21) ___assert_fail(1594, 1052, 1079, 1559);
        else if ((label | 0) == 23) ___assert_fail(1621, 1052, 1081, 1559);
      }
    } while (0);
    STACKTOP = sp;
    return $$2 | 0;
  }
  function _imdct_step3_iter0_loop($0, $1, $2, $3, $4) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    var $$0100 = 0,
      $$09499 = 0,
      $$09598 = 0,
      $$09697 = 0,
      $11 = 0,
      $12 = 0,
      $13 = 0,
      $14 = 0,
      $15 = 0,
      $16 = 0,
      $18 = 0,
      $24 = 0,
      $33 = 0,
      $34 = 0,
      $35 = 0,
      $36 = 0,
      $37 = 0,
      $38 = 0,
      $39 = 0,
      $40 = 0,
      $41 = 0,
      $43 = 0,
      $49 = 0,
      $5 = 0,
      $58 = 0,
      $59 = 0,
      $60 = 0,
      $61 = 0,
      $62 = 0,
      $63 = 0,
      $64 = 0,
      $65 = 0,
      $66 = 0,
      $68 = 0,
      $74 = 0,
      $8 = 0,
      $83 = 0,
      $84 = 0,
      $85 = 0,
      $86 = 0,
      $87 = 0,
      $88 = 0,
      $89 = 0,
      $90 = 0,
      $91 = 0,
      $93 = 0,
      $99 = 0;
    $5 = ($1 + ($2 << 2)) | 0;
    if (($0 & 3) | 0) ___assert_fail(1411, 1052, 2398, 1424);
    $8 = $0 >> 2;
    if (($8 | 0) > 0) {
      $$0100 = $4;
      $$09499 = $5;
      $$09598 = $8;
      $$09697 = ($5 + ($3 << 2)) | 0;
      while (1) {
        $11 = +HEAPF32[$$09499 >> 2];
        $12 = +HEAPF32[$$09697 >> 2];
        $13 = $11 - $12;
        $14 = ($$09499 + -4) | 0;
        $15 = +HEAPF32[$14 >> 2];
        $16 = ($$09697 + -4) | 0;
        $18 = $15 - +HEAPF32[$16 >> 2];
        HEAPF32[$$09499 >> 2] = $11 + $12;
        HEAPF32[$14 >> 2] = +HEAPF32[$16 >> 2] + $15;
        $24 = ($$0100 + 4) | 0;
        HEAPF32[$$09697 >> 2] =
          $13 * +HEAPF32[$$0100 >> 2] - $18 * +HEAPF32[$24 >> 2];
        HEAPF32[$16 >> 2] =
          $18 * +HEAPF32[$$0100 >> 2] + $13 * +HEAPF32[$24 >> 2];
        $33 = ($$0100 + 32) | 0;
        $34 = ($$09499 + -8) | 0;
        $35 = +HEAPF32[$34 >> 2];
        $36 = ($$09697 + -8) | 0;
        $37 = +HEAPF32[$36 >> 2];
        $38 = $35 - $37;
        $39 = ($$09499 + -12) | 0;
        $40 = +HEAPF32[$39 >> 2];
        $41 = ($$09697 + -12) | 0;
        $43 = $40 - +HEAPF32[$41 >> 2];
        HEAPF32[$34 >> 2] = $35 + $37;
        HEAPF32[$39 >> 2] = +HEAPF32[$41 >> 2] + $40;
        $49 = ($$0100 + 36) | 0;
        HEAPF32[$36 >> 2] = $38 * +HEAPF32[$33 >> 2] - $43 * +HEAPF32[$49 >> 2];
        HEAPF32[$41 >> 2] = $43 * +HEAPF32[$33 >> 2] + $38 * +HEAPF32[$49 >> 2];
        $58 = ($$0100 + 64) | 0;
        $59 = ($$09499 + -16) | 0;
        $60 = +HEAPF32[$59 >> 2];
        $61 = ($$09697 + -16) | 0;
        $62 = +HEAPF32[$61 >> 2];
        $63 = $60 - $62;
        $64 = ($$09499 + -20) | 0;
        $65 = +HEAPF32[$64 >> 2];
        $66 = ($$09697 + -20) | 0;
        $68 = $65 - +HEAPF32[$66 >> 2];
        HEAPF32[$59 >> 2] = $60 + $62;
        HEAPF32[$64 >> 2] = +HEAPF32[$66 >> 2] + $65;
        $74 = ($$0100 + 68) | 0;
        HEAPF32[$61 >> 2] = $63 * +HEAPF32[$58 >> 2] - $68 * +HEAPF32[$74 >> 2];
        HEAPF32[$66 >> 2] = $68 * +HEAPF32[$58 >> 2] + $63 * +HEAPF32[$74 >> 2];
        $83 = ($$0100 + 96) | 0;
        $84 = ($$09499 + -24) | 0;
        $85 = +HEAPF32[$84 >> 2];
        $86 = ($$09697 + -24) | 0;
        $87 = +HEAPF32[$86 >> 2];
        $88 = $85 - $87;
        $89 = ($$09499 + -28) | 0;
        $90 = +HEAPF32[$89 >> 2];
        $91 = ($$09697 + -28) | 0;
        $93 = $90 - +HEAPF32[$91 >> 2];
        HEAPF32[$84 >> 2] = $85 + $87;
        HEAPF32[$89 >> 2] = +HEAPF32[$91 >> 2] + $90;
        $99 = ($$0100 + 100) | 0;
        HEAPF32[$86 >> 2] = $88 * +HEAPF32[$83 >> 2] - $93 * +HEAPF32[$99 >> 2];
        HEAPF32[$91 >> 2] = $93 * +HEAPF32[$83 >> 2] + $88 * +HEAPF32[$99 >> 2];
        if (($$09598 | 0) > 1) {
          $$0100 = ($$0100 + 128) | 0;
          $$09499 = ($$09499 + -32) | 0;
          $$09598 = ($$09598 + -1) | 0;
          $$09697 = ($$09697 + -32) | 0;
        } else break;
      }
    }
    return;
  }
  function _imdct_step3_inner_r_loop($0, $1, $2, $3, $4, $5) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    var $$0103 = 0,
      $$097102 = 0,
      $$098101 = 0,
      $$099100 = 0,
      $10 = 0,
      $11 = 0,
      $12 = 0,
      $13 = 0,
      $14 = 0,
      $15 = 0,
      $17 = 0,
      $23 = 0,
      $32 = 0,
      $33 = 0,
      $34 = 0,
      $35 = 0,
      $36 = 0,
      $37 = 0,
      $38 = 0,
      $39 = 0,
      $40 = 0,
      $42 = 0,
      $48 = 0,
      $57 = 0,
      $58 = 0,
      $59 = 0,
      $6 = 0,
      $60 = 0,
      $61 = 0,
      $62 = 0,
      $63 = 0,
      $64 = 0,
      $65 = 0,
      $67 = 0,
      $7 = 0,
      $73 = 0,
      $82 = 0,
      $83 = 0,
      $84 = 0,
      $85 = 0,
      $86 = 0,
      $87 = 0,
      $88 = 0,
      $89 = 0,
      $90 = 0,
      $92 = 0,
      $98 = 0;
    $6 = ($1 + ($2 << 2)) | 0;
    $7 = $0 >> 2;
    if (($7 | 0) > 0) {
      $$0103 = ($6 + ($3 << 2)) | 0;
      $$097102 = $6;
      $$098101 = $4;
      $$099100 = $7;
      while (1) {
        $10 = +HEAPF32[$$097102 >> 2];
        $11 = +HEAPF32[$$0103 >> 2];
        $12 = $10 - $11;
        $13 = ($$097102 + -4) | 0;
        $14 = +HEAPF32[$13 >> 2];
        $15 = ($$0103 + -4) | 0;
        $17 = $14 - +HEAPF32[$15 >> 2];
        HEAPF32[$$097102 >> 2] = $10 + $11;
        HEAPF32[$13 >> 2] = +HEAPF32[$15 >> 2] + $14;
        $23 = ($$098101 + 4) | 0;
        HEAPF32[$$0103 >> 2] =
          $12 * +HEAPF32[$$098101 >> 2] - $17 * +HEAPF32[$23 >> 2];
        HEAPF32[$15 >> 2] =
          $17 * +HEAPF32[$$098101 >> 2] + $12 * +HEAPF32[$23 >> 2];
        $32 = ($$098101 + ($5 << 2)) | 0;
        $33 = ($$097102 + -8) | 0;
        $34 = +HEAPF32[$33 >> 2];
        $35 = ($$0103 + -8) | 0;
        $36 = +HEAPF32[$35 >> 2];
        $37 = $34 - $36;
        $38 = ($$097102 + -12) | 0;
        $39 = +HEAPF32[$38 >> 2];
        $40 = ($$0103 + -12) | 0;
        $42 = $39 - +HEAPF32[$40 >> 2];
        HEAPF32[$33 >> 2] = $34 + $36;
        HEAPF32[$38 >> 2] = +HEAPF32[$40 >> 2] + $39;
        $48 = ($32 + 4) | 0;
        HEAPF32[$35 >> 2] = $37 * +HEAPF32[$32 >> 2] - $42 * +HEAPF32[$48 >> 2];
        HEAPF32[$40 >> 2] = $42 * +HEAPF32[$32 >> 2] + $37 * +HEAPF32[$48 >> 2];
        $57 = ($32 + ($5 << 2)) | 0;
        $58 = ($$097102 + -16) | 0;
        $59 = +HEAPF32[$58 >> 2];
        $60 = ($$0103 + -16) | 0;
        $61 = +HEAPF32[$60 >> 2];
        $62 = $59 - $61;
        $63 = ($$097102 + -20) | 0;
        $64 = +HEAPF32[$63 >> 2];
        $65 = ($$0103 + -20) | 0;
        $67 = $64 - +HEAPF32[$65 >> 2];
        HEAPF32[$58 >> 2] = $59 + $61;
        HEAPF32[$63 >> 2] = +HEAPF32[$65 >> 2] + $64;
        $73 = ($57 + 4) | 0;
        HEAPF32[$60 >> 2] = $62 * +HEAPF32[$57 >> 2] - $67 * +HEAPF32[$73 >> 2];
        HEAPF32[$65 >> 2] = $67 * +HEAPF32[$57 >> 2] + $62 * +HEAPF32[$73 >> 2];
        $82 = ($57 + ($5 << 2)) | 0;
        $83 = ($$097102 + -24) | 0;
        $84 = +HEAPF32[$83 >> 2];
        $85 = ($$0103 + -24) | 0;
        $86 = +HEAPF32[$85 >> 2];
        $87 = $84 - $86;
        $88 = ($$097102 + -28) | 0;
        $89 = +HEAPF32[$88 >> 2];
        $90 = ($$0103 + -28) | 0;
        $92 = $89 - +HEAPF32[$90 >> 2];
        HEAPF32[$83 >> 2] = $84 + $86;
        HEAPF32[$88 >> 2] = +HEAPF32[$90 >> 2] + $89;
        $98 = ($82 + 4) | 0;
        HEAPF32[$85 >> 2] = $87 * +HEAPF32[$82 >> 2] - $92 * +HEAPF32[$98 >> 2];
        HEAPF32[$90 >> 2] = $92 * +HEAPF32[$82 >> 2] + $87 * +HEAPF32[$98 >> 2];
        if (($$099100 | 0) > 1) {
          $$0103 = ($$0103 + -32) | 0;
          $$097102 = ($$097102 + -32) | 0;
          $$098101 = ($82 + ($5 << 2)) | 0;
          $$099100 = ($$099100 + -1) | 0;
        } else break;
      }
    }
    return;
  }
  function _imdct_step3_inner_s_loop($0, $1, $2, $3, $4, $5, $6) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    $6 = $6 | 0;
    var $$0129132 = 0,
      $$0130131 = 0,
      $$0133 = 0,
      $11 = 0,
      $14 = 0,
      $15 = 0,
      $17 = 0,
      $20 = 0,
      $21 = 0,
      $23 = 0,
      $26 = 0,
      $27 = 0,
      $30 = 0,
      $31 = 0,
      $32 = 0,
      $33 = 0,
      $34 = 0,
      $35 = 0,
      $36 = 0,
      $38 = 0,
      $48 = 0,
      $49 = 0,
      $50 = 0,
      $51 = 0,
      $52 = 0,
      $53 = 0,
      $54 = 0,
      $55 = 0,
      $57 = 0,
      $67 = 0,
      $68 = 0,
      $69 = 0,
      $7 = 0,
      $70 = 0,
      $71 = 0,
      $72 = 0,
      $73 = 0,
      $74 = 0,
      $76 = 0,
      $86 = 0,
      $87 = 0,
      $88 = 0,
      $89 = 0,
      $9 = 0,
      $90 = 0,
      $91 = 0,
      $92 = 0,
      $93 = 0,
      $95 = 0;
    $7 = +HEAPF32[$4 >> 2];
    $9 = +HEAPF32[($4 + 4) >> 2];
    $11 = +HEAPF32[($4 + ($5 << 2)) >> 2];
    $14 = +HEAPF32[($4 + (($5 + 1) << 2)) >> 2];
    $15 = $5 << 1;
    $17 = +HEAPF32[($4 + ($15 << 2)) >> 2];
    $20 = +HEAPF32[($4 + (($15 | 1) << 2)) >> 2];
    $21 = ($5 * 3) | 0;
    $23 = +HEAPF32[($4 + ($21 << 2)) >> 2];
    $26 = +HEAPF32[($4 + (($21 + 1) << 2)) >> 2];
    $27 = ($1 + ($2 << 2)) | 0;
    if (($0 | 0) > 0) {
      $30 = (0 - $6) | 0;
      $$0129132 = $27;
      $$0130131 = $0;
      $$0133 = ($27 + ($3 << 2)) | 0;
      while (1) {
        $31 = +HEAPF32[$$0129132 >> 2];
        $32 = +HEAPF32[$$0133 >> 2];
        $33 = $31 - $32;
        $34 = ($$0129132 + -4) | 0;
        $35 = +HEAPF32[$34 >> 2];
        $36 = ($$0133 + -4) | 0;
        $38 = $35 - +HEAPF32[$36 >> 2];
        HEAPF32[$$0129132 >> 2] = $31 + $32;
        HEAPF32[$34 >> 2] = $35 + +HEAPF32[$36 >> 2];
        HEAPF32[$$0133 >> 2] = $7 * $33 - $9 * $38;
        HEAPF32[$36 >> 2] = $9 * $33 + $7 * $38;
        $48 = ($$0129132 + -8) | 0;
        $49 = +HEAPF32[$48 >> 2];
        $50 = ($$0133 + -8) | 0;
        $51 = +HEAPF32[$50 >> 2];
        $52 = $49 - $51;
        $53 = ($$0129132 + -12) | 0;
        $54 = +HEAPF32[$53 >> 2];
        $55 = ($$0133 + -12) | 0;
        $57 = $54 - +HEAPF32[$55 >> 2];
        HEAPF32[$48 >> 2] = $49 + $51;
        HEAPF32[$53 >> 2] = $54 + +HEAPF32[$55 >> 2];
        HEAPF32[$50 >> 2] = $11 * $52 - $14 * $57;
        HEAPF32[$55 >> 2] = $14 * $52 + $11 * $57;
        $67 = ($$0129132 + -16) | 0;
        $68 = +HEAPF32[$67 >> 2];
        $69 = ($$0133 + -16) | 0;
        $70 = +HEAPF32[$69 >> 2];
        $71 = $68 - $70;
        $72 = ($$0129132 + -20) | 0;
        $73 = +HEAPF32[$72 >> 2];
        $74 = ($$0133 + -20) | 0;
        $76 = $73 - +HEAPF32[$74 >> 2];
        HEAPF32[$67 >> 2] = $68 + $70;
        HEAPF32[$72 >> 2] = $73 + +HEAPF32[$74 >> 2];
        HEAPF32[$69 >> 2] = $17 * $71 - $20 * $76;
        HEAPF32[$74 >> 2] = $20 * $71 + $17 * $76;
        $86 = ($$0129132 + -24) | 0;
        $87 = +HEAPF32[$86 >> 2];
        $88 = ($$0133 + -24) | 0;
        $89 = +HEAPF32[$88 >> 2];
        $90 = $87 - $89;
        $91 = ($$0129132 + -28) | 0;
        $92 = +HEAPF32[$91 >> 2];
        $93 = ($$0133 + -28) | 0;
        $95 = $92 - +HEAPF32[$93 >> 2];
        HEAPF32[$86 >> 2] = $87 + $89;
        HEAPF32[$91 >> 2] = $92 + +HEAPF32[$93 >> 2];
        HEAPF32[$88 >> 2] = $23 * $90 - $26 * $95;
        HEAPF32[$93 >> 2] = $26 * $90 + $23 * $95;
        if (($$0130131 | 0) > 1) {
          $$0129132 = ($$0129132 + ($30 << 2)) | 0;
          $$0130131 = ($$0130131 + -1) | 0;
          $$0133 = ($$0133 + ($30 << 2)) | 0;
        } else break;
      }
    }
    return;
  }
  function _qsort($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$0 = 0,
      $$067$lcssa = 0,
      $$06772 = 0,
      $$068$lcssa = 0,
      $$06871 = 0,
      $$1 = 0,
      $$169 = 0,
      $$2 = 0,
      $12 = 0,
      $15 = 0,
      $15$phi = 0,
      $16 = 0,
      $17 = 0,
      $22 = 0,
      $24 = 0,
      $26 = 0,
      $29 = 0,
      $37 = 0,
      $38 = 0,
      $4 = 0,
      $40 = 0,
      $42 = 0,
      $47 = 0,
      $49 = 0,
      $5 = 0,
      $59 = 0,
      $6 = 0,
      $60 = 0,
      $61 = 0,
      $7 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 208) | 0;
    $4 = (sp + 8) | 0;
    $5 = sp;
    $6 = Math_imul($2, $1) | 0;
    $7 = $5;
    HEAP32[$7 >> 2] = 1;
    HEAP32[($7 + 4) >> 2] = 0;
    L1: do {
      if ($6 | 0) {
        $12 = (0 - $2) | 0;
        HEAP32[($4 + 4) >> 2] = $2;
        HEAP32[$4 >> 2] = $2;
        $$0 = 2;
        $15 = $2;
        $17 = $2;
        while (1) {
          $16 = ($15 + $2 + $17) | 0;
          HEAP32[($4 + ($$0 << 2)) >> 2] = $16;
          if ($16 >>> 0 < $6 >>> 0) {
            $15$phi = $17;
            $$0 = ($$0 + 1) | 0;
            $17 = $16;
            $15 = $15$phi;
          } else break;
        }
        $22 = ($0 + $6 + $12) | 0;
        if ($22 >>> 0 > $0 >>> 0) {
          $24 = $22;
          $$06772 = 1;
          $$06871 = $0;
          $26 = 1;
          while (1) {
            do {
              if ((($26 & 3) | 0) == 3) {
                _sift($$06871, $2, $3, $$06772, $4);
                _shr($5, 2);
                $$1 = ($$06772 + 2) | 0;
              } else {
                $29 = ($$06772 + -1) | 0;
                if (
                  (HEAP32[($4 + ($29 << 2)) >> 2] | 0) >>> 0 <
                  (($24 - $$06871) | 0) >>> 0
                )
                  _sift($$06871, $2, $3, $$06772, $4);
                else _trinkle($$06871, $2, $3, $5, $$06772, 0, $4);
                if (($$06772 | 0) == 1) {
                  _shl($5, 1);
                  $$1 = 0;
                  break;
                } else {
                  _shl($5, $29);
                  $$1 = 1;
                  break;
                }
              }
            } while (0);
            $37 = HEAP32[$5 >> 2] | 1;
            HEAP32[$5 >> 2] = $37;
            $38 = ($$06871 + $2) | 0;
            if ($38 >>> 0 < $22 >>> 0) {
              $$06772 = $$1;
              $$06871 = $38;
              $26 = $37;
            } else {
              $$067$lcssa = $$1;
              $$068$lcssa = $38;
              $61 = $37;
              break;
            }
          }
        } else {
          $$067$lcssa = 1;
          $$068$lcssa = $0;
          $61 = 1;
        }
        _trinkle($$068$lcssa, $2, $3, $5, $$067$lcssa, 0, $4);
        $40 = ($5 + 4) | 0;
        $$169 = $$068$lcssa;
        $$2 = $$067$lcssa;
        $42 = $61;
        while (1) {
          if ((($$2 | 0) == 1) & (($42 | 0) == 1)) {
            if (!(HEAP32[$40 >> 2] | 0)) break L1;
          } else if (($$2 | 0) >= 2) {
            _shl($5, 2);
            $49 = ($$2 + -2) | 0;
            HEAP32[$5 >> 2] = HEAP32[$5 >> 2] ^ 7;
            _shr($5, 1);
            _trinkle(
              ($$169 + (0 - (HEAP32[($4 + ($49 << 2)) >> 2] | 0)) + $12) | 0,
              $2,
              $3,
              $5,
              ($$2 + -1) | 0,
              1,
              $4
            );
            _shl($5, 1);
            $59 = HEAP32[$5 >> 2] | 1;
            HEAP32[$5 >> 2] = $59;
            $60 = ($$169 + $12) | 0;
            _trinkle($60, $2, $3, $5, $49, 1, $4);
            $$169 = $60;
            $$2 = $49;
            $42 = $59;
            continue;
          }
          $47 = _pntz($5) | 0;
          _shr($5, $47);
          $$169 = ($$169 + $12) | 0;
          $$2 = ($47 + $$2) | 0;
          $42 = HEAP32[$5 >> 2] | 0;
        }
      }
    } while (0);
    STACKTOP = sp;
    return;
  }
  function _codebook_decode_scalar_raw($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$0 = 0,
      $$06574 = 0,
      $$06676 = 0,
      $$068$lcssa = 0,
      $$06875 = 0,
      $$1 = 0,
      $$169 = 0,
      $$2 = 0,
      $14 = 0,
      $15 = 0,
      $16 = 0,
      $18 = 0,
      $21 = 0,
      $22 = 0,
      $23 = 0,
      $26 = 0,
      $3 = 0,
      $4 = 0,
      $40 = 0,
      $41 = 0,
      $42 = 0,
      $51 = 0,
      $52 = 0,
      $53 = 0,
      $54 = 0,
      $55 = 0,
      $59 = 0,
      $64 = 0,
      $65 = 0,
      $71 = 0,
      $9 = 0,
      $storemerge = 0,
      label = 0;
    _prep_huffman($0);
    $3 = HEAP32[($1 + 32) >> 2] | 0;
    $4 = ($3 | 0) == 0;
    if ($4)
      if (!(HEAP32[($1 + 2084) >> 2] | 0)) $$1 = -1;
      else label = 3;
    else label = 3;
    L3: do {
      if ((label | 0) == 3) {
        $9 = HEAP32[($1 + 4) >> 2] | 0;
        if (($9 | 0) > 8) {
          if (HEAP32[($1 + 2084) >> 2] | 0) label = 6;
        } else if ($4) label = 6;
        if ((label | 0) == 6) {
          $14 = ($0 + 1380) | 0;
          $15 = HEAP32[$14 >> 2] | 0;
          $16 = _bit_reverse($15) | 0;
          $18 = HEAP32[($1 + 2092) >> 2] | 0;
          if (($18 | 0) > 1) {
            $21 = HEAP32[($1 + 2084) >> 2] | 0;
            $$06676 = $18;
            $$06875 = 0;
            while (1) {
              $22 = $$06676 >>> 1;
              $23 = ($22 + $$06875) | 0;
              $26 = (HEAP32[($21 + ($23 << 2)) >> 2] | 0) >>> 0 > $16 >>> 0;
              $$169 = $26 ? $$06875 : $23;
              $$06676 = $26 ? $22 : ($$06676 - $22) | 0;
              if (($$06676 | 0) <= 1) {
                $$068$lcssa = $$169;
                break;
              } else $$06875 = $$169;
            }
          } else $$068$lcssa = 0;
          if (!(HEAP8[($1 + 23) >> 0] | 0))
            $$2 =
              HEAP32[
                ((HEAP32[($1 + 2088) >> 2] | 0) + ($$068$lcssa << 2)) >> 2
              ] | 0;
          else $$2 = $$068$lcssa;
          $40 = HEAPU8[((HEAP32[($1 + 8) >> 2] | 0) + $$2) >> 0] | 0;
          $41 = ($0 + 1384) | 0;
          $42 = HEAP32[$41 >> 2] | 0;
          if (($42 | 0) < ($40 | 0)) {
            $$0 = -1;
            $storemerge = 0;
          } else {
            HEAP32[$14 >> 2] = $15 >>> $40;
            $$0 = $$2;
            $storemerge = ($42 - $40) | 0;
          }
          HEAP32[$41 >> 2] = $storemerge;
          $$1 = $$0;
          break;
        }
        if (HEAP8[($1 + 23) >> 0] | 0) ___assert_fail(1257, 1052, 1640, 1268);
        L25: do {
          if (($9 | 0) > 0) {
            $51 = HEAP32[($1 + 8) >> 2] | 0;
            $52 = ($0 + 1380) | 0;
            $$06574 = 0;
            while (1) {
              $53 = ($51 + $$06574) | 0;
              $54 = HEAP8[$53 >> 0] | 0;
              $55 = $54 & 255;
              if (($54 << 24) >> 24 != -1) {
                $59 = HEAP32[$52 >> 2] | 0;
                if (
                  (HEAP32[($3 + ($$06574 << 2)) >> 2] | 0) ==
                  (($59 & ((1 << $55) + -1)) | 0)
                )
                  break;
              }
              $71 = ($$06574 + 1) | 0;
              if (($71 | 0) < ($9 | 0)) $$06574 = $71;
              else break L25;
            }
            $64 = ($0 + 1384) | 0;
            $65 = HEAP32[$64 >> 2] | 0;
            if (($65 | 0) < ($55 | 0)) {
              HEAP32[$64 >> 2] = 0;
              $$1 = -1;
              break L3;
            } else {
              HEAP32[$52 >> 2] = $59 >>> $55;
              HEAP32[$64 >> 2] = $65 - (HEAPU8[$53 >> 0] | 0);
              $$1 = $$06574;
              break L3;
            }
          }
        } while (0);
        _error($0, 21);
        HEAP32[($0 + 1384) >> 2] = 0;
        $$1 = -1;
      }
    } while (0);
    return $$1 | 0;
  }
  function _trinkle($0, $1, $2, $3, $4, $5, $6) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    $6 = $6 | 0;
    var $$0$lcssa = 0,
      $$045$lcssa = 0,
      $$04551 = 0,
      $$0455780 = 0,
      $$046$lcssa = 0,
      $$04653 = 0,
      $$0465681 = 0,
      $$047$lcssa = 0,
      $$0475582 = 0,
      $$049 = 0,
      $$05879 = 0,
      $$05879$phi = 0,
      $11 = 0,
      $12 = 0,
      $16 = 0,
      $20 = 0,
      $24 = 0,
      $27 = 0,
      $28 = 0,
      $35 = 0,
      $37 = 0,
      $38 = 0,
      $47 = 0,
      $7 = 0,
      $8 = 0,
      $9 = 0,
      label = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 240) | 0;
    $7 = (sp + 232) | 0;
    $8 = sp;
    $9 = HEAP32[$3 >> 2] | 0;
    HEAP32[$7 >> 2] = $9;
    $11 = HEAP32[($3 + 4) >> 2] | 0;
    $12 = ($7 + 4) | 0;
    HEAP32[$12 >> 2] = $11;
    HEAP32[$8 >> 2] = $0;
    L1: do {
      if ((($9 | 0) != 1) | (($11 | 0) != 0)) {
        $16 = (0 - $1) | 0;
        $20 = ($0 + (0 - (HEAP32[($6 + ($4 << 2)) >> 2] | 0))) | 0;
        if ((FUNCTION_TABLE_iii[$2 & 3]($20, $0) | 0) < 1) {
          $$0$lcssa = $0;
          $$045$lcssa = 1;
          $$046$lcssa = $4;
          $$047$lcssa = $5;
          label = 9;
        } else {
          $$0455780 = 1;
          $$0465681 = $4;
          $$0475582 = ($5 | 0) == 0;
          $$05879 = $0;
          $28 = $20;
          while (1) {
            if ($$0475582 & (($$0465681 | 0) > 1)) {
              $24 = ($$05879 + $16) | 0;
              $27 = HEAP32[($6 + (($$0465681 + -2) << 2)) >> 2] | 0;
              if ((FUNCTION_TABLE_iii[$2 & 3]($24, $28) | 0) > -1) {
                $$04551 = $$0455780;
                $$04653 = $$0465681;
                $$049 = $$05879;
                label = 10;
                break L1;
              }
              if (
                (FUNCTION_TABLE_iii[$2 & 3](($24 + (0 - $27)) | 0, $28) | 0) >
                -1
              ) {
                $$04551 = $$0455780;
                $$04653 = $$0465681;
                $$049 = $$05879;
                label = 10;
                break L1;
              }
            }
            $35 = ($$0455780 + 1) | 0;
            HEAP32[($8 + ($$0455780 << 2)) >> 2] = $28;
            $37 = _pntz($7) | 0;
            _shr($7, $37);
            $38 = ($37 + $$0465681) | 0;
            if (
              !(((HEAP32[$7 >> 2] | 0) != 1) | ((HEAP32[$12 >> 2] | 0) != 0))
            ) {
              $$04551 = $35;
              $$04653 = $38;
              $$049 = $28;
              label = 10;
              break L1;
            }
            $47 = ($28 + (0 - (HEAP32[($6 + ($38 << 2)) >> 2] | 0))) | 0;
            if (
              (FUNCTION_TABLE_iii[$2 & 3]($47, HEAP32[$8 >> 2] | 0) | 0) <
              1
            ) {
              $$0$lcssa = $28;
              $$045$lcssa = $35;
              $$046$lcssa = $38;
              $$047$lcssa = 0;
              label = 9;
              break;
            } else {
              $$05879$phi = $28;
              $$0455780 = $35;
              $$0465681 = $38;
              $$0475582 = 1;
              $28 = $47;
              $$05879 = $$05879$phi;
            }
          }
        }
      } else {
        $$0$lcssa = $0;
        $$045$lcssa = 1;
        $$046$lcssa = $4;
        $$047$lcssa = $5;
        label = 9;
      }
    } while (0);
    if ((label | 0) == 9)
      if (!$$047$lcssa) {
        $$04551 = $$045$lcssa;
        $$04653 = $$046$lcssa;
        $$049 = $$0$lcssa;
        label = 10;
      }
    if ((label | 0) == 10) {
      _cycle($1, $8, $$04551);
      _sift($$049, $1, $2, $$04653, $6);
    }
    STACKTOP = sp;
    return;
  }
  function _vorbis_decode_initial($0, $1, $2, $3, $4, $5) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    var $$0 = 0,
      $$06272 = 0,
      $$06273 = 0,
      $$06470 = 0,
      $$06471 = 0,
      $11 = 0,
      $30 = 0,
      $34 = 0,
      $38 = 0,
      $42 = 0,
      $45 = 0,
      $46 = 0,
      $47 = 0,
      $48 = 0,
      $49 = 0,
      $57 = 0,
      $58 = 0,
      $59 = 0,
      $66 = 0,
      $67 = 0,
      $68 = 0,
      $8 = 0,
      $phitmp68 = 0,
      $storemerge = 0,
      $storemerge65 = 0,
      label = 0;
    HEAP32[($0 + 1496) >> 2] = 0;
    HEAP32[($0 + 1492) >> 2] = 0;
    $8 = ($0 + 84) | 0;
    L1: do {
      if (!(HEAP32[$8 >> 2] | 0)) {
        $11 = ($0 + 36) | 0;
        while (1) {
          if (!(_maybe_start_packet($0) | 0)) {
            $$0 = 0;
            break L1;
          }
          if (!(_get_bits($0, 1) | 0)) break;
          if (HEAP8[$11 >> 0] | 0) {
            label = 7;
            break;
          }
          do {} while ((_get8_packet($0) | 0) != -1);
          if (HEAP32[$8 >> 2] | 0) {
            $$0 = 0;
            break L1;
          }
        }
        if ((label | 0) == 7) {
          _error($0, 35);
          $$0 = 0;
          break;
        }
        if (HEAP32[($0 + 68) >> 2] | 0)
          if ((HEAP32[($0 + 72) >> 2] | 0) != (HEAP32[($0 + 80) >> 2] | 0))
            ___assert_fail(1067, 1052, 3128, 1123);
        $30 = ($0 + 396) | 0;
        $34 = _get_bits($0, _ilog(((HEAP32[$30 >> 2] | 0) + -1) | 0) | 0) | 0;
        if (($34 | 0) == -1) $$0 = 0;
        else if (($34 | 0) < (HEAP32[$30 >> 2] | 0)) {
          HEAP32[$5 >> 2] = $34;
          $38 = ($0 + 400 + (($34 * 6) | 0)) | 0;
          if (!(HEAP8[$38 >> 0] | 0)) {
            $42 = HEAP32[($0 + 100) >> 2] | 0;
            $$06273 = 0;
            $$06471 = $42;
            $67 = $42 >> 1;
            $68 = 1;
            label = 18;
          } else {
            $45 = HEAP32[($0 + 104) >> 2] | 0;
            $46 = _get_bits($0, 1) | 0;
            $47 = _get_bits($0, 1) | 0;
            $phitmp68 = (HEAP8[$38 >> 0] | 0) == 0;
            $48 = $45 >> 1;
            if ((($46 | 0) != 0) | $phitmp68) {
              $$06273 = $47;
              $$06471 = $45;
              $67 = $48;
              $68 = $phitmp68;
              label = 18;
            } else {
              $49 = ($0 + 100) | 0;
              HEAP32[$1 >> 2] = ($45 - (HEAP32[$49 >> 2] | 0)) >> 2;
              $$06272 = $47;
              $$06470 = $45;
              $57 = $phitmp68;
              $66 = $48;
              $storemerge = ((HEAP32[$49 >> 2] | 0) + $45) >> 2;
            }
          }
          if ((label | 0) == 18) {
            HEAP32[$1 >> 2] = 0;
            $$06272 = $$06273;
            $$06470 = $$06471;
            $57 = $68;
            $66 = $67;
            $storemerge = $67;
          }
          HEAP32[$2 >> 2] = $storemerge;
          if ((($$06272 | 0) != 0) | $57) {
            HEAP32[$3 >> 2] = $66;
            $storemerge65 = $$06470;
          } else {
            $58 = ($$06470 * 3) | 0;
            $59 = ($0 + 100) | 0;
            HEAP32[$3 >> 2] = ($58 - (HEAP32[$59 >> 2] | 0)) >> 2;
            $storemerge65 = ((HEAP32[$59 >> 2] | 0) + $58) >> 2;
          }
          HEAP32[$4 >> 2] = $storemerge65;
          $$0 = 1;
        } else $$0 = 0;
      } else $$0 = 0;
    } while (0);
    return $$0 | 0;
  }
  function _imdct_step3_inner_s_loop_ld654($0, $1, $2, $3, $4) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    var $$086 = 0,
      $10 = 0,
      $11 = 0,
      $13 = 0,
      $14 = 0,
      $15 = 0,
      $17 = 0,
      $18 = 0,
      $19 = 0,
      $20 = 0,
      $24 = 0,
      $25 = 0,
      $26 = 0,
      $27 = 0,
      $28 = 0,
      $29 = 0,
      $30 = 0,
      $31 = 0,
      $32 = 0,
      $33 = 0,
      $40 = 0,
      $41 = 0,
      $42 = 0,
      $43 = 0,
      $45 = 0,
      $46 = 0,
      $47 = 0,
      $48 = 0,
      $52 = 0,
      $53 = 0,
      $54 = 0,
      $55 = 0,
      $56 = 0,
      $57 = 0,
      $58 = 0,
      $59 = 0,
      $60 = 0,
      $61 = 0,
      $7 = 0,
      $8 = 0;
    $7 = +HEAPF32[($3 + (($4 >> 3) << 2)) >> 2];
    $8 = ($1 + ($2 << 2)) | 0;
    $10 = (0 - ($0 << 4)) | 0;
    $11 = ($8 + ($10 << 2)) | 0;
    if (($10 | 0) < 0) {
      $$086 = $8;
      do {
        $13 = +HEAPF32[$$086 >> 2];
        $14 = ($$086 + -32) | 0;
        $15 = +HEAPF32[$14 >> 2];
        $17 = ($$086 + -4) | 0;
        $18 = +HEAPF32[$17 >> 2];
        $19 = ($$086 + -36) | 0;
        $20 = +HEAPF32[$19 >> 2];
        HEAPF32[$$086 >> 2] = $13 + $15;
        HEAPF32[$17 >> 2] = $18 + $20;
        HEAPF32[$14 >> 2] = $13 - $15;
        HEAPF32[$19 >> 2] = $18 - $20;
        $24 = ($$086 + -8) | 0;
        $25 = +HEAPF32[$24 >> 2];
        $26 = ($$086 + -40) | 0;
        $27 = +HEAPF32[$26 >> 2];
        $28 = $25 - $27;
        $29 = ($$086 + -12) | 0;
        $30 = +HEAPF32[$29 >> 2];
        $31 = ($$086 + -44) | 0;
        $32 = +HEAPF32[$31 >> 2];
        $33 = $30 - $32;
        HEAPF32[$24 >> 2] = $25 + $27;
        HEAPF32[$29 >> 2] = $30 + $32;
        HEAPF32[$26 >> 2] = $7 * ($28 + $33);
        HEAPF32[$31 >> 2] = $7 * ($33 - $28);
        $40 = ($$086 + -48) | 0;
        $41 = +HEAPF32[$40 >> 2];
        $42 = ($$086 + -16) | 0;
        $43 = +HEAPF32[$42 >> 2];
        $45 = ($$086 + -20) | 0;
        $46 = +HEAPF32[$45 >> 2];
        $47 = ($$086 + -52) | 0;
        $48 = +HEAPF32[$47 >> 2];
        HEAPF32[$42 >> 2] = $41 + $43;
        HEAPF32[$45 >> 2] = $46 + $48;
        HEAPF32[$40 >> 2] = $46 - $48;
        HEAPF32[$47 >> 2] = $41 - $43;
        $52 = ($$086 + -56) | 0;
        $53 = +HEAPF32[$52 >> 2];
        $54 = ($$086 + -24) | 0;
        $55 = +HEAPF32[$54 >> 2];
        $56 = $53 - $55;
        $57 = ($$086 + -28) | 0;
        $58 = +HEAPF32[$57 >> 2];
        $59 = ($$086 + -60) | 0;
        $60 = +HEAPF32[$59 >> 2];
        $61 = $58 - $60;
        HEAPF32[$54 >> 2] = $53 + $55;
        HEAPF32[$57 >> 2] = $58 + $60;
        HEAPF32[$52 >> 2] = $7 * ($56 + $61);
        HEAPF32[$59 >> 2] = $7 * ($56 - $61);
        _iter_54($$086);
        _iter_54($14);
        $$086 = ($$086 + -64) | 0;
      } while ($$086 >>> 0 > $11 >>> 0);
    }
    return;
  }
  function _memcpy(dest, src, num) {
    dest = dest | 0;
    src = src | 0;
    num = num | 0;
    var ret = 0,
      aligned_dest_end = 0,
      block_aligned_dest_end = 0,
      dest_end = 0;
    if ((num | 0) >= 8192)
      return _emscripten_memcpy_big(dest | 0, src | 0, num | 0) | 0;
    ret = dest | 0;
    dest_end = (dest + num) | 0;
    if ((dest & 3) == (src & 3)) {
      while (dest & 3) {
        if (!num) return ret | 0;
        HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
        dest = (dest + 1) | 0;
        src = (src + 1) | 0;
        num = (num - 1) | 0;
      }
      aligned_dest_end = (dest_end & -4) | 0;
      block_aligned_dest_end = (aligned_dest_end - 64) | 0;
      while ((dest | 0) <= (block_aligned_dest_end | 0)) {
        HEAP32[dest >> 2] = HEAP32[src >> 2];
        HEAP32[(dest + 4) >> 2] = HEAP32[(src + 4) >> 2];
        HEAP32[(dest + 8) >> 2] = HEAP32[(src + 8) >> 2];
        HEAP32[(dest + 12) >> 2] = HEAP32[(src + 12) >> 2];
        HEAP32[(dest + 16) >> 2] = HEAP32[(src + 16) >> 2];
        HEAP32[(dest + 20) >> 2] = HEAP32[(src + 20) >> 2];
        HEAP32[(dest + 24) >> 2] = HEAP32[(src + 24) >> 2];
        HEAP32[(dest + 28) >> 2] = HEAP32[(src + 28) >> 2];
        HEAP32[(dest + 32) >> 2] = HEAP32[(src + 32) >> 2];
        HEAP32[(dest + 36) >> 2] = HEAP32[(src + 36) >> 2];
        HEAP32[(dest + 40) >> 2] = HEAP32[(src + 40) >> 2];
        HEAP32[(dest + 44) >> 2] = HEAP32[(src + 44) >> 2];
        HEAP32[(dest + 48) >> 2] = HEAP32[(src + 48) >> 2];
        HEAP32[(dest + 52) >> 2] = HEAP32[(src + 52) >> 2];
        HEAP32[(dest + 56) >> 2] = HEAP32[(src + 56) >> 2];
        HEAP32[(dest + 60) >> 2] = HEAP32[(src + 60) >> 2];
        dest = (dest + 64) | 0;
        src = (src + 64) | 0;
      }
      while ((dest | 0) < (aligned_dest_end | 0)) {
        HEAP32[dest >> 2] = HEAP32[src >> 2];
        dest = (dest + 4) | 0;
        src = (src + 4) | 0;
      }
    } else {
      aligned_dest_end = (dest_end - 4) | 0;
      while ((dest | 0) < (aligned_dest_end | 0)) {
        HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
        HEAP8[(dest + 1) >> 0] = HEAP8[(src + 1) >> 0] | 0;
        HEAP8[(dest + 2) >> 0] = HEAP8[(src + 2) >> 0] | 0;
        HEAP8[(dest + 3) >> 0] = HEAP8[(src + 3) >> 0] | 0;
        dest = (dest + 4) | 0;
        src = (src + 4) | 0;
      }
    }
    while ((dest | 0) < (dest_end | 0)) {
      HEAP8[dest >> 0] = HEAP8[src >> 0] | 0;
      dest = (dest + 1) | 0;
      src = (src + 1) | 0;
    }
    return ret | 0;
  }
  function _do_floor($0, $1, $2, $3, $4, $5) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    var $$062$lcssa = 0,
      $$0624 = 0,
      $$063$lcssa = 0,
      $$0633 = 0,
      $$0652 = 0,
      $$0661 = 0,
      $$1 = 0,
      $$164 = 0,
      $14 = 0,
      $19 = 0,
      $22 = 0,
      $25 = 0,
      $26 = 0,
      $27 = 0,
      $31 = 0,
      $33 = 0,
      $38 = 0,
      $41 = 0,
      $45 = 0,
      $48 = 0,
      $49 = 0,
      $53 = 0,
      $6 = 0;
    $6 = $3 >> 1;
    $14 =
      HEAPU8[
        ((HEAPU8[((HEAP32[($1 + 4) >> 2] | 0) + (($2 * 3) | 0) + 2) >> 0] | 0) +
          ($1 + 9)) >>
          0
      ] | 0;
    if (!(HEAP16[($0 + 120 + ($14 << 1)) >> 1] | 0)) _error($0, 21);
    else {
      $19 = HEAP32[($0 + 248) >> 2] | 0;
      $22 = ($19 + (($14 * 1596) | 0) + 1588) | 0;
      $25 = Math_imul(HEAPU8[$22 >> 0] | 0, HEAP16[$5 >> 1] | 0) | 0;
      $26 = ($19 + (($14 * 1596) | 0) + 1592) | 0;
      $27 = HEAP32[$26 >> 2] | 0;
      if (($27 | 0) > 1) {
        $$0624 = $25;
        $$0633 = 0;
        $$0652 = 1;
        $53 = $27;
        while (1) {
          $31 = HEAPU8[($19 + (($14 * 1596) | 0) + 838 + $$0652) >> 0] | 0;
          $33 = HEAP16[($5 + ($31 << 1)) >> 1] | 0;
          if (($33 << 16) >> 16 > -1) {
            $38 = Math_imul(HEAPU8[$22 >> 0] | 0, ($33 << 16) >> 16) | 0;
            $41 =
              HEAPU16[($19 + (($14 * 1596) | 0) + 338 + ($31 << 1)) >> 1] | 0;
            if (($$0633 | 0) == ($41 | 0)) {
              $$1 = $38;
              $$164 = $$0633;
              $45 = $53;
            } else {
              _draw_line($4, $$0633, $$0624, $41, $38, $6);
              $$1 = $38;
              $$164 = $41;
              $45 = HEAP32[$26 >> 2] | 0;
            }
          } else {
            $$1 = $$0624;
            $$164 = $$0633;
            $45 = $53;
          }
          $$0652 = ($$0652 + 1) | 0;
          if (($$0652 | 0) >= ($45 | 0)) {
            $$062$lcssa = $$1;
            $$063$lcssa = $$164;
            break;
          } else {
            $$0624 = $$1;
            $$0633 = $$164;
            $53 = $45;
          }
        }
      } else {
        $$062$lcssa = $25;
        $$063$lcssa = 0;
      }
      if (($$063$lcssa | 0) < ($6 | 0)) {
        $48 = +HEAPF32[(28 + ($$062$lcssa << 2)) >> 2];
        $$0661 = $$063$lcssa;
        do {
          $49 = ($4 + ($$0661 << 2)) | 0;
          HEAPF32[$49 >> 2] = $48 * +HEAPF32[$49 >> 2];
          $$0661 = ($$0661 + 1) | 0;
        } while (($$0661 | 0) != ($6 | 0));
      }
    }
    return;
  }
  function _vorbis_finish_frame($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$0 = 0,
      $$06775 = 0,
      $$06878 = 0,
      $$06972 = 0,
      $$07073 = 0,
      $11 = 0,
      $12 = 0,
      $14 = 0,
      $16 = 0,
      $18 = 0,
      $33 = 0,
      $34 = 0,
      $36 = 0,
      $38 = 0,
      $4 = 0,
      $40 = 0,
      $42 = 0,
      $45 = 0,
      $49 = 0,
      $5 = 0,
      $52 = 0,
      $53 = 0,
      $7 = 0,
      $9 = 0;
    $4 = ($0 + 980) | 0;
    $5 = HEAP32[$4 >> 2] | 0;
    if (!$5) {
      $34 = HEAP32[($0 + 4) >> 2] | 0;
      $49 = 0;
    } else {
      $7 = _get_window($0, $5) | 0;
      $9 = HEAP32[($0 + 4) >> 2] | 0;
      if (($9 | 0) > 0) {
        $11 = ($5 | 0) > 0;
        $12 = ($5 + -1) | 0;
        $$06878 = 0;
        do {
          if ($11) {
            $14 = HEAP32[($0 + 788 + ($$06878 << 2)) >> 2] | 0;
            $16 = HEAP32[($0 + 916 + ($$06878 << 2)) >> 2] | 0;
            $$06775 = 0;
            do {
              $18 = ($14 + (($$06775 + $2) << 2)) | 0;
              HEAPF32[$18 >> 2] =
                +HEAPF32[$18 >> 2] * +HEAPF32[($7 + ($$06775 << 2)) >> 2] +
                +HEAPF32[($16 + ($$06775 << 2)) >> 2] *
                  +HEAPF32[($7 + (($12 - $$06775) << 2)) >> 2];
              $$06775 = ($$06775 + 1) | 0;
            } while (($$06775 | 0) != ($5 | 0));
          }
          $$06878 = ($$06878 + 1) | 0;
        } while (($$06878 | 0) < ($9 | 0));
      }
      $34 = $9;
      $49 = HEAP32[$4 >> 2] | 0;
    }
    $33 = ($1 - $3) | 0;
    HEAP32[$4 >> 2] = $33;
    if (($34 | 0) > 0) {
      $36 = ($1 | 0) > ($3 | 0);
      $$07073 = 0;
      do {
        if ($36) {
          $38 = HEAP32[($0 + 788 + ($$07073 << 2)) >> 2] | 0;
          $40 = HEAP32[($0 + 916 + ($$07073 << 2)) >> 2] | 0;
          $$06972 = 0;
          $42 = $3;
          while (1) {
            HEAP32[($40 + ($$06972 << 2)) >> 2] =
              HEAP32[($38 + ($42 << 2)) >> 2];
            $45 = ($$06972 + 1) | 0;
            if (($45 | 0) == ($33 | 0)) break;
            else {
              $$06972 = $45;
              $42 = ($45 + $3) | 0;
            }
          }
        }
        $$07073 = ($$07073 + 1) | 0;
      } while (($$07073 | 0) < ($34 | 0));
    }
    $52 = ((($1 | 0) < ($3 | 0) ? $1 : $3) - $2) | 0;
    $53 = ($0 + 1404) | 0;
    if (!$49) $$0 = 0;
    else {
      HEAP32[$53 >> 2] = (HEAP32[$53 >> 2] | 0) + $52;
      $$0 = $52;
    }
    return $$0 | 0;
  }
  function _stb_vorbis_get_samples_float($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$ = 0,
      $$047$lcssa = 0,
      $$049 = 0,
      $$150 = 0,
      $$155 = 0,
      $$51 = 0,
      $10 = 0,
      $11 = 0,
      $12 = 0,
      $15 = 0,
      $16 = 0,
      $21 = 0,
      $27 = 0,
      $29 = 0,
      $4 = 0,
      $42 = 0,
      $6 = 0,
      $8 = 0,
      $9 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 16) | 0;
    $4 = sp;
    $6 = HEAP32[($0 + 4) >> 2] | 0;
    $$ = ($6 | 0) > ($1 | 0) ? $1 : $6;
    $8 = ($0 + 1496) | 0;
    $9 = ($0 + 1492) | 0;
    $10 = ($$ | 0) > 0;
    $11 = ($0 + 788) | 0;
    $12 = ($$ | 0) == 1;
    $$049 = 0;
    while (1) {
      if (($$049 | 0) >= ($3 | 0)) {
        $$150 = $$049;
        break;
      }
      $15 = HEAP32[$9 >> 2] | 0;
      $16 = ((HEAP32[$8 >> 2] | 0) - $15) | 0;
      $$51 = (($16 + $$049) | 0) < ($3 | 0) ? $16 : ($3 - $$049) | 0;
      if ($$51 | 0) {
        if ($10) {
          $21 = $$51 << 2;
          _memcpy(
            ((HEAP32[$2 >> 2] | 0) + ($$049 << 2)) | 0,
            ((HEAP32[$11 >> 2] | 0) + ($15 << 2)) | 0,
            $21 | 0
          ) | 0;
          if ($12) $$047$lcssa = $$;
          else {
            $29 = 1;
            do {
              _memcpy(
                ((HEAP32[($2 + ($29 << 2)) >> 2] | 0) + ($$049 << 2)) | 0,
                ((HEAP32[($0 + 788 + ($29 << 2)) >> 2] | 0) +
                  (HEAP32[$9 >> 2] << 2)) |
                  0,
                $21 | 0
              ) | 0;
              $29 = ($29 + 1) | 0;
            } while (($29 | 0) < ($$ | 0));
            $$047$lcssa = $$;
          }
        } else $$047$lcssa = 0;
        if (($$047$lcssa | 0) < ($1 | 0)) {
          $27 = $$51 << 2;
          $$155 = $$047$lcssa;
          do {
            _memset(
              ((HEAP32[($2 + ($$155 << 2)) >> 2] | 0) + ($$049 << 2)) | 0,
              0,
              $27 | 0
            ) | 0;
            $$155 = ($$155 + 1) | 0;
          } while (($$155 | 0) < ($1 | 0));
        }
      }
      $42 = ($$51 + $$049) | 0;
      HEAP32[$9 >> 2] = (HEAP32[$9 >> 2] | 0) + $$51;
      if (($42 | 0) == ($3 | 0)) {
        $$150 = $3;
        break;
      }
      if (!(_stb_vorbis_get_frame_float($0, 0, $4) | 0)) {
        $$150 = $42;
        break;
      } else $$049 = $42;
    }
    STACKTOP = sp;
    return $$150 | 0;
  }
  function _start_page_no_capturepattern($0) {
    $0 = $0 | 0;
    var $$0 = 0,
      $$058$in = 0,
      $$059$lcssa = 0,
      $$05963 = 0,
      $$06062 = 0,
      $10 = 0,
      $11 = 0,
      $15 = 0,
      $27 = 0,
      $3 = 0,
      $36 = 0,
      $5 = 0,
      $6 = 0,
      $7 = 0,
      $$058$in$looptemp = 0;
    do {
      if (!(((_get8($0) | 0) << 24) >> 24)) {
        $3 = _get8($0) | 0;
        HEAP8[($0 + 1363) >> 0] = $3;
        $5 = _get32($0) | 0;
        $6 = _get32($0) | 0;
        _get32($0) | 0;
        $7 = _get32($0) | 0;
        HEAP32[($0 + 1100) >> 2] = $7;
        _get32($0) | 0;
        $10 = (_get8($0) | 0) & 255;
        $11 = ($0 + 1104) | 0;
        HEAP32[$11 >> 2] = $10;
        if (!(_getn($0, ($0 + 1108) | 0, $10) | 0)) {
          _error($0, 10);
          $$0 = 0;
          break;
        }
        $15 = ($0 + 1392) | 0;
        HEAP32[$15 >> 2] = -2;
        L6: do {
          if ((($6 & $5) | 0) != -1) {
            $$058$in = HEAP32[$11 >> 2] | 0;
            do {
              $$058$in$looptemp = $$058$in;
              $$058$in = ($$058$in + -1) | 0;
              if (($$058$in$looptemp | 0) <= 0) break L6;
            } while ((HEAP8[($0 + 1108 + $$058$in) >> 0] | 0) == -1);
            HEAP32[$15 >> 2] = $$058$in;
            HEAP32[($0 + 1396) >> 2] = $5;
          }
        } while (0);
        if (HEAP8[($0 + 1365) >> 0] | 0) {
          $27 = HEAP32[$11 >> 2] | 0;
          if (($27 | 0) > 0) {
            $$05963 = 0;
            $$06062 = 0;
            do {
              $$05963 =
                ($$05963 + (HEAPU8[($0 + 1108 + $$06062) >> 0] | 0)) | 0;
              $$06062 = ($$06062 + 1) | 0;
            } while (($$06062 | 0) < ($27 | 0));
            $$059$lcssa = ($$05963 + 27) | 0;
          } else $$059$lcssa = 27;
          $36 = HEAP32[($0 + 40) >> 2] | 0;
          HEAP32[($0 + 44) >> 2] = $36;
          HEAP32[($0 + 48) >> 2] = $$059$lcssa + $27 + $36;
          HEAP32[($0 + 52) >> 2] = $5;
        }
        HEAP32[($0 + 1368) >> 2] = 0;
        $$0 = 1;
      } else {
        _error($0, 31);
        $$0 = 0;
      }
    } while (0);
    return $$0 | 0;
  }
  function _compute_twiddle_factors($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$04044 = 0,
      $$045 = 0,
      $$14142 = 0,
      $$143 = 0,
      $13 = 0,
      $15 = 0,
      $19 = 0,
      $20 = 0,
      $25 = 0,
      $28 = 0,
      $32 = 0,
      $36 = 0,
      $4 = 0,
      $40 = 0,
      $42 = 0,
      $46 = 0,
      $5 = 0,
      $7 = 0,
      $9 = 0;
    $4 = $0 >> 2;
    $5 = $0 >> 3;
    if (($4 | 0) > 0) {
      $7 = +($0 | 0);
      $$04044 = 0;
      $$045 = 0;
      while (1) {
        $13 = (+(($$04044 << 2) | 0) * 3.141592653589793) / $7;
        $15 = +Math_cos(+$13);
        HEAPF32[($1 + ($$045 << 2)) >> 2] = $15;
        $19 = -+Math_sin(+$13);
        $20 = $$045 | 1;
        HEAPF32[($1 + ($20 << 2)) >> 2] = $19;
        $25 = ((+($20 | 0) * 3.141592653589793) / $7) * 0.5;
        $28 = +Math_cos(+$25) * 0.5;
        HEAPF32[($2 + ($$045 << 2)) >> 2] = $28;
        $32 = +Math_sin(+$25) * 0.5;
        HEAPF32[($2 + ($20 << 2)) >> 2] = $32;
        $$04044 = ($$04044 + 1) | 0;
        if (($$04044 | 0) == ($4 | 0)) break;
        else $$045 = ($$045 + 2) | 0;
      }
    }
    if (($5 | 0) > 0) {
      $9 = +($0 | 0);
      $$14142 = 0;
      $$143 = 0;
      while (1) {
        $36 = $$143 | 1;
        $40 = (+(($36 << 1) | 0) * 3.141592653589793) / $9;
        $42 = +Math_cos(+$40);
        HEAPF32[($3 + ($$143 << 2)) >> 2] = $42;
        $46 = -+Math_sin(+$40);
        HEAPF32[($3 + ($36 << 2)) >> 2] = $46;
        $$14142 = ($$14142 + 1) | 0;
        if (($$14142 | 0) == ($5 | 0)) break;
        else $$143 = ($$143 + 2) | 0;
      }
    }
    return;
  }
  function _codebook_decode($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$ = 0,
      $$0 = 0,
      $$04046 = 0,
      $$04145 = 0,
      $$144 = 0,
      $12 = 0,
      $14 = 0,
      $15 = 0,
      $17 = 0,
      $21 = 0,
      $22 = 0,
      $33 = 0,
      $4 = 0,
      $6 = 0,
      $8 = 0;
    $4 = _codebook_decode_start($0, $1) | 0;
    do {
      if (($4 | 0) < 0) $$0 = 0;
      else {
        $6 = HEAP32[$1 >> 2] | 0;
        $$ = ($6 | 0) < ($3 | 0) ? $6 : $3;
        $8 = Math_imul($6, $4) | 0;
        $12 = ($$ | 0) > 0;
        if (!(HEAP8[($1 + 22) >> 0] | 0)) {
          if (!$12) {
            $$0 = 1;
            break;
          }
          $17 = HEAP32[($1 + 28) >> 2] | 0;
          $$144 = 0;
          do {
            $33 = ($2 + ($$144 << 2)) | 0;
            HEAPF32[$33 >> 2] =
              +HEAPF32[$33 >> 2] +
              (+HEAPF32[($17 + (($$144 + $8) << 2)) >> 2] + 0);
            $$144 = ($$144 + 1) | 0;
          } while (($$144 | 0) < ($$ | 0));
          $$0 = 1;
        } else {
          if (!$12) {
            $$0 = 1;
            break;
          }
          $14 = HEAP32[($1 + 28) >> 2] | 0;
          $15 = ($1 + 12) | 0;
          $$04046 = 0;
          $$04145 = 0;
          while (1) {
            $21 = $$04046 + +HEAPF32[($14 + (($$04145 + $8) << 2)) >> 2];
            $22 = ($2 + ($$04145 << 2)) | 0;
            HEAPF32[$22 >> 2] = +HEAPF32[$22 >> 2] + $21;
            $$04145 = ($$04145 + 1) | 0;
            if (($$04145 | 0) >= ($$ | 0)) {
              $$0 = 1;
              break;
            } else $$04046 = $21 + +HEAPF32[$15 >> 2];
          }
        }
      }
    } while (0);
    return $$0 | 0;
  }
  function _memset(ptr, value, num) {
    ptr = ptr | 0;
    value = value | 0;
    num = num | 0;
    var end = 0,
      aligned_end = 0,
      block_aligned_end = 0,
      value4 = 0;
    end = (ptr + num) | 0;
    value = value & 255;
    if ((num | 0) >= 67) {
      while (ptr & 3) {
        HEAP8[ptr >> 0] = value;
        ptr = (ptr + 1) | 0;
      }
      aligned_end = (end & -4) | 0;
      block_aligned_end = (aligned_end - 64) | 0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);
      while ((ptr | 0) <= (block_aligned_end | 0)) {
        HEAP32[ptr >> 2] = value4;
        HEAP32[(ptr + 4) >> 2] = value4;
        HEAP32[(ptr + 8) >> 2] = value4;
        HEAP32[(ptr + 12) >> 2] = value4;
        HEAP32[(ptr + 16) >> 2] = value4;
        HEAP32[(ptr + 20) >> 2] = value4;
        HEAP32[(ptr + 24) >> 2] = value4;
        HEAP32[(ptr + 28) >> 2] = value4;
        HEAP32[(ptr + 32) >> 2] = value4;
        HEAP32[(ptr + 36) >> 2] = value4;
        HEAP32[(ptr + 40) >> 2] = value4;
        HEAP32[(ptr + 44) >> 2] = value4;
        HEAP32[(ptr + 48) >> 2] = value4;
        HEAP32[(ptr + 52) >> 2] = value4;
        HEAP32[(ptr + 56) >> 2] = value4;
        HEAP32[(ptr + 60) >> 2] = value4;
        ptr = (ptr + 64) | 0;
      }
      while ((ptr | 0) < (aligned_end | 0)) {
        HEAP32[ptr >> 2] = value4;
        ptr = (ptr + 4) | 0;
      }
    }
    while ((ptr | 0) < (end | 0)) {
      HEAP8[ptr >> 0] = value;
      ptr = (ptr + 1) | 0;
    }
    return (end - num) | 0;
  }
  function _sift($0, $1, $2, $3, $4) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    var $$0$lcssa = 0,
      $$029$be = 0,
      $$02932 = 0,
      $$030$be = 0,
      $$03031 = 0,
      $$033 = 0,
      $13 = 0,
      $14 = 0,
      $21 = 0,
      $22 = 0,
      $5 = 0,
      $7 = 0,
      $8 = 0,
      $9 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 240) | 0;
    $5 = sp;
    HEAP32[$5 >> 2] = $0;
    L1: do {
      if (($3 | 0) > 1) {
        $7 = (0 - $1) | 0;
        $$02932 = $0;
        $$03031 = $3;
        $$033 = 1;
        $14 = $0;
        while (1) {
          $8 = ($$02932 + $7) | 0;
          $9 = ($$03031 + -2) | 0;
          $13 = ($8 + (0 - (HEAP32[($4 + ($9 << 2)) >> 2] | 0))) | 0;
          if ((FUNCTION_TABLE_iii[$2 & 3]($14, $13) | 0) > -1)
            if ((FUNCTION_TABLE_iii[$2 & 3]($14, $8) | 0) > -1) {
              $$0$lcssa = $$033;
              break L1;
            }
          $21 = ($$033 + 1) | 0;
          $22 = ($5 + ($$033 << 2)) | 0;
          if ((FUNCTION_TABLE_iii[$2 & 3]($13, $8) | 0) > -1) {
            HEAP32[$22 >> 2] = $13;
            $$029$be = $13;
            $$030$be = ($$03031 + -1) | 0;
          } else {
            HEAP32[$22 >> 2] = $8;
            $$029$be = $8;
            $$030$be = $9;
          }
          if (($$030$be | 0) <= 1) {
            $$0$lcssa = $21;
            break L1;
          }
          $$02932 = $$029$be;
          $$03031 = $$030$be;
          $$033 = $21;
          $14 = HEAP32[$5 >> 2] | 0;
        }
      } else $$0$lcssa = 1;
    } while (0);
    _cycle($1, $5, $$0$lcssa);
    STACKTOP = sp;
    return;
  }
  function _stb_vorbis_get_frame_float($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $$020 = 0,
      $$021 = 0,
      $14 = 0,
      $16 = 0,
      $17 = 0,
      $18 = 0,
      $25 = 0,
      $3 = 0,
      $31 = 0,
      $4 = 0,
      $5 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 16) | 0;
    $3 = (sp + 8) | 0;
    $4 = (sp + 4) | 0;
    $5 = sp;
    do {
      if (!(HEAP8[($0 + 36) >> 0] | 0)) {
        if (!(_vorbis_decode_packet($0, $3, $5, $4) | 0)) {
          HEAP32[($0 + 1496) >> 2] = 0;
          HEAP32[($0 + 1492) >> 2] = 0;
          $$020 = 0;
          break;
        }
        $14 = HEAP32[$5 >> 2] | 0;
        $16 =
          _vorbis_finish_frame(
            $0,
            HEAP32[$3 >> 2] | 0,
            $14,
            HEAP32[$4 >> 2] | 0
          ) | 0;
        HEAP32[$3 >> 2] = $16;
        $17 = ($0 + 4) | 0;
        $18 = HEAP32[$17 >> 2] | 0;
        if (($18 | 0) > 0) {
          $$021 = 0;
          do {
            HEAP32[($0 + 852 + ($$021 << 2)) >> 2] =
              (HEAP32[($0 + 788 + ($$021 << 2)) >> 2] | 0) + ($14 << 2);
            $$021 = ($$021 + 1) | 0;
            $25 = HEAP32[$17 >> 2] | 0;
          } while (($$021 | 0) < ($25 | 0));
          $31 = $25;
        } else $31 = $18;
        HEAP32[($0 + 1492) >> 2] = $14;
        HEAP32[($0 + 1496) >> 2] = $16 + $14;
        if ($1 | 0) HEAP32[$1 >> 2] = $31;
        if (!$2) $$020 = $16;
        else {
          HEAP32[$2 >> 2] = $0 + 852;
          $$020 = $16;
        }
      } else {
        _error($0, 2);
        $$020 = 0;
      }
    } while (0);
    STACKTOP = sp;
    return $$020 | 0;
  }
  function _get_bits($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$2 = 0,
      $14 = 0,
      $15 = 0,
      $17 = 0,
      $2 = 0,
      $21 = 0,
      $23 = 0,
      $24 = 0,
      $3 = 0,
      $30 = 0,
      $7 = 0,
      label = 0;
    $2 = ($0 + 1384) | 0;
    $3 = HEAP32[$2 >> 2] | 0;
    L1: do {
      if (($3 | 0) < 0) $$2 = 0;
      else {
        do {
          if (($3 | 0) < ($1 | 0)) {
            if (($1 | 0) > 24) {
              $7 = _get_bits($0, 24) | 0;
              return (((_get_bits($0, ($1 + -24) | 0) | 0) << 24) + $7) | 0;
            }
            if (!$3) HEAP32[($0 + 1380) >> 2] = 0;
            $14 = ($0 + 1380) | 0;
            while (1) {
              $15 = _get8_packet_raw($0) | 0;
              if (($15 | 0) == -1) {
                label = 10;
                break;
              }
              $17 = HEAP32[$2 >> 2] | 0;
              HEAP32[$14 >> 2] = (HEAP32[$14 >> 2] | 0) + ($15 << $17);
              $21 = ($17 + 8) | 0;
              HEAP32[$2 >> 2] = $21;
              if (($21 | 0) >= ($1 | 0)) {
                label = 11;
                break;
              }
            }
            if ((label | 0) == 10) {
              HEAP32[$2 >> 2] = -1;
              $$2 = 0;
              break L1;
            } else if ((label | 0) == 11)
              if (($17 | 0) < -8) {
                $$2 = 0;
                break L1;
              } else {
                $30 = $21;
                break;
              }
          } else $30 = $3;
        } while (0);
        $23 = ($0 + 1380) | 0;
        $24 = HEAP32[$23 >> 2] | 0;
        HEAP32[$23 >> 2] = $24 >>> $1;
        HEAP32[$2 >> 2] = $30 - $1;
        $$2 = $24 & ((1 << $1) + -1);
      }
    } while (0);
    return $$2 | 0;
  }
  function _init_blocksize($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $$0 = 0,
      $10 = 0,
      $11 = 0,
      $13 = 0,
      $15 = 0,
      $18 = 0,
      $22 = 0,
      $5 = 0,
      $6 = 0,
      $7 = 0,
      $8 = 0,
      $9 = 0,
      label = 0;
    $5 = $2 >> 3;
    $6 = ($2 >>> 1) << 2;
    $7 = _setup_malloc($0, $6) | 0;
    $8 = ($0 + 1056 + ($1 << 2)) | 0;
    HEAP32[$8 >> 2] = $7;
    $9 = _setup_malloc($0, $6) | 0;
    $10 = ($0 + 1064 + ($1 << 2)) | 0;
    HEAP32[$10 >> 2] = $9;
    $11 = _setup_malloc($0, $2 & -4) | 0;
    HEAP32[($0 + 1072 + ($1 << 2)) >> 2] = $11;
    $13 = HEAP32[$8 >> 2] | 0;
    do {
      if (!$13) label = 3;
      else {
        $15 = HEAP32[$10 >> 2] | 0;
        if ((($11 | 0) == 0) | (($15 | 0) == 0)) label = 3;
        else {
          _compute_twiddle_factors($2, $13, $15, $11);
          $18 = _setup_malloc($0, $6) | 0;
          HEAP32[($0 + 1080 + ($1 << 2)) >> 2] = $18;
          if (!$18) {
            _error($0, 3);
            $$0 = 0;
            break;
          }
          _compute_window($2, $18);
          $22 = _setup_malloc($0, $5 << 1) | 0;
          HEAP32[($0 + 1088 + ($1 << 2)) >> 2] = $22;
          if (!$22) {
            _error($0, 3);
            $$0 = 0;
            break;
          } else {
            _compute_bitreverse($2, $22);
            $$0 = 1;
            break;
          }
        }
      }
    } while (0);
    if ((label | 0) == 3) {
      _error($0, 3);
      $$0 = 0;
    }
    return $$0 | 0;
  }
  function _draw_line($0, $1, $2, $3, $4, $5) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    var $$ = 0,
      $$05368 = 0,
      $$05666 = 0,
      $$05669 = 0,
      $$155$sink67 = 0,
      $11 = 0,
      $14 = 0,
      $19 = 0,
      $23 = 0,
      $24 = 0,
      $29 = 0,
      $6 = 0,
      $7 = 0,
      $9 = 0;
    $6 = ($4 - $2) | 0;
    $7 = ($3 - $1) | 0;
    $9 = (($6 | 0) / ($7 | 0)) | 0;
    $11 = ($6 >> 31) | 1;
    $14 =
      ((($6 | 0) > -1 ? $6 : (0 - $6) | 0) -
        (Math_imul(($9 | 0) > -1 ? $9 : (0 - $9) | 0, $7) | 0)) |
      0;
    $$ = ($3 | 0) > ($5 | 0) ? $5 : $3;
    if (($$ | 0) > ($1 | 0)) {
      $19 = ($0 + ($1 << 2)) | 0;
      HEAPF32[$19 >> 2] = +HEAPF32[(28 + ($2 << 2)) >> 2] * +HEAPF32[$19 >> 2];
      $$05666 = ($1 + 1) | 0;
      if (($$05666 | 0) < ($$ | 0)) {
        $$05368 = 0;
        $$05669 = $$05666;
        $$155$sink67 = $2;
        while (1) {
          $23 = ($$05368 + $14) | 0;
          $24 = ($23 | 0) < ($7 | 0);
          $$155$sink67 = ($$155$sink67 + $9 + ($24 ? 0 : $11)) | 0;
          $29 = ($0 + ($$05669 << 2)) | 0;
          HEAPF32[$29 >> 2] =
            +HEAPF32[(28 + ($$155$sink67 << 2)) >> 2] * +HEAPF32[$29 >> 2];
          $$05669 = ($$05669 + 1) | 0;
          if (($$05669 | 0) >= ($$ | 0)) break;
          else $$05368 = ($23 - ($24 ? 0 : $7)) | 0;
        }
      }
    }
    return;
  }
  function _compute_accelerated_huffman($0) {
    $0 = $0 | 0;
    var $$ = 0,
      $$0$ph = 0,
      $$027 = 0,
      $$128 = 0,
      $1 = 0,
      $10 = 0,
      $11 = 0,
      $13 = 0,
      $26 = 0,
      $28 = 0,
      $37 = 0,
      $6 = 0,
      $9 = 0;
    _memset(($0 + 36) | 0, -1, 2048) | 0;
    $1 = ($0 + 23) | 0;
    $6 = HEAP32[(HEAP8[$1 >> 0] | 0 ? ($0 + 2092) | 0 : ($0 + 4) | 0) >> 2] | 0;
    $$ = ($6 | 0) < 32767 ? $6 : 32767;
    if (($6 | 0) > 0) {
      $9 = ($0 + 8) | 0;
      $10 = ($0 + 32) | 0;
      $11 = ($0 + 2084) | 0;
      $$128 = 0;
      $13 = HEAP32[$9 >> 2] | 0;
      while (1) {
        if ((HEAPU8[($13 + $$128) >> 0] | 0) < 11) {
          if (!(HEAP8[$1 >> 0] | 0))
            $$0$ph = HEAP32[((HEAP32[$10 >> 2] | 0) + ($$128 << 2)) >> 2] | 0;
          else
            $$0$ph =
              _bit_reverse(
                HEAP32[((HEAP32[$11 >> 2] | 0) + ($$128 << 2)) >> 2] | 0
              ) | 0;
          if ($$0$ph >>> 0 < 1024) {
            $26 = $$128 & 65535;
            $$027 = $$0$ph;
            do {
              HEAP16[($0 + 36 + ($$027 << 1)) >> 1] = $26;
              $28 = HEAP32[$9 >> 2] | 0;
              $$027 = ((1 << HEAPU8[($28 + $$128) >> 0]) + $$027) | 0;
            } while ($$027 >>> 0 < 1024);
            $37 = $28;
          } else $37 = $13;
        } else $37 = $13;
        $$128 = ($$128 + 1) | 0;
        if (($$128 | 0) >= ($$ | 0)) break;
        else $13 = $37;
      }
    }
    return;
  }
  function _codebook_decode_start($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$0 = 0,
      $$1 = 0,
      $12 = 0,
      $13 = 0,
      $19 = 0,
      $22 = 0,
      $23 = 0,
      $5 = 0,
      $8 = 0,
      $9 = 0;
    do {
      if (!(HEAP8[($1 + 21) >> 0] | 0)) {
        _error($0, 21);
        $$0 = -1;
      } else {
        $5 = ($0 + 1384) | 0;
        if ((HEAP32[$5 >> 2] | 0) < 10) _prep_huffman($0);
        $8 = ($0 + 1380) | 0;
        $9 = HEAP32[$8 >> 2] | 0;
        $12 = HEAP16[($1 + 36 + (($9 & 1023) << 1)) >> 1] | 0;
        $13 = ($12 << 16) >> 16;
        if (($12 << 16) >> 16 > -1) {
          $19 = HEAPU8[((HEAP32[($1 + 8) >> 2] | 0) + $13) >> 0] | 0;
          HEAP32[$8 >> 2] = $9 >>> $19;
          $22 = ((HEAP32[$5 >> 2] | 0) - $19) | 0;
          $23 = ($22 | 0) < 0;
          HEAP32[$5 >> 2] = $23 ? 0 : $22;
          $$1 = $23 ? -1 : $13;
        } else $$1 = _codebook_decode_scalar_raw($0, $1) | 0;
        if (HEAP8[($1 + 23) >> 0] | 0)
          if (($$1 | 0) >= (HEAP32[($1 + 2092) >> 2] | 0))
            ___assert_fail(1367, 1052, 1728, 1389);
        if (($$1 | 0) < 0) {
          if (!(HEAP8[($0 + 1364) >> 0] | 0))
            if (HEAP32[($0 + 1372) >> 2] | 0) {
              $$0 = $$1;
              break;
            }
          _error($0, 21);
          $$0 = $$1;
        } else $$0 = $$1;
      }
    } while (0);
    return $$0 | 0;
  }
  function _residue_decode($0, $1, $2, $3, $4, $5) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    var $$03237 = 0,
      $$03440 = 0,
      $$1 = 0,
      $$13341 = 0,
      $10 = 0,
      $12 = 0,
      $23 = 0,
      $9 = 0;
    L1: do {
      if (!$5) {
        $9 = (($4 | 0) / (HEAP32[$1 >> 2] | 0)) | 0;
        $10 = ($2 + ($3 << 2)) | 0;
        if (($9 | 0) > 0) {
          $12 = ($4 - $3) | 0;
          $$03237 = 0;
          while (1) {
            if (
              !(
                _codebook_decode_step(
                  $0,
                  $1,
                  ($10 + ($$03237 << 2)) | 0,
                  ($12 - $$03237) | 0,
                  $9
                ) | 0
              )
            ) {
              $$1 = 0;
              break L1;
            }
            $$03237 = ($$03237 + 1) | 0;
            if (($$03237 | 0) >= ($9 | 0)) {
              $$1 = 1;
              break;
            }
          }
        } else $$1 = 1;
      } else if (($4 | 0) > 0) {
        $$03440 = $3;
        $$13341 = 0;
        while (1) {
          if (
            !(
              _codebook_decode(
                $0,
                $1,
                ($2 + ($$03440 << 2)) | 0,
                ($4 - $$13341) | 0
              ) | 0
            )
          ) {
            $$1 = 0;
            break L1;
          }
          $23 = HEAP32[$1 >> 2] | 0;
          $$13341 = ($23 + $$13341) | 0;
          if (($$13341 | 0) >= ($4 | 0)) {
            $$1 = 1;
            break;
          } else $$03440 = ($23 + $$03440) | 0;
        }
      } else $$1 = 1;
    } while (0);
    return $$1 | 0;
  }
  function _next_segment($0) {
    $0 = $0 | 0;
    var $$0 = 0,
      $1 = 0,
      $17 = 0,
      $18 = 0,
      $20 = 0,
      $27 = 0,
      $4 = 0,
      $5 = 0;
    $1 = ($0 + 1372) | 0;
    L1: do {
      if (!(HEAP32[$1 >> 2] | 0)) {
        $4 = ($0 + 1368) | 0;
        $5 = HEAP32[$4 >> 2] | 0;
        do {
          if (($5 | 0) == -1) {
            HEAP32[($0 + 1376) >> 2] = (HEAP32[($0 + 1104) >> 2] | 0) + -1;
            if (!(_start_page($0) | 0)) {
              HEAP32[$1 >> 2] = 1;
              $$0 = 0;
              break L1;
            }
            if (!(HEAP8[($0 + 1363) >> 0] & 1)) {
              _error($0, 32);
              $$0 = 0;
              break L1;
            } else {
              $18 = HEAP32[$4 >> 2] | 0;
              break;
            }
          } else $18 = $5;
        } while (0);
        $17 = ($18 + 1) | 0;
        HEAP32[$4 >> 2] = $17;
        $20 = HEAP8[($0 + 1108 + $18) >> 0] | 0;
        if (($20 << 24) >> 24 != -1) {
          HEAP32[$1 >> 2] = 1;
          HEAP32[($0 + 1376) >> 2] = $18;
        }
        if (($17 | 0) >= (HEAP32[($0 + 1104) >> 2] | 0)) HEAP32[$4 >> 2] = -1;
        $27 = ($0 + 1364) | 0;
        if (!(HEAP8[$27 >> 0] | 0)) {
          HEAP8[$27 >> 0] = $20;
          $$0 = $20 & 255;
          break;
        } else ___assert_fail(1181, 1052, 1510, 1202);
      } else $$0 = 0;
    } while (0);
    return $$0 | 0;
  }
  function _iter_54($0) {
    $0 = $0 | 0;
    var $1 = 0,
      $10 = 0,
      $11 = 0,
      $14 = 0,
      $15 = 0,
      $16 = 0,
      $17 = 0,
      $18 = 0,
      $2 = 0,
      $21 = 0,
      $22 = 0,
      $23 = 0,
      $24 = 0,
      $25 = 0,
      $26 = 0,
      $27 = 0,
      $3 = 0,
      $4 = 0,
      $5 = 0,
      $6 = 0,
      $7 = 0,
      $8 = 0,
      $9 = 0;
    $1 = +HEAPF32[$0 >> 2];
    $2 = ($0 + -16) | 0;
    $3 = +HEAPF32[$2 >> 2];
    $4 = $1 - $3;
    $5 = $1 + $3;
    $6 = ($0 + -8) | 0;
    $7 = +HEAPF32[$6 >> 2];
    $8 = ($0 + -24) | 0;
    $9 = +HEAPF32[$8 >> 2];
    $10 = $7 + $9;
    $11 = $7 - $9;
    HEAPF32[$0 >> 2] = $5 + $10;
    HEAPF32[$6 >> 2] = $5 - $10;
    $14 = ($0 + -12) | 0;
    $15 = +HEAPF32[$14 >> 2];
    $16 = ($0 + -28) | 0;
    $17 = +HEAPF32[$16 >> 2];
    $18 = $15 - $17;
    HEAPF32[$2 >> 2] = $4 + $18;
    HEAPF32[$8 >> 2] = $4 - $18;
    $21 = ($0 + -4) | 0;
    $22 = +HEAPF32[$21 >> 2];
    $23 = ($0 + -20) | 0;
    $24 = +HEAPF32[$23 >> 2];
    $25 = $22 - $24;
    $26 = $22 + $24;
    $27 = $15 + $17;
    HEAPF32[$21 >> 2] = $26 + $27;
    HEAPF32[$14 >> 2] = $26 - $27;
    HEAPF32[$23 >> 2] = $25 - $11;
    HEAPF32[$16 >> 2] = $11 + $25;
    return;
  }
  function _codebook_decode_step($0, $1, $2, $3, $4) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    var $$ = 0,
      $$0 = 0,
      $$02832 = 0,
      $$02931 = 0,
      $12 = 0,
      $15 = 0,
      $19 = 0,
      $21 = 0,
      $5 = 0,
      $7 = 0,
      $9 = 0;
    $5 = _codebook_decode_start($0, $1) | 0;
    if (($5 | 0) < 0) $$0 = 0;
    else {
      $7 = HEAP32[$1 >> 2] | 0;
      $$ = ($7 | 0) < ($3 | 0) ? $7 : $3;
      $9 = Math_imul($7, $5) | 0;
      if (($$ | 0) > 0) {
        $12 = HEAP32[($1 + 28) >> 2] | 0;
        $15 = (HEAP8[($1 + 22) >> 0] | 0) == 0;
        $$02832 = 0;
        $$02931 = 0;
        while (1) {
          $19 = $$02832 + +HEAPF32[($12 + (($$02931 + $9) << 2)) >> 2];
          $21 = ($2 + ((Math_imul($$02931, $4) | 0) << 2)) | 0;
          HEAPF32[$21 >> 2] = +HEAPF32[$21 >> 2] + $19;
          $$02931 = ($$02931 + 1) | 0;
          if (($$02931 | 0) >= ($$ | 0)) {
            $$0 = 1;
            break;
          } else $$02832 = $15 ? $$02832 : $19;
        }
      } else $$0 = 1;
    }
    return $$0 | 0;
  }
  function _maybe_start_packet($0) {
    $0 = $0 | 0;
    var $$1 = 0,
      $4 = 0,
      label = 0;
    do {
      if ((HEAP32[($0 + 1368) >> 2] | 0) == -1) {
        $4 = _get8($0) | 0;
        if (!(HEAP32[($0 + 84) >> 2] | 0)) {
          if (($4 << 24) >> 24 != 79) {
            _error($0, 30);
            $$1 = 0;
            break;
          }
          if (((_get8($0) | 0) << 24) >> 24 != 103) {
            _error($0, 30);
            $$1 = 0;
            break;
          }
          if (((_get8($0) | 0) << 24) >> 24 != 103) {
            _error($0, 30);
            $$1 = 0;
            break;
          }
          if (((_get8($0) | 0) << 24) >> 24 != 83) {
            _error($0, 30);
            $$1 = 0;
            break;
          }
          if (!(_start_page_no_capturepattern($0) | 0)) $$1 = 0;
          else if (!(HEAP8[($0 + 1363) >> 0] & 1)) label = 14;
          else {
            HEAP32[($0 + 1372) >> 2] = 0;
            HEAP8[($0 + 1364) >> 0] = 0;
            _error($0, 32);
            $$1 = 0;
          }
        } else $$1 = 0;
      } else label = 14;
    } while (0);
    if ((label | 0) == 14) $$1 = _start_packet($0) | 0;
    return $$1 | 0;
  }
  function _cycle($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $$02527 = 0,
      $$026 = 0,
      $10 = 0,
      $11 = 0,
      $18 = 0,
      $3 = 0,
      $5 = 0,
      $8 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 256) | 0;
    $3 = sp;
    L1: do {
      if (($2 | 0) >= 2) {
        $5 = ($1 + ($2 << 2)) | 0;
        HEAP32[$5 >> 2] = $3;
        if ($0 | 0) {
          $$02527 = $0;
          $10 = $3;
          while (1) {
            $8 = $$02527 >>> 0 < 256 ? $$02527 : 256;
            _memcpy($10 | 0, HEAP32[$1 >> 2] | 0, $8 | 0) | 0;
            $$026 = 0;
            do {
              $11 = ($1 + ($$026 << 2)) | 0;
              $$026 = ($$026 + 1) | 0;
              _memcpy(
                HEAP32[$11 >> 2] | 0,
                HEAP32[($1 + ($$026 << 2)) >> 2] | 0,
                $8 | 0
              ) | 0;
              HEAP32[$11 >> 2] = (HEAP32[$11 >> 2] | 0) + $8;
            } while (($$026 | 0) != ($2 | 0));
            $18 = ($$02527 - $8) | 0;
            if (!$18) break L1;
            $$02527 = $18;
            $10 = HEAP32[$5 >> 2] | 0;
          }
        }
      }
    } while (0);
    STACKTOP = sp;
    return;
  }
  function _scalbn($0, $1) {
    $0 = +$0;
    $1 = $1 | 0;
    var $$0 = 0,
      $$020 = 0,
      $10 = 0,
      $12 = 0,
      $14 = 0,
      $17 = 0,
      $18 = 0,
      $3 = 0,
      $5 = 0,
      $7 = 0;
    if (($1 | 0) > 1023) {
      $3 = $0 * 898846567431158e293;
      $5 = ($1 | 0) > 2046;
      $7 = ($1 + -2046) | 0;
      $$0 = $5 ? $3 * 898846567431158e293 : $3;
      $$020 = $5 ? (($7 | 0) < 1023 ? $7 : 1023) : ($1 + -1023) | 0;
    } else if (($1 | 0) < -1022) {
      $10 = $0 * 22250738585072014e-324;
      $12 = ($1 | 0) < -2044;
      $14 = ($1 + 2044) | 0;
      $$0 = $12 ? $10 * 22250738585072014e-324 : $10;
      $$020 = $12 ? (($14 | 0) > -1022 ? $14 : -1022) : ($1 + 1022) | 0;
    } else {
      $$0 = $0;
      $$020 = $1;
    }
    $17 = _bitshift64Shl(($$020 + 1023) | 0, 0, 52) | 0;
    $18 = tempRet0;
    HEAP32[tempDoublePtr >> 2] = $17;
    HEAP32[(tempDoublePtr + 4) >> 2] = $18;
    return +($$0 * +HEAPF64[tempDoublePtr >> 3]);
  }
  function _neighbors($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$02933 = 0,
      $$03032 = 0,
      $$034 = 0,
      $$1 = 0,
      $$131 = 0,
      $5 = 0,
      $7 = 0,
      $8 = 0;
    if (($1 | 0) > 0) {
      $5 = ($0 + ($1 << 1)) | 0;
      $$02933 = 65536;
      $$03032 = -1;
      $$034 = 0;
      while (1) {
        $7 = HEAP16[($0 + ($$034 << 1)) >> 1] | 0;
        $8 = $7 & 65535;
        if (($$03032 | 0) < ($8 | 0))
          if (($7 & 65535) < (HEAPU16[$5 >> 1] | 0)) {
            HEAP32[$2 >> 2] = $$034;
            $$131 = $8;
          } else $$131 = $$03032;
        else $$131 = $$03032;
        if (($$02933 | 0) > ($8 | 0))
          if (($7 & 65535) > (HEAPU16[$5 >> 1] | 0)) {
            HEAP32[$3 >> 2] = $$034;
            $$1 = $8;
          } else $$1 = $$02933;
        else $$1 = $$02933;
        $$034 = ($$034 + 1) | 0;
        if (($$034 | 0) == ($1 | 0)) break;
        else {
          $$02933 = $$1;
          $$03032 = $$131;
        }
      }
    }
    return;
  }
  function _stb_vorbis_open_memory($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$0 = 0,
      $14 = 0,
      $4 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 1504) | 0;
    $4 = sp;
    do {
      if (!$0) $$0 = 0;
      else {
        _vorbis_init($4, $3);
        HEAP32[($4 + 20) >> 2] = $0;
        HEAP32[($4 + 28) >> 2] = $0 + $1;
        HEAP32[($4 + 24) >> 2] = $0;
        HEAP32[($4 + 32) >> 2] = $1;
        HEAP8[($4 + 36) >> 0] = 0;
        if (_start_decoder($4) | 0) {
          $14 = _vorbis_alloc($4) | 0;
          if ($14 | 0) {
            _memcpy($14 | 0, $4 | 0, 1500) | 0;
            _vorbis_pump_first_frame($14) | 0;
            if (!$2) {
              $$0 = $14;
              break;
            }
            HEAP32[$2 >> 2] = 0;
            $$0 = $14;
            break;
          }
        }
        if ($2 | 0) HEAP32[$2 >> 2] = HEAP32[($4 + 88) >> 2];
        _vorbis_deinit($4);
        $$0 = 0;
      }
    } while (0);
    STACKTOP = sp;
    return $$0 | 0;
  }
  function _ilog($0) {
    $0 = $0 | 0;
    var $$0 = 0;
    do {
      if (($0 | 0) < 0) $$0 = 0;
      else {
        if (($0 | 0) < 16384) {
          if (($0 | 0) < 16) {
            $$0 = HEAP8[(1215 + $0) >> 0] | 0;
            break;
          }
          if (($0 | 0) < 512) {
            $$0 = ((HEAP8[(1215 + ($0 >>> 5)) >> 0] | 0) + 5) | 0;
            break;
          } else {
            $$0 = ((HEAP8[(1215 + ($0 >>> 10)) >> 0] | 0) + 10) | 0;
            break;
          }
        }
        if (($0 | 0) < 16777216)
          if (($0 | 0) < 524288) {
            $$0 = ((HEAP8[(1215 + ($0 >>> 15)) >> 0] | 0) + 15) | 0;
            break;
          } else {
            $$0 = ((HEAP8[(1215 + ($0 >>> 20)) >> 0] | 0) + 20) | 0;
            break;
          }
        else if (($0 | 0) < 536870912) {
          $$0 = ((HEAP8[(1215 + ($0 >>> 25)) >> 0] | 0) + 25) | 0;
          break;
        } else {
          $$0 = ((HEAP8[(1215 + ($0 >>> 30)) >> 0] | 0) + 30) | 0;
          break;
        }
      }
    } while (0);
    return $$0 | 0;
  }
  function _realloc($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$1 = 0,
      $11 = 0,
      $14 = 0,
      $17 = 0,
      $22 = 0,
      $5 = 0;
    if (!$0) {
      $$1 = _malloc($1) | 0;
      return $$1 | 0;
    }
    if ($1 >>> 0 > 4294967231) {
      $5 = ___errno_location() | 0;
      HEAP32[$5 >> 2] = 12;
      $$1 = 0;
      return $$1 | 0;
    }
    $11 =
      _try_realloc_chunk(($0 + -8) | 0, $1 >>> 0 < 11 ? 16 : ($1 + 11) & -8) |
      0;
    if ($11 | 0) {
      $$1 = ($11 + 8) | 0;
      return $$1 | 0;
    }
    $14 = _malloc($1) | 0;
    if (!$14) {
      $$1 = 0;
      return $$1 | 0;
    }
    $17 = HEAP32[($0 + -4) >> 2] | 0;
    $22 = (($17 & -8) - ((($17 & 3) | 0) == 0 ? 8 : 4)) | 0;
    _memcpy($14 | 0, $0 | 0, ($22 >>> 0 < $1 >>> 0 ? $22 : $1) | 0) | 0;
    _free($0);
    $$1 = $14;
    return $$1 | 0;
  }
  function _get8_packet_raw($0) {
    $0 = $0 | 0;
    var $$0 = 0,
      $$pr = 0,
      $1 = 0,
      $11 = 0,
      $12 = 0,
      $2 = 0,
      label = 0;
    $1 = ($0 + 1364) | 0;
    $2 = HEAP8[$1 >> 0] | 0;
    if (!(($2 << 24) >> 24))
      if (!(HEAP32[($0 + 1372) >> 2] | 0))
        if (!(_next_segment($0) | 0)) $$0 = -1;
        else {
          $$pr = HEAP8[$1 >> 0] | 0;
          if (!(($$pr << 24) >> 24)) ___assert_fail(1145, 1052, 1524, 1165);
          else {
            $11 = $$pr;
            label = 6;
          }
        }
      else $$0 = -1;
    else {
      $11 = $2;
      label = 6;
    }
    if ((label | 0) == 6) {
      HEAP8[$1 >> 0] = (($11 + -1) << 24) >> 24;
      $12 = ($0 + 1388) | 0;
      HEAP32[$12 >> 2] = (HEAP32[$12 >> 2] | 0) + 1;
      $$0 = (_get8($0) | 0) & 255;
    }
    return $$0 | 0;
  }
  function _sbrk(increment) {
    increment = increment | 0;
    var oldDynamicTop = 0,
      newDynamicTop = 0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR >> 2] | 0;
    newDynamicTop = (oldDynamicTop + increment) | 0;
    if (
      (((increment | 0) > 0) & ((newDynamicTop | 0) < (oldDynamicTop | 0))) |
      ((newDynamicTop | 0) < 0)
    ) {
      abortOnCannotGrowMemory() | 0;
      ___setErrNo(12);
      return -1;
    }
    HEAP32[DYNAMICTOP_PTR >> 2] = newDynamicTop;
    if ((newDynamicTop | 0) > (getTotalMemory() | 0))
      if (!(enlargeMemory() | 0)) {
        HEAP32[DYNAMICTOP_PTR >> 2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    return oldDynamicTop | 0;
  }
  function _prep_huffman($0) {
    $0 = $0 | 0;
    var $1 = 0,
      $12 = 0,
      $14 = 0,
      $2 = 0,
      $5 = 0,
      $6 = 0,
      $7 = 0;
    $1 = ($0 + 1384) | 0;
    $2 = HEAP32[$1 >> 2] | 0;
    L1: do {
      if (($2 | 0) < 25) {
        $5 = ($0 + 1380) | 0;
        if (!$2) HEAP32[$5 >> 2] = 0;
        $6 = ($0 + 1364) | 0;
        $7 = ($0 + 1372) | 0;
        do {
          if (HEAP32[$7 >> 2] | 0) if (!(HEAP8[$6 >> 0] | 0)) break L1;
          $12 = _get8_packet_raw($0) | 0;
          if (($12 | 0) == -1) break L1;
          $14 = HEAP32[$1 >> 2] | 0;
          HEAP32[$5 >> 2] = (HEAP32[$5 >> 2] | 0) + ($12 << $14);
          HEAP32[$1 >> 2] = $14 + 8;
        } while (($14 | 0) < 17);
      }
    } while (0);
    return;
  }
  function _memcmp($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $$01318 = 0,
      $$01417 = 0,
      $$019 = 0,
      $14 = 0,
      $4 = 0,
      $5 = 0;
    L1: do {
      if (!$2) $14 = 0;
      else {
        $$01318 = $0;
        $$01417 = $2;
        $$019 = $1;
        while (1) {
          $4 = HEAP8[$$01318 >> 0] | 0;
          $5 = HEAP8[$$019 >> 0] | 0;
          if (($4 << 24) >> 24 != ($5 << 24) >> 24) break;
          $$01417 = ($$01417 + -1) | 0;
          if (!$$01417) {
            $14 = 0;
            break L1;
          } else {
            $$01318 = ($$01318 + 1) | 0;
            $$019 = ($$019 + 1) | 0;
          }
        }
        $14 = (($4 & 255) - ($5 & 255)) | 0;
      }
    } while (0);
    return $14 | 0;
  }
  function _start_packet($0) {
    $0 = $0 | 0;
    var $$0 = 0,
      $1 = 0,
      $2 = 0,
      label = 0;
    $1 = ($0 + 1368) | 0;
    $2 = ($0 + 1363) | 0;
    while (1) {
      if ((HEAP32[$1 >> 2] | 0) != -1) {
        label = 6;
        break;
      }
      if (!(_start_page($0) | 0)) {
        $$0 = 0;
        break;
      }
      if (HEAP8[$2 >> 0] & 1) {
        label = 5;
        break;
      }
    }
    if ((label | 0) == 5) {
      _error($0, 32);
      $$0 = 0;
    } else if ((label | 0) == 6) {
      HEAP32[($0 + 1372) >> 2] = 0;
      HEAP32[($0 + 1384) >> 2] = 0;
      HEAP32[($0 + 1388) >> 2] = 0;
      HEAP8[($0 + 1364) >> 0] = 0;
      $$0 = 1;
    }
    return $$0 | 0;
  }
  function _lookup1_values($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$ = 0,
      $11 = 0,
      $15 = 0,
      $21 = 0;
    $11 = ~~+Math_floor(+(+Math_exp(+(+Math_log(+(+($0 | 0))) / +($1 | 0)))));
    $15 = +($1 | 0);
    $$ =
      ((((~~+Math_floor(+(+Math_pow(+(+($11 | 0) + 1), +$15))) | 0) <=
        ($0 | 0)) &
        1) +
        $11) |
      0;
    $21 = +($$ | 0);
    if (!(+Math_pow(+($21 + 1), +$15) > +($0 | 0)))
      ___assert_fail(1747, 1052, 1203, 1779);
    if ((~~+Math_floor(+(+Math_pow(+$21, +$15))) | 0) > ($0 | 0))
      ___assert_fail(1794, 1052, 1204, 1779);
    else return $$ | 0;
    return 0;
  }
  function _setup_malloc($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$1 = 0,
      $10 = 0,
      $11 = 0,
      $12 = 0,
      $3 = 0,
      $4 = 0,
      $8 = 0;
    $3 = ($1 + 3) & -4;
    $4 = ($0 + 8) | 0;
    HEAP32[$4 >> 2] = (HEAP32[$4 >> 2] | 0) + $3;
    $8 = HEAP32[($0 + 68) >> 2] | 0;
    if (!$8)
      if (!$3) $$1 = 0;
      else $$1 = _malloc($3) | 0;
    else {
      $10 = ($0 + 76) | 0;
      $11 = HEAP32[$10 >> 2] | 0;
      $12 = ($11 + $3) | 0;
      if (($12 | 0) > (HEAP32[($0 + 80) >> 2] | 0)) $$1 = 0;
      else {
        HEAP32[$10 >> 2] = $12;
        $$1 = ($8 + $11) | 0;
      }
    }
    return $$1 | 0;
  }
  function _vorbis_init($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $10 = 0,
      $16 = 0,
      $4 = 0,
      $9 = 0;
    _memset($0 | 0, 0, 1500) | 0;
    if ($1 | 0) {
      $4 = $1;
      $9 = HEAP32[($4 + 4) >> 2] | 0;
      $10 = ($0 + 68) | 0;
      HEAP32[$10 >> 2] = HEAP32[$4 >> 2];
      HEAP32[($10 + 4) >> 2] = $9;
      $16 = ($9 + 3) & -4;
      HEAP32[($0 + 72) >> 2] = $16;
      HEAP32[($0 + 80) >> 2] = $16;
    }
    HEAP32[($0 + 84) >> 2] = 0;
    HEAP32[($0 + 88) >> 2] = 0;
    HEAP32[($0 + 20) >> 2] = 0;
    HEAP32[($0 + 112) >> 2] = 0;
    HEAP32[($0 + 1408) >> 2] = -1;
    return;
  }
  function _vorbis_decode_packet($0, $1, $2, $3) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    var $$0 = 0,
      $4 = 0,
      $6 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 16) | 0;
    $4 = (sp + 8) | 0;
    $6 = sp;
    if (!(_vorbis_decode_initial($0, $2, (sp + 4) | 0, $3, $6, $4) | 0))
      $$0 = 0;
    else
      $$0 =
        _vorbis_decode_packet_rest(
          $0,
          $1,
          ($0 + 400 + (((HEAP32[$4 >> 2] | 0) * 6) | 0)) | 0,
          HEAP32[$2 >> 2] | 0,
          HEAP32[$3 >> 2] | 0,
          HEAP32[$6 >> 2] | 0,
          $2
        ) | 0;
    STACKTOP = sp;
    return $$0 | 0;
  }
  function _add_entry($0, $1, $2, $3, $4, $5) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    $5 = $5 | 0;
    var $$sink = 0,
      $$sink1 = 0,
      $10 = 0;
    $10 = HEAP32[($0 + 32) >> 2] | 0;
    if (!(HEAP8[($0 + 23) >> 0] | 0)) {
      $$sink = $1;
      $$sink1 = ($10 + ($2 << 2)) | 0;
    } else {
      HEAP32[($10 + ($3 << 2)) >> 2] = $1;
      HEAP8[((HEAP32[($0 + 8) >> 2] | 0) + $3) >> 0] = $4;
      $$sink = $2;
      $$sink1 = ($5 + ($3 << 2)) | 0;
    }
    HEAP32[$$sink1 >> 2] = $$sink;
    return;
  }
  function _shl($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$0 = 0,
      $10 = 0,
      $3 = 0,
      $5 = 0,
      $7 = 0;
    $3 = ($0 + 4) | 0;
    if ($1 >>> 0 > 31) {
      $5 = HEAP32[$0 >> 2] | 0;
      HEAP32[$3 >> 2] = $5;
      HEAP32[$0 >> 2] = 0;
      $$0 = ($1 + -32) | 0;
      $10 = 0;
      $7 = $5;
    } else {
      $$0 = $1;
      $10 = HEAP32[$0 >> 2] | 0;
      $7 = HEAP32[$3 >> 2] | 0;
    }
    HEAP32[$3 >> 2] = ($10 >>> ((32 - $$0) | 0)) | ($7 << $$0);
    HEAP32[$0 >> 2] = $10 << $$0;
    return;
  }
  function _shr($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$0 = 0,
      $10 = 0,
      $3 = 0,
      $5 = 0,
      $7 = 0;
    $3 = ($0 + 4) | 0;
    if ($1 >>> 0 > 31) {
      $5 = HEAP32[$3 >> 2] | 0;
      HEAP32[$0 >> 2] = $5;
      HEAP32[$3 >> 2] = 0;
      $$0 = ($1 + -32) | 0;
      $10 = 0;
      $7 = $5;
    } else {
      $$0 = $1;
      $10 = HEAP32[$3 >> 2] | 0;
      $7 = HEAP32[$0 >> 2] | 0;
    }
    HEAP32[$0 >> 2] = ($10 << (32 - $$0)) | ($7 >>> $$0);
    HEAP32[$3 >> 2] = $10 >>> $$0;
    return;
  }
  function _compute_window($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$010 = 0,
      $16 = 0,
      $2 = 0,
      $4 = 0;
    $2 = $0 >> 1;
    if (($2 | 0) > 0) {
      $4 = +($2 | 0);
      $$010 = 0;
      do {
        $16 = +Math_sin(
          +(
            +_square(
              +Math_sin(
                +(((+($$010 | 0) + 0.5) / $4) * 0.5 * 3.141592653589793)
              )
            ) * 1.5707963267948966
          )
        );
        HEAPF32[($1 + ($$010 << 2)) >> 2] = $16;
        $$010 = ($$010 + 1) | 0;
      } while (($$010 | 0) != ($2 | 0));
    }
    return;
  }
  function _setup_temp_malloc($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$0 = 0,
      $3 = 0,
      $5 = 0,
      $7 = 0,
      $9 = 0;
    $3 = ($1 + 3) & -4;
    $5 = HEAP32[($0 + 68) >> 2] | 0;
    if (!$5) $$0 = _malloc($3) | 0;
    else {
      $7 = ($0 + 80) | 0;
      $9 = ((HEAP32[$7 >> 2] | 0) - $3) | 0;
      if (($9 | 0) < (HEAP32[($0 + 76) >> 2] | 0)) $$0 = 0;
      else {
        HEAP32[$7 >> 2] = $9;
        $$0 = ($5 + $9) | 0;
      }
    }
    return $$0 | 0;
  }
  function _vorbis_pump_first_frame($0) {
    $0 = $0 | 0;
    var $1 = 0,
      $2 = 0,
      $3 = 0,
      $4 = 0,
      sp = 0;
    sp = STACKTOP;
    STACKTOP = (STACKTOP + 16) | 0;
    $1 = (sp + 8) | 0;
    $2 = (sp + 4) | 0;
    $3 = sp;
    $4 = _vorbis_decode_packet($0, $1, $3, $2) | 0;
    if ($4 | 0)
      _vorbis_finish_frame(
        $0,
        HEAP32[$1 >> 2] | 0,
        HEAP32[$3 >> 2] | 0,
        HEAP32[$2 >> 2] | 0
      ) | 0;
    STACKTOP = sp;
    return $4 | 0;
  }
  function _getn($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $$0 = 0,
      $3 = 0,
      $4 = 0;
    $3 = ($0 + 20) | 0;
    $4 = HEAP32[$3 >> 2] | 0;
    if ((($4 + $2) | 0) >>> 0 > (HEAP32[($0 + 28) >> 2] | 0) >>> 0) {
      HEAP32[($0 + 84) >> 2] = 1;
      $$0 = 0;
    } else {
      _memcpy($1 | 0, $4 | 0, $2 | 0) | 0;
      HEAP32[$3 >> 2] = (HEAP32[$3 >> 2] | 0) + $2;
      $$0 = 1;
    }
    return $$0 | 0;
  }
  function _compute_bitreverse($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$013 = 0,
      $2 = 0,
      $5 = 0,
      $9 = 0;
    $2 = $0 >> 3;
    if (($2 | 0) > 0) {
      $5 = (36 - (_ilog($0) | 0)) | 0;
      $$013 = 0;
      do {
        $9 = (((_bit_reverse($$013) | 0) >>> $5) << 2) & 65535;
        HEAP16[($1 + ($$013 << 1)) >> 1] = $9;
        $$013 = ($$013 + 1) | 0;
      } while (($$013 | 0) != ($2 | 0));
    }
    return;
  }
  function _make_block_array($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $$01617 = 0,
      $$018 = 0;
    if (($1 | 0) > 0) {
      $$01617 = 0;
      $$018 = ($0 + ($1 << 2)) | 0;
      while (1) {
        HEAP32[($0 + ($$01617 << 2)) >> 2] = $$018;
        $$01617 = ($$01617 + 1) | 0;
        if (($$01617 | 0) == ($1 | 0)) break;
        else $$018 = ($$018 + $2) | 0;
      }
    }
    return $0 | 0;
  }
  function _get_window($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $$0$in = 0,
      $2 = 0;
    $2 = $1 << 1;
    do {
      if (($2 | 0) == (HEAP32[($0 + 100) >> 2] | 0)) $$0$in = ($0 + 1080) | 0;
      else if (($2 | 0) == (HEAP32[($0 + 104) >> 2] | 0)) {
        $$0$in = ($0 + 1084) | 0;
        break;
      } else ___assert_fail(1447, 1052, 3049, 1449);
    } while (0);
    return HEAP32[$$0$in >> 2] | 0;
  }
  function _crc32_init() {
    var $$01315 = 0,
      $$01417 = 0,
      $$016 = 0;
    $$01417 = 0;
    do {
      $$01315 = 0;
      $$016 = $$01417 << 24;
      while (1) {
        $$01315 = ($$01315 + 1) | 0;
        if (($$01315 | 0) == 8) break;
        else $$016 = (($$016 >> 31) & 79764919) ^ ($$016 << 1);
      }
      $$01417 = ($$01417 + 1) | 0;
    } while (($$01417 | 0) != 256);
    return;
  }
  function _bit_reverse($0) {
    $0 = $0 | 0;
    var $10 = 0,
      $15 = 0,
      $20 = 0,
      $5 = 0;
    $5 = (($0 >>> 1) & 1431655765) | (($0 << 1) & -1431655766);
    $10 = (($5 >>> 2) & 858993459) | (($5 << 2) & -858993460);
    $15 = (($10 >>> 4) & 252645135) | (($10 << 4) & -252645136);
    $20 = (($15 >>> 8) & 16711935) | (($15 << 8) & -16711936);
    return ($20 >>> 16) | ($20 << 16) | 0;
  }
  function _a_ctz_l($0) {
    $0 = $0 | 0;
    var $$068 = 0,
      $$07 = 0,
      $$09 = 0,
      $4 = 0;
    if (!$0) $$07 = 32;
    else if (!($0 & 1)) {
      $$068 = $0;
      $$09 = 0;
      while (1) {
        $4 = ($$09 + 1) | 0;
        $$068 = $$068 >>> 1;
        if (($$068 & 1) | 0) {
          $$07 = $4;
          break;
        } else $$09 = $4;
      }
    } else $$07 = 0;
    return $$07 | 0;
  }
  function _predict_point($0, $1, $2, $3, $4) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    $3 = $3 | 0;
    $4 = $4 | 0;
    var $10 = 0,
      $5 = 0;
    $5 = ($4 - $3) | 0;
    $10 =
      ((Math_imul(($5 | 0) > -1 ? $5 : (0 - $5) | 0, ($0 - $1) | 0) | 0) /
        (($2 - $1) | 0)) |
      0;
    return ((($5 | 0) < 0 ? (0 - $10) | 0 : $10) + $3) | 0;
  }
  function runPostSets() {}
  function _bitshift64Shl(low, high, bits) {
    low = low | 0;
    high = high | 0;
    bits = bits | 0;
    if ((bits | 0) < 32) {
      tempRet0 =
        (high << bits) |
        ((low & (((1 << bits) - 1) << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
  }
  function _get8($0) {
    $0 = $0 | 0;
    var $$0 = 0,
      $1 = 0,
      $2 = 0;
    $1 = ($0 + 20) | 0;
    $2 = HEAP32[$1 >> 2] | 0;
    if ($2 >>> 0 < (HEAP32[($0 + 28) >> 2] | 0) >>> 0) {
      HEAP32[$1 >> 2] = $2 + 1;
      $$0 = HEAP8[$2 >> 0] | 0;
    } else {
      HEAP32[($0 + 84) >> 2] = 1;
      $$0 = 0;
    }
    return $$0 | 0;
  }
  function _capture_pattern($0) {
    $0 = $0 | 0;
    var $$0 = 0;
    if (((_get8($0) | 0) << 24) >> 24 == 79)
      if (((_get8($0) | 0) << 24) >> 24 == 103)
        if (((_get8($0) | 0) << 24) >> 24 == 103)
          $$0 = (((_get8($0) | 0) << 24) >> 24 == 83) & 1;
        else $$0 = 0;
      else $$0 = 0;
    else $$0 = 0;
    return $$0 | 0;
  }
  function _include_in_sort($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $5 = 0;
    $5 = ($1 << 24) >> 24 == -1;
    if (!(HEAP8[($0 + 23) >> 0] | 0)) return (($5 ^ (($1 & 255) > 10)) & 1) | 0;
    if ($5) ___assert_fail(1716, 1052, 1128, 1731);
    else return 1;
    return 0;
  }
  function _pntz($0) {
    $0 = $0 | 0;
    var $3 = 0,
      $7 = 0;
    $3 = _a_ctz_l(((HEAP32[$0 >> 2] | 0) + -1) | 0) | 0;
    if (!$3) {
      $7 = _a_ctz_l(HEAP32[($0 + 4) >> 2] | 0) | 0;
      return (($7 | 0) == 0 ? 0 : ($7 + 32) | 0) | 0;
    } else return $3 | 0;
    return 0;
  }
  function _skip($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $2 = 0,
      $4 = 0;
    $2 = ($0 + 20) | 0;
    $4 = ((HEAP32[$2 >> 2] | 0) + $1) | 0;
    HEAP32[$2 >> 2] = $4;
    if ($4 >>> 0 >= (HEAP32[($0 + 28) >> 2] | 0) >>> 0)
      HEAP32[($0 + 84) >> 2] = 1;
    return;
  }
  function _setup_temp_free($0, $1, $2) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    $2 = $2 | 0;
    var $8 = 0;
    if (!(HEAP32[($0 + 68) >> 2] | 0)) _free($1);
    else {
      $8 = ($0 + 80) | 0;
      HEAP32[$8 >> 2] = (HEAP32[$8 >> 2] | 0) + (($2 + 3) & -4);
    }
    return;
  }
  function _get32($0) {
    $0 = $0 | 0;
    var $10 = 0,
      $2 = 0,
      $6 = 0;
    $2 = (_get8($0) | 0) & 255;
    $6 = (((_get8($0) | 0) & 255) << 8) | $2;
    $10 = $6 | (((_get8($0) | 0) & 255) << 16);
    return $10 | (((_get8($0) | 0) & 255) << 24) | 0;
  }
  function _point_compare($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $2 = 0,
      $3 = 0;
    $2 = HEAP16[$0 >> 1] | 0;
    $3 = HEAP16[$1 >> 1] | 0;
    return (
      (($2 & 65535) < ($3 & 65535) ? -1 : (($2 & 65535) > ($3 & 65535)) & 1) | 0
    );
  }
  function _uint32_compare($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    var $2 = 0,
      $3 = 0;
    $2 = HEAP32[$0 >> 2] | 0;
    $3 = HEAP32[$1 >> 2] | 0;
    return ($2 >>> 0 < $3 >>> 0 ? -1 : ($2 >>> 0 > $3 >>> 0) & 1) | 0;
  }
  function _stb_vorbis_get_file_offset($0) {
    $0 = $0 | 0;
    var $$0 = 0;
    if (!(HEAP8[($0 + 36) >> 0] | 0))
      $$0 = ((HEAP32[($0 + 20) >> 2] | 0) - (HEAP32[($0 + 24) >> 2] | 0)) | 0;
    else $$0 = 0;
    return $$0 | 0;
  }
  function _start_page($0) {
    $0 = $0 | 0;
    var $$0 = 0;
    if (!(_capture_pattern($0) | 0)) {
      _error($0, 30);
      $$0 = 0;
    } else $$0 = _start_page_no_capturepattern($0) | 0;
    return $$0 | 0;
  }
  function _float32_unpack($0) {
    $0 = $0 | 0;
    var $5 = 0;
    $5 = +(($0 & 2097151) >>> 0);
    return +(+_ldexp(
      ($0 | 0) < 0 ? -$5 : $5,
      ((($0 >>> 21) & 1023) + -788) | 0
    ));
  }
  function stackAlloc(size) {
    size = size | 0;
    var ret = 0;
    ret = STACKTOP;
    STACKTOP = (STACKTOP + size) | 0;
    STACKTOP = (STACKTOP + 15) & -16;
    return ret | 0;
  }
  function establishStackSpace(stackBase, stackMax) {
    stackBase = stackBase | 0;
    stackMax = stackMax | 0;
    STACKTOP = stackBase;
    STACK_MAX = stackMax;
  }
  function dynCall_iii(index, a1, a2) {
    index = index | 0;
    a1 = a1 | 0;
    a2 = a2 | 0;
    return FUNCTION_TABLE_iii[index & 3](a1 | 0, a2 | 0) | 0;
  }
  function setThrew(threw, value) {
    threw = threw | 0;
    value = value | 0;
    if (!__THREW__) {
      __THREW__ = threw;
      threwValue = value;
    }
  }
  function _get8_packet($0) {
    $0 = $0 | 0;
    var $1 = 0;
    $1 = _get8_packet_raw($0) | 0;
    HEAP32[($0 + 1384) >> 2] = 0;
    return $1 | 0;
  }
  function _stb_vorbis_close($0) {
    $0 = $0 | 0;
    if ($0 | 0) {
      _vorbis_deinit($0);
      _setup_free($0, $0);
    }
    return;
  }
  function _setup_free($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    if (!(HEAP32[($0 + 68) >> 2] | 0)) _free($1);
    return;
  }
  function _flush_packet($0) {
    $0 = $0 | 0;
    do {} while ((_get8_packet_raw($0) | 0) != -1);
    return;
  }
  function _vorbis_validate($0) {
    $0 = $0 | 0;
    return ((_memcmp($0, 1530, 6) | 0) == 0) | 0;
  }
  function _error($0, $1) {
    $0 = $0 | 0;
    $1 = $1 | 0;
    HEAP32[($0 + 88) >> 2] = $1;
    return;
  }
  function _vorbis_alloc($0) {
    $0 = $0 | 0;
    return _setup_malloc($0, 1500) | 0;
  }
  function _ldexp($0, $1) {
    $0 = +$0;
    $1 = $1 | 0;
    return +(+_scalbn($0, $1));
  }
  function b0(p0, p1) {
    p0 = p0 | 0;
    p1 = p1 | 0;
    abort(0);
    return 0;
  }
  function setTempRet0(value) {
    value = value | 0;
    tempRet0 = value;
  }
  function stackRestore(top) {
    top = top | 0;
    STACKTOP = top;
  }
  function _square($0) {
    $0 = +$0;
    return +($0 * $0);
  }
  function getTempRet0() {
    return tempRet0 | 0;
  }
  function stackSave() {
    return STACKTOP | 0;
  }
  function ___errno_location() {
    return 2336;
  }
  var FUNCTION_TABLE_iii = [b0, _point_compare, _uint32_compare, b0];
  return {
    ___errno_location: ___errno_location,
    _bitshift64Shl: _bitshift64Shl,
    _emscripten_replace_memory: _emscripten_replace_memory,
    _free: _free,
    _malloc: _malloc,
    _memcpy: _memcpy,
    _memset: _memset,
    _sbrk: _sbrk,
    _stb_vorbis_decode_memory_float: _stb_vorbis_decode_memory_float,
    dynCall_iii: dynCall_iii,
    establishStackSpace: establishStackSpace,
    getTempRet0: getTempRet0,
    runPostSets: runPostSets,
    setTempRet0: setTempRet0,
    setThrew: setThrew,
    stackAlloc: stackAlloc,
    stackRestore: stackRestore,
    stackSave: stackSave,
  };
})(Module.asmGlobalArg, Module.asmLibraryArg, buffer);
var ___errno_location = (Module["___errno_location"] =
  asm["___errno_location"]);
var _bitshift64Shl = (Module["_bitshift64Shl"] = asm["_bitshift64Shl"]);
var _emscripten_replace_memory = (Module["_emscripten_replace_memory"] =
  asm["_emscripten_replace_memory"]);
var _free = (Module["_free"] = asm["_free"]);
var _malloc = (Module["_malloc"] = asm["_malloc"]);
var _memcpy = (Module["_memcpy"] = asm["_memcpy"]);
var _memset = (Module["_memset"] = asm["_memset"]);
var _sbrk = (Module["_sbrk"] = asm["_sbrk"]);
var _stb_vorbis_decode_memory_float = (Module[
  "_stb_vorbis_decode_memory_float"
] = asm["_stb_vorbis_decode_memory_float"]);
var establishStackSpace = (Module["establishStackSpace"] =
  asm["establishStackSpace"]);
var getTempRet0 = (Module["getTempRet0"] = asm["getTempRet0"]);
var runPostSets = (Module["runPostSets"] = asm["runPostSets"]);
var setTempRet0 = (Module["setTempRet0"] = asm["setTempRet0"]);
var setThrew = (Module["setThrew"] = asm["setThrew"]);
var stackAlloc = (Module["stackAlloc"] = asm["stackAlloc"]);
var stackRestore = (Module["stackRestore"] = asm["stackRestore"]);
var stackSave = (Module["stackSave"] = asm["stackSave"]);
var dynCall_iii = (Module["dynCall_iii"] = asm["dynCall_iii"]);
Module["asm"] = asm;
if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    if (typeof Module["locateFile"] === "function") {
      memoryInitializer = Module["locateFile"](memoryInitializer);
    } else if (Module["memoryInitializerPrefixURL"]) {
      memoryInitializer =
        Module["memoryInitializerPrefixURL"] + memoryInitializer;
    }
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module["readBinary"](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency("memory initializer");
    var applyMemoryInitializer = function (data) {
      if (data.byteLength) data = new Uint8Array(data);
      HEAPU8.set(data, GLOBAL_BASE);
      if (Module["memoryInitializerRequest"])
        delete Module["memoryInitializerRequest"].response;
      removeRunDependency("memory initializer");
    };
    function doBrowserLoad() {
      Module["readAsync"](
        memoryInitializer,
        applyMemoryInitializer,
        function () {
          throw "could not load memory initializer " + memoryInitializer;
        }
      );
    }
    var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
    if (memoryInitializerBytes) {
      applyMemoryInitializer(memoryInitializerBytes.buffer);
    } else if (Module["memoryInitializerRequest"]) {
      function useRequest() {
        var request = Module["memoryInitializerRequest"];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
          var data = tryParseAsDataURI(Module["memoryInitializerRequestURL"]);
          if (data) {
            response = data.buffer;
          } else {
            console.warn(
              "a problem seems to have happened with Module.memoryInitializerRequest, status: " +
                request.status +
                ", retrying " +
                memoryInitializer
            );
            doBrowserLoad();
            return;
          }
        }
        applyMemoryInitializer(response);
      }
      if (Module["memoryInitializerRequest"].response) {
        setTimeout(useRequest, 0);
      } else {
        Module["memoryInitializerRequest"].addEventListener("load", useRequest);
      }
    } else {
      doBrowserLoad();
    }
  }
}
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
}
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;
var initialStackTop;
var calledMain = false;
dependenciesFulfilled = function runCaller() {
  if (!Module["calledRun"]) run();
  if (!Module["calledRun"]) dependenciesFulfilled = runCaller;
};
function run(args) {
  args = args || Module["arguments"];
  if (runDependencies > 0) {
    return;
  }
  preRun();
  if (runDependencies > 0) return;
  if (Module["calledRun"]) return;
  function doRun() {
    if (Module["calledRun"]) return;
    Module["calledRun"] = true;
    if (ABORT) return;
    ensureInitRuntime();
    preMain();
    if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
    postRun();
  }
  if (Module["setStatus"]) {
    Module["setStatus"]("Running...");
    setTimeout(function () {
      setTimeout(function () {
        Module["setStatus"]("");
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
}
Module["run"] = run;
function exit(status, implicit) {
  if (implicit && Module["noExitRuntime"] && status === 0) {
    return;
  }
  if (Module["noExitRuntime"]) {
  } else {
    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;
    exitRuntime();
    if (Module["onExit"]) Module["onExit"](status);
  }
  if (ENVIRONMENT_IS_NODE) {
    process["exit"](status);
  }
  Module["quit"](status, new ExitStatus(status));
}
Module["exit"] = exit;
var abortDecorators = [];
function abort(what) {
  if (Module["onAbort"]) {
    Module["onAbort"](what);
  }
  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what);
  } else {
    what = "";
  }
  ABORT = true;
  EXITSTATUS = 1;
  throw "abort(" + what + "). Build with -s ASSERTIONS=1 for more info.";
}
Module["abort"] = abort;
if (Module["preInit"]) {
  if (typeof Module["preInit"] == "function")
    Module["preInit"] = [Module["preInit"]];
  while (Module["preInit"].length > 0) {
    Module["preInit"].pop()();
  }
}
Module["noExitRuntime"] = true;
run();
(function (Module) {
  var initializeP = new Promise(function (resolve) {
    if (typeof useWasm !== "undefined") {
      Module.onRuntimeInitialized = function () {
        var decodeMemory = Module.cwrap(
          "stb_vorbis_decode_memory_float",
          "number",
          ["number", "number", "number", "number", "number"]
        );
        resolve(decodeMemory);
      };
      return;
    }
    var decodeMemory = Module["_stb_vorbis_decode_memory_float"];
    resolve(decodeMemory);
  });
  function arrayBufferToHeap(buffer, byteOffset, byteLength) {
    var ptr = Module._malloc(byteLength);
    var heapBytes = new Uint8Array(Module.HEAPU8.buffer, ptr, byteLength);
    heapBytes.set(new Uint8Array(buffer, byteOffset, byteLength));
    return heapBytes;
  }
  function ptrToInt32(ptr) {
    var a = new Int32Array(Module.HEAPU8.buffer, ptr, 1);
    return a[0];
  }
  function ptrToFloat32(ptr) {
    var a = new Float32Array(Module.HEAPU8.buffer, ptr, 1);
    return a[0];
  }
  function ptrToInt32s(ptr, length) {
    var buf = new ArrayBuffer(length * Int32Array.BYTES_PER_ELEMENT);
    var copied = new Int32Array(buf);
    copied.set(new Int32Array(Module.HEAPU8.buffer, ptr, length));
    return copied;
  }
  function ptrToFloat32s(ptr, length) {
    var buf = new ArrayBuffer(length * Float32Array.BYTES_PER_ELEMENT);
    var copied = new Float32Array(buf);
    copied.set(new Float32Array(Module.HEAPU8.buffer, ptr, length));
    return copied;
  }
  self.addEventListener("message", function (event) {
    initializeP.then(function (decodeMemory) {
      var buf = event.data.buf;
      var copiedBuf = null;
      if (buf instanceof ArrayBuffer) {
        copiedBuf = arrayBufferToHeap(buf, 0, buf.byteLength);
      } else if (buf instanceof Uint8Array) {
        copiedBuf = arrayBufferToHeap(
          buf.buffer,
          buf.byteOffset,
          buf.byteLength
        );
      }
      var channelsPtr = Module._malloc(4);
      var sampleRatePtr = Module._malloc(4);
      var outputPtr = Module._malloc(4);
      var length = decodeMemory(
        copiedBuf.byteOffset,
        copiedBuf.byteLength,
        channelsPtr,
        sampleRatePtr,
        outputPtr
      );
      if (length < 0) {
        postMessage({
          id: event.data.id,
          error: new Error("stbvorbis decode failed: " + length),
        });
        return;
      }
      var channels = ptrToInt32(channelsPtr);
      var data = [];
      var dataPtrs = ptrToInt32s(ptrToInt32(outputPtr), channels);
      for (var i = 0; i < dataPtrs.length; i++) {
        data.push(ptrToFloat32s(dataPtrs[i], length));
      }
      var result = {
        id: event.data.id,
        data: data,
        sampleRate: ptrToInt32(sampleRatePtr),
      };
      Module._free(copiedBuf.byteOffset);
      Module._free(channelsPtr);
      Module._free(sampleRatePtr);
      for (var i = 0; i < dataPtrs.length; i++) {
        Module._free(dataPtrs[i]);
      }
      Module._free(ptrToInt32(outputPtr));
      Module._free(outputPtr);
      postMessage(
        result,
        result.data.map(function (array) {
          return array.buffer;
        })
      );
    });
  });
})(Module);
