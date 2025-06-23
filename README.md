# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Convert HTML to JSON

Use the `htmlToJson` script to quickly convert an HTML file to a JSON representation.

```bash
# Read HTML from a file
node --loader ts-node/esm scripts/htmlToJson.ts path/to/file.html > output.json

# Or pipe HTML directly
cat index.html | node --loader ts-node/esm scripts/htmlToJson.ts > output.json
```
