const fs = require("fs");
const path = require("path");

const replacements = [
  ["Gist DNA", "Post DNA"],
  ["Post details", "Post DNA"],
  ["Loading Gist…", "Loading Post…"],
  ["Loading Gists…", "Loading Posts…"],
  ["No Trending Gists yet", "No Trending Posts yet"],
  ["No Gists yet", "No Posts yet"],
  ["We couldn't load the Gists", "We couldn't load the Posts"],
  ["Follow people to see their Gists here.", "Follow people to see their Posts here."],
  ["When Gists start trending, they will appear here.", "When Posts start trending, they will appear here."],
  ["Be the first person to start a Gist.", "Be the first person to create a Post."],
  ["Start a Gist", "Create Post"],
  ["start a Gist", "create a Post"],
  ["Voice Gist", "Voice Post"],
  ["Photo Gist", "Photo Post"],
  ["Text Gist", "Text Post"],
  ["My Gists", "My Posts"],
  ["Saved Gists", "Saved Posts"],
  ["Save Gist", "Save Post"],
  ["Delete Gist", "Delete Post"],
  ["Report Gist", "Report Post"],
  ["this Gist", "this Post"],
  ["this gist", "this post"],
  ["Join this Gist on Gista", "Check out this post on Gista"],
  ["Search Gists, people, categories…", "Search Posts, people, categories…"],
  ["Search Gists", "Search Posts"],
  ["Join the Gist", "Comments"],
  ["Join the Conversation", "Comments"],
  ["Responses", "Comments"],
  ["Response", "Comment"],
  ["responses", "comments"],
  ["response", "comment"],
  ["/gist/", "/post/"],
];

function walk(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...walk(full));
    else if (entry.isFile() && (full.endsWith(".tsx") || full.endsWith(".ts"))) result.push(full);
  }
  return result;
}

for (const file of walk(path.join(process.cwd(), "app")).concat(walk(path.join(process.cwd(), "components")))) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;
  for (const [from, to] of replacements) text = text.split(from).join(to);
  if (text !== original) fs.writeFileSync(file, text);
}
