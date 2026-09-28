"use client";

import { useEffect } from "react";

const replacements: Array<[string, string]> = [
  ["Gist DNA", "Post DNA"],
  ["Post details", "Post DNA"],
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
      if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName)) return true;
      return Boolean(parent.closest(".post-text, .bio, .identity, [contenteditable='true']"));
    };

    const polish = () => {
      document.querySelectorAll<HTMLImageElement>("article.post > img").forEach((image) => {
        image.style.display = "block";
        image.style.width = "100%";
        image.style.height = "auto";
        image.style.maxHeight = "min(620px, 125vw)";
        image.style.aspectRatio = "4 / 5";
        image.style.objectFit = "cover";
        image.style.objectPosition = "center";
        image.style.background = "transparent";
        image.style.borderRadius = "16px";
        image.style.marginTop = "10px";
      });

      document.querySelectorAll<HTMLAnchorElement>("a").forEach((link) => {
        if (link.textContent?.trim() === "Post details" || link.textContent?.trim() === "Post DNA") {
          link.textContent = "Post DNA";
          link.style.marginLeft = "auto";
          link.style.color = "#7c3aed";
          link.style.fontSize = "13px";
          link.style.fontWeight = "800";
          link.style.textDecoration = "none";
          if (link.href.includes("/gist/")) link.href = link.href.replace("/gist/", "/post/");
        }
      });

      document.querySelectorAll<HTMLInputElement>("input[placeholder], textarea[placeholder]").forEach((field) => {
        const value = field.getAttribute("placeholder");
        if (value) field.setAttribute("placeholder", normalizeText(value));
      });
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
          if (value) element.setAttribute(attribute, normalizeText(value));
        }
      });

      document.querySelectorAll<HTMLAnchorElement>('a[href*="/gist/"]').forEach((link) => {
        link.href = link.href.replace("/gist/", "/post/");
      });

      polish();
    };

    normalize(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) mutation.addedNodes.forEach((node) => normalize(node));
      polish();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", polish);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", polish);
    };
  }, []);

  return null;
}
