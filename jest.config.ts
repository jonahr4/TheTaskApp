import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "jsdom",
    roots: ["<rootDir>/tests"],
    testMatch: ["**/*_test.ts", "**/*_test.tsx"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
};

export default config;
