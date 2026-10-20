import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
    {
        ignores: ["dist", "dist-electron", "release", "node_modules", "_analysis", "coverage"]
    },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/renderer/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
        plugins: {
            "react-hooks": reactHooks
        },
        languageOptions: {
            globals: {
                ...globals.browser
            }
        },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "dexie",
                            message: "Use the repositories in src/renderer/db instead of Dexie directly."
                        }
                    ]
                }
            ]
        }
    },
    {
        files: ["src/renderer/db/**/*.ts"],
        rules: {
            "no-restricted-imports": "off"
        }
    },
    {
        files: ["src/main/**/*.ts", "src/preload/**/*.ts"],
        languageOptions: {
            globals: {
                ...globals.node
            }
        }
    },
    {
        files: ["scripts/**/*.mjs", "*.config.{js,mjs,ts}", "vite.config.ts"],
        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.browser
            }
        }
    }
);
