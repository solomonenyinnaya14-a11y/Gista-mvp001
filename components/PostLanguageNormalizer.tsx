"use client";

import { useEffect } from "react";

const replacements: Array<[string, string]> = [
  ["Gist DNA", "Post details"],
  ["Gist not found.", "Post not found."],
  ["Loading Gist…", "Loading Post…"],
  ["Loading Gists…", "Loading Posts…"],
  ["No Trending Gists yet", "No Trending Posts yet"],
  ["No Gists yet", "No Posts yet"],
  ["We couldn't load the Gists", "We couldn't load the Posts"],
  ["Follow people to see their Gists here.", "Follow people to see their Posts here."],
  ["When Gists start trending, they will appear here.", "When Posts start trending, they will appear here."],
  ["Be the first person to start a Gist.", "Be the first person to create a Post."],
  ["Start a Gist", "Create Post"],
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
  ["Join the Gist", "Comments"],
  ["Join the Conversation", "Comments"],
  ["Responses", "Comments"],
  ["Response", "Comment"],
  ["Gists", "Posts"],
  ["Gist", "Post"],
];

function normalizeText(value: string) {
  let next = value;
  for (const [from, to] of replacements) next = next.split(from).join(to);
  return next;
}

export default function PostLanguageNormalizer() {
  useEffect(() => {
    const shouldSkip = (node: Node) => {
      const parent = node.parentElement;
      if (!parent) return true;
      return ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName);
    };

    const normalize = (root: Node) => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let current: Node | null;
      while ((current = walker.nextNode())) {
        if (!shouldSkip(current)) nodes.push(current as Text);
      }
      for (const node of nodes) {
        const next = normalizeText(node.nodeValue ?? "");
        if (next !== node.nodeValue) node.nodeValue = next;
      }

      document.querySelectorAll<HTMLElement>("[aria-label], [title]").forEach((element) => {
        for (const attribute of ["aria-label", "title"] as const) {
          const value = element.getAttribute(attribute);
          if (value) {
            const next = normalizeText(value);
            if (next !== value) element.setAttribute(attribute, next);
          }
        }
      });

      document.querySelectorAll<HTMLAnchorElement>('a[href*="/gist/"]').forEach((link) => {
        link.href = link.href.replace("/gist/", "/post/");
      });
    };

    normalize(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => normalize(node));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
