import js from "@eslint/js";
import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import tsdoc from "eslint-plugin-tsdoc";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      parser: typescriptParser,
      ecmaVersion: 2018,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        _: "readonly",
        E: "readonly",
        L: "readonly",
        LuCI: "readonly",
        baseclass: "readonly",
        dom: "readonly",
        form: "readonly",
        fs: "readonly",
        network: "readonly",
        poll: "readonly",
        request: "readonly",
        rpc: "readonly",
        uci: "readonly",
        ui: "readonly",
        validation: "readonly",
        view: "readonly",
        widgets: "readonly",
        xhr: "readonly",
        base64: "readonly",
        converters: "readonly",
        custom: "readonly",
        v2ray: "readonly",
        droidnet: "readonly",
        UIRenderer: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": typescript,
      prettier,
      tsdoc,
    },
    rules: {
      "no-var": "error",
      "prefer-const": "warn",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "no-prototype-builtins": "off",
    },
  },
  {
    files: ["src/typings/**/*.d.ts"],
    rules: {
      "no-unused-vars": "off",
    },
  },
];
