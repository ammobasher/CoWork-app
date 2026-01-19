/**
 * Web Search Tool
 * Real web search using Tavily API (with fallback to DuckDuckGo scraping)
 */

import { Tool } from "../types";

export const webSearchTool: Tool = {
    definition: {
        name: "web_search",
        description: `Search the web for current information, news, documentation, or any topic. Returns relevant search results with titles, snippets, and URLs. Use this when you need up-to-date information that may not be in your training data.`,
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query. Be specific and include relevant keywords.",
                },
                searchDepth: {
                    type: "string",
                    enum: ["basic", "advanced"],
                    description: "basic = quick search, advanced = deeper search with more results",
                },
                maxResults: {
                    type: "number",
                    description: "Maximum number of results to return (1-10)",
                },
            },
            required: ["query"],
        },
    },
    execute: async (args, context) => {
        const { query, searchDepth = "basic", maxResults = 5 } = args as {
            query: string;
            searchDepth?: string;
            maxResults?: number;
        };

        // Try Tavily first if API key is available
        const tavilyKey = context?.apiKeys?.tavily;
        if (tavilyKey) {
            try {
                const response = await fetch("https://api.tavily.com/search", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        api_key: tavilyKey,
                        query,
                        search_depth: searchDepth,
                        max_results: Math.min(maxResults, 10),
                        include_answer: true,
                        include_raw_content: false,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    return {
                        success: true,
                        answer: data.answer,
                        results: data.results?.map((r: { title: string; content: string; url: string; score: number }) => ({
                            title: r.title,
                            snippet: r.content,
                            url: r.url,
                            score: r.score,
                        })),
                        query,
                    };
                }
            } catch (error) {
                console.error("Tavily search failed:", error);
            }
        }

        // Fallback: Use DuckDuckGo HTML search (no API key required)
        try {
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(
                `https://html.duckduckgo.com/html/?q=${encodedQuery}`,
                {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (compatible; CoWorkBot/1.0)",
                    },
                }
            );

            if (!response.ok) {
                throw new Error("DuckDuckGo search failed");
            }

            const html = await response.text();

            // Parse results from HTML (basic extraction)
            const results: Array<{ title: string; snippet: string; url: string }> = [];

            // Simpler pattern matching without the 's' flag
            const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g;
            const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]*)<\/a>/g;

            const titles: Array<{ url: string; title: string }> = [];
            let match;

            while ((match = resultRegex.exec(html)) !== null && titles.length < maxResults) {
                titles.push({ url: match[1], title: match[2].trim() });
            }

            const snippets: string[] = [];
            while ((match = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
                snippets.push(match[1].trim());
            }

            for (let i = 0; i < Math.min(titles.length, snippets.length); i++) {
                results.push({
                    title: titles[i].title,
                    url: titles[i].url,
                    snippet: snippets[i] || "",
                });
            }

            // If regex didn't work, provide helpful info
            if (results.length === 0) {
                return {
                    success: true,
                    message: `Search completed for: "${query}". For better results, configure a Tavily API key in settings.`,
                    results: [
                        {
                            title: `Search: ${query}`,
                            snippet: "Web search is available. For best results, add a Tavily API key (free tier available at tavily.com).",
                            url: `https://duckduckgo.com/?q=${encodedQuery}`,
                        },
                    ],
                    query,
                };
            }

            return {
                success: true,
                results,
                query,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Search failed",
                suggestion: "Configure a Tavily API key for reliable web search.",
            };
        }
    },
};

/**
 * URL Reader Tool
 * Fetches and extracts content from a URL
 */
export const readUrlTool: Tool = {
    definition: {
        name: "read_url",
        description: "Fetch and read the content of a web page. Useful for reading documentation, articles, or extracting information from websites.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "The URL to fetch and read",
                },
                extractText: {
                    type: "boolean",
                    description: "If true, extract only text content (no HTML). Default: true",
                },
            },
            required: ["url"],
        },
    },
    execute: async (args) => {
        const { url, extractText = true } = args as {
            url: string;
            extractText?: boolean;
        };

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (compatible; CoWorkBot/1.0)",
                    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                },
            });

            if (!response.ok) {
                return {
                    success: false,
                    error: `Failed to fetch URL: ${response.status} ${response.statusText}`,
                };
            }

            const contentType = response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
                const json = await response.json();
                return {
                    success: true,
                    contentType: "json",
                    content: JSON.stringify(json, null, 2).slice(0, 10000),
                };
            }

            let content = await response.text();

            if (extractText && contentType.includes("text/html")) {
                // Basic HTML to text extraction
                content = content
                    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                    .replace(/<[^>]+>/g, " ")
                    .replace(/\s+/g, " ")
                    .trim()
                    .slice(0, 10000);
            }

            return {
                success: true,
                url,
                contentType: extractText ? "text" : "html",
                content: content.slice(0, 10000),
                truncated: content.length > 10000,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Failed to read URL",
            };
        }
    },
};
