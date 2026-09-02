import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const testsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(testsDirectory);
const templatesPath = path.join(repositoryRoot, 'data', 'templates.js');
const sourcesDirectory = path.join(repositoryRoot, 'reference-sources');

function loadEmbeddedTemplates() {
  const namespace = {};
  vm.runInNewContext(fs.readFileSync(templatesPath, 'utf8'), {
    window: { XMLValidator: namespace },
    XMLValidator: namespace
  });
  return namespace.Templates;
}

function approvedSources() {
  return fs.readdirSync(sourcesDirectory)
    .filter((name) => name.endsWith('.xml'))
    .sort()
    .map((name) => ({
      id: path.basename(name, '.xml'),
      path: path.join(sourcesDirectory, name),
      xml: fs.readFileSync(path.join(sourcesDirectory, name), 'utf8')
    }));
}

const templates = loadEmbeddedTemplates();
const sources = approvedSources();
const templateById = new Map(templates.map((template) => [template.id, template]));
const results = sources.map((source) => ({
  id: source.id,
  passed: templateById.has(source.id) && templateById.get(source.id).xml === source.xml
}));

for (const result of results) {
  console.log(result.id + ': ' + (result.passed ? 'SOURCE_MATCH' : 'SOURCE_MISMATCH'));
}

const passed = results.filter((result) => result.passed).length;
console.log(passed + '/' + sources.length + ' SOURCE MATCH');

if (sources.length !== 17 || templates.length !== 17 || passed !== 17) process.exitCode = 1;
