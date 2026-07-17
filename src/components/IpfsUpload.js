"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpfsUpload = IpfsUpload;
var react_1 = require("react");
var ipfs_1 = require("../lib/ipfs");
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
var API_BASE = (_a = import.meta.env.VITE_API_BASE_URL) !== null && _a !== void 0 ? _a : "/api";
var ALLOWED_EXTENSIONS = ".pdf,.png,.jpg,.jpeg,.mp4";
// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function IpfsUpload(_a) {
    var _this = this;
    var _b;
    var token = _a.token, onSuccess = _a.onSuccess, _c = _a.accept, accept = _c === void 0 ? ALLOWED_EXTENSIONS : _c, _d = _a.label, label = _d === void 0 ? "Upload file" : _d, _e = _a.showPreview, showPreview = _e === void 0 ? false : _e;
    var inputRef = (0, react_1.useRef)(null);
    var _f = (0, react_1.useState)(false), isUploading = _f[0], setIsUploading = _f[1];
    var _g = (0, react_1.useState)(null), error = _g[0], setError = _g[1];
    var _h = (0, react_1.useState)(null), result = _h[0], setResult = _h[1];
    var handleFileChange = function (e) { return __awaiter(_this, void 0, void 0, function () {
        var file, formData, response, body, data, err_1;
        var _a, _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
                    if (!file)
                        return [2 /*return*/];
                    // Client-side size guard (10 MB) — mirrors the server limit.
                    if (file.size > 10 * 1024 * 1024) {
                        setError("File exceeds the 10 MB limit.");
                        return [2 /*return*/];
                    }
                    setError(null);
                    setIsUploading(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, 7, 8]);
                    formData = new FormData();
                    formData.append("file", file);
                    return [4 /*yield*/, fetch("".concat(API_BASE, "/upload"), {
                            method: "POST",
                            headers: { Authorization: "Bearer ".concat(token) },
                            body: formData,
                        })];
                case 2:
                    response = _c.sent();
                    if (!!response.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, response.json().catch(function () { return ({}); })];
                case 3:
                    body = (_c.sent());
                    throw new Error((_b = body.error) !== null && _b !== void 0 ? _b : "Upload failed (".concat(response.status, ")"));
                case 4: return [4 /*yield*/, response.json()];
                case 5:
                    data = (_c.sent());
                    setResult(data);
                    onSuccess(data);
                    return [3 /*break*/, 8];
                case 6:
                    err_1 = _c.sent();
                    setError(err_1 instanceof Error ? err_1.message : "Upload failed");
                    return [3 /*break*/, 8];
                case 7:
                    setIsUploading(false);
                    // Reset so the same file can be re-selected if needed
                    if (inputRef.current)
                        inputRef.current.value = "";
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var isImage = result !== null &&
        /\.(png|jpe?g|gif|webp)$/i.test((_b = result.gatewayUrl.split("?")[0]) !== null && _b !== void 0 ? _b : "");
    return (<div className="flex flex-col gap-2">
      {/* Hidden native input */}
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleFileChange} disabled={isUploading}/>

      {/* Trigger button */}
      <button type="button" onClick={function () { var _a; return (_a = inputRef.current) === null || _a === void 0 ? void 0 : _a.click(); }} disabled={isUploading} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-400 px-4 py-2 text-sm text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:border-blue-400 dark:hover:text-blue-400">
        {isUploading ? (<>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" role="status" aria-label="Uploading"/>
            Uploading…
          </>) : (label)}
      </button>

      {/* Error */}
      {error !== null && (<p className="text-sm text-red-500" role="alert">
          {error}
        </p>)}

      {/* Success */}
      {result !== null && (<div className="flex flex-col gap-1 rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-800">
          <p className="break-all font-mono text-gray-500 dark:text-gray-400">
            <span className="font-semibold text-gray-700 dark:text-gray-300">
              CID:{" "}
            </span>
            {result.cid}
          </p>
          <a href={(0, ipfs_1.getIpfsUrl)(result.cid)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline dark:text-blue-400">
            View on IPFS gateway
          </a>

          {/* Optional image preview */}
          {showPreview && isImage && (<img src={result.gatewayUrl} alt="Uploaded file preview" className="mt-2 max-h-48 rounded object-contain"/>)}
        </div>)}
    </div>);
}
