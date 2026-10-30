// Copyright (c) 2025-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Checks specs against the documentation format of mattermost/mattermost's
// e2e-tests/playwright/script/lint-test-docs.js: a preceding JSDoc with
// @objective, a feature tag, and `// #` action and `// *` verification comments.

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const TESTS_DIR = path.join(__dirname, '..', 'tests');
const testDeclaration = /test\(\s*['"]([^'"]+)['"]\s*,\s*{\s*tag:\s*['"]@[\w_]+['"]\s*}\s*,\s*async\s*\([^)]*\)\s*=>\s*{/g;
const anyTest = /^\s*test\(\s*['"]([^'"]+)['"]/gm;

function testBody(content, openBrace) {
    let depth = 1;
    let i = openBrace + 1;
    while (depth > 0 && i < content.length) {
        if (content[i] === '{') {
            depth++;
        } else if (content[i] === '}') {
            depth--;
        }
        i++;
    }
    return content.slice(openBrace + 1, i - 1);
}

const errors = [];
const specs = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith('.spec.ts'));

for (const file of specs) {
    const content = fs.readFileSync(path.join(TESTS_DIR, file), 'utf-8');
    const documented = new Set();

    for (const match of content.matchAll(testDeclaration)) {
        const title = match[1];
        documented.add(title);

        const before = content.slice(0, match.index).trimEnd();
        const jsdocStart = before.lastIndexOf('/**');
        if (!before.endsWith('*/') || jsdocStart === -1) {
            errors.push(`${file}: missing JSDoc at "${title}"`);
        } else if (!(/@objective\s+\S/).test(before.slice(jsdocStart))) {
            errors.push(`${file}: missing @objective at "${title}"`);
        }

        const body = testBody(content, match.index + match[0].length - 1);
        if (!(/\/\/\s*#/).test(body)) {
            errors.push(`${file}: missing "// #" action comment at "${title}"`);
        }
        if (!(/\/\/\s*\*/).test(body)) {
            errors.push(`${file}: missing "// *" verification comment at "${title}"`);
        }
    }

    for (const match of content.matchAll(anyTest)) {
        if (!documented.has(match[1])) {
            errors.push(`${file}: missing {tag: '@feature'} at "${match[1]}"`);
        }
    }
}

if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
}
console.log(`Test docs OK (${specs.length} spec files)`);
