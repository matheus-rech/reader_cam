import * as fs from 'fs';
import { parseDocument } from 'htmlparser2';
import { Element, DataNode, Node } from 'domhandler';

function nodeToJson(node: Node): any {
  switch (node.type) {
    case 'tag':
    case 'script':
    case 'style':
      const elem = node as Element;
      return {
        type: node.type,
        name: elem.name,
        attribs: elem.attribs,
        children: elem.children.map(child => nodeToJson(child))
      };
    case 'text':
      return { type: 'text', data: (node as DataNode).data };
    default:
      return { type: node.type };
  }
}

async function main() {
  let html = '';
  if (process.argv[2]) {
    html = await fs.readFile(process.argv[2], 'utf8');
  } else {
    html = await new Promise<string>((resolve, reject) => {
      let data = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => resolve(data));
      process.stdin.on('error', reject);
    });
  }

  const dom = parseDocument(html);
  const json = dom.children.map(node => nodeToJson(node));
  console.log(JSON.stringify(json, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
